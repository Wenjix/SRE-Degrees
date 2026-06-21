"""Phase-1 scoring + feedback.

score_plan -> (score in [0,1], feedback): GRADED, not binary.
  0.30 * diagnosis_correct  +  0.25 * correct_fix_present  +  0.45 * resolved
  minus a BIG penalty (0.60) if any trap/forbidden action appears.

A1: diagnosis_correct is decided by an LLM-judge that maps the model's STATED root
cause to the gold root (phrasing-robust) and rejects red herrings — NOT exact
keyword match. The judge is injectable (judge_fn) so the loop/tests are deterministic.
"""
from __future__ import annotations

import re

W_ROOT, W_FIX, W_RESOLVED, TRAP_PENALTY = 0.30, 0.25, 0.45, 0.60
_JUDGE_MODEL = "claude-haiku-4-5"


# ---- diagnosis judge (A1) ------------------------------------------------
def build_judge_prompt(stated_cause: str, scenario) -> str:
    herrings = "\n".join(f"  - WRONG: {h}" for h in scenario.red_herring_hints)
    category = getattr(scenario, "category", "unknown")
    return (
        "You are grading an SRE's root-cause diagnosis. Judge the MECHANISM (the category of "
        "fault), not merely whether they named the right service.\n\n"
        f"GOLD root cause — category '{category}': {scenario.gold_root_description}\n\n"
        f"WRONG diagnoses (red herrings, wrong mechanism, or blaming a downstream victim):\n{herrings}\n\n"
        f"The SRE stated this root cause:\n  \"{stated_cause}\"\n\n"
        "Rules:\n"
        f"- CORRECT only if it identifies the GOLD mechanism/category ('{category}') — the right "
        "component AND the right kind of cause, regardless of wording.\n"
        "- Naming the right component but the WRONG mechanism (e.g. calling a config/policy crash "
        "a 'resource exhaustion' or 'capacity' problem) is WRONG.\n"
        "- Matching a red herring or blaming a downstream victim is WRONG.\n"
        "Answer with ONE word: CORRECT or WRONG."
    )


def _llm_judge(stated_cause: str, gold_root: str, red_herrings: list) -> bool:
    from agent.llm import call

    class _S:  # tiny shim so build_judge_prompt can read the fields
        gold_root_description = gold_root
        red_herring_hints = red_herrings
    text = call(_JUDGE_MODEL, build_judge_prompt(stated_cause, _S()),
                max_tokens=8, temperature=0.0)
    t = text.strip().lower()
    # whole-word "correct", but reject "incorrect" / "not correct" (both contain it).
    return bool(re.search(r"\bcorrect\b", t)) and "incorrect" not in t and "not correct" not in t


def judge_diagnosis(stated_cause: str, scenario, judge_fn=None) -> bool:
    if not (stated_cause or "").strip():
        return False
    fn = judge_fn or _llm_judge
    return bool(fn(stated_cause, scenario.gold_root_description, scenario.red_herring_hints))


# ---- action grading ------------------------------------------------------
def _applied(plan: dict, sim_result: dict) -> list:
    return sim_result.get("applied_actions", plan.get("actions", []))


def _fix_credit(actions: list, scenario) -> float:
    on_target = any(a.get("tool") in scenario.correct_fix_tools
                    and a.get("args", {}).get("target") == scenario.fault_node
                    for a in actions)
    if on_target:
        return 1.0
    return 0.5 if any(a.get("tool") in scenario.correct_fix_tools for a in actions) else 0.0


def _traps_in(actions: list, scenario) -> list:
    hits = []
    for a in actions:
        for t in scenario.trap_actions:
            same_target = t.get("target") in (None, a.get("args", {}).get("target"))
            if a.get("tool") == t["tool"] and same_target:
                hits.append(a)
    return hits


def failed_checks(plan: dict, scenario, sim_result: dict, judge_fn=None) -> list:
    actions = _applied(plan, sim_result)
    failed = []
    if not judge_diagnosis(plan.get("root_cause", ""), scenario, judge_fn):
        failed.append("root_cause")
    if _fix_credit(actions, scenario) < 1.0:
        failed.append("correct_fix_missing")
    if _traps_in(actions, scenario):
        failed.append("trap_action")
    if not sim_result.get("resolved"):
        failed.append("not_resolved")
    return failed


def score_plan(plan: dict, scenario, sim_result: dict, judge_fn=None):
    actions = _applied(plan, sim_result)
    diag_ok = judge_diagnosis(plan.get("root_cause", ""), scenario, judge_fn)
    fix = _fix_credit(actions, scenario)
    resolved = 1.0 if sim_result.get("resolved") else 0.0
    trap_hit = bool(_traps_in(actions, scenario))

    score = W_ROOT * (1.0 if diag_ok else 0.0) + W_FIX * fix + W_RESOLVED * resolved
    if trap_hit:
        score -= TRAP_PENALTY
    score = max(0.0, min(1.0, score))
    return score, format_feedback(plan, scenario, sim_result, judge_fn, _diag_ok=diag_ok)


def format_feedback(plan: dict, scenario, sim_result: dict, judge_fn=None, _diag_ok=None) -> str:
    actions = _applied(plan, sim_result)
    diag_ok = _diag_ok if _diag_ok is not None else judge_diagnosis(
        plan.get("root_cause", ""), scenario, judge_fn)
    given = plan.get("root_cause") or "(none given)"
    lines = []

    # 1. diagnosis: correct, or reveal the gold root
    if diag_ok:
        lines.append(f"ROOT CAUSE: correct — you identified {scenario.gold_root_description}.")
    else:
        lines.append(f"ROOT CAUSE: your diagnosis '{given}' is wrong (it matches a downstream "
                     f"symptom or a red herring). The real root cause is "
                     f"{scenario.gold_root_description}. Look UPSTREAM of the loudest alerts.")

    # 2. correct fix tool present?
    fix_tools = ", ".join(sorted(scenario.correct_fix_tools))
    if _fix_credit(actions, scenario) >= 1.0:
        present = sorted({a["tool"] for a in actions if a.get("tool") in scenario.correct_fix_tools})
        lines.append(f"FIX: your plan included a correct fix ({', '.join(present)}) targeting "
                     f"'{scenario.fault_node}'. Good.")
    else:
        lines.append(f"FIX: your plan did NOT include a remediation that targets the real root "
                     f"'{scenario.fault_node}'. What resolves it: {fix_tools} on '{scenario.fault_node}'.")

    # 3. trap actions + WHY
    for a in _traps_in(actions, scenario):
        why = {
            "scale_deployment": "scaling does not address the root cause — for a per-process leak every "
                                "replica OOMs the same way, and scaling a crash-looping control plane "
                                "HERDS its datastore and worsens recovery; it will NOT resolve the incident",
            "clear_cache": "clearing a cache does not free leaked heap — the loop continues",
            "restart_service": "blindly restarting the control plane before disabling the bad path "
                               "re-triggers the crash and herds the datastore — it WORSENS the outage",
        }.get(a.get("tool"), "it does not address the root cause, so it will not resolve the incident")
        lines.append(f"TRAP: you used '{a.get('tool')}' — WRONG: {why}.")

    # 3b. actions the safety harness BLOCKED (so the model learns WHY it was stopped)
    for b in sim_result.get("blocked_actions", []):
        lines.append(f"BLOCKED: '{b.get('action', {}).get('tool')}' was blocked by the safety "
                     f"harness — {b.get('reason')}")

    # 4. resolution
    if sim_result.get("resolved"):
        lines.append("RESULT: the sim reports the incident RESOLVED — SLO restored and the root cleared.")
    else:
        lines.append("RESULT: NOT resolved — the root cause is still active and the SLO is still "
                     "breaching. Revise the plan.")
    return "\n".join(lines)
