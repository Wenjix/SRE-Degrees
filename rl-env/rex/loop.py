"""Phase-1 linear refinement loop + propose().

propose(scenario, prior_feedback) -> plan: prompt a small frozen model (haiku) on
the alert + evidence; on refine, weave in the prior feedback text.
refine_loop: propose -> run_plan -> score_plan -> if not resolved & budget left,
feed feedback -> repeat. Logs per iteration. (NO Thompson sampling — linear only.)
"""
from __future__ import annotations

import json
import os
import re

from rex.harness import run_plan
from rex.scoring import score_plan, failed_checks

_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SMALL_MODEL = "claude-haiku-4-5"


def _remediation_tools() -> list:
    """Remediation (write) tools from the registry — the plan's action space."""
    try:
        reg = json.load(open(os.path.join(_REPO, "tools_registry.json")))
    except (OSError, ValueError):
        return ["restart_pod", "increase_memory_limit", "scale_deployment",
                "rollback_deployment", "restart_service", "clear_cache"]
    read = {"get_metrics", "get_logs", "get_events", "describe_pod", "get_deployment_status",
            "get_node_status", "query_traces", "get_alerts"}
    return [t["name"] for t in reg if t.get("name") not in read
            and t.get("name") not in ("end_incident", "escalate_to_human")]


def build_prompt(scenario, prior_feedback: str | None = None) -> str:
    tools = ", ".join(_remediation_tools())
    parts = [
        "You are an SRE remediation agent. Given an incident, output a remediation PLAN.",
        "",
        scenario.prompt_text,
        "",
        f"Available remediation tools: {tools}.",
        "Each action targets a node via args.target (here the service is "
        f"'{scenario.fault_node}').",
        "",
        "Respond with ONLY a JSON object of this exact shape (no prose):",
        '{"root_cause": "<one sentence: the specific failing component and mechanism>", '
        '"actions": [{"tool": "<tool>", "args": {"target": "<node>", ...}}]}',
    ]
    if prior_feedback:
        parts += [
            "",
            "Your PREVIOUS plan did not fully resolve the incident. Feedback:",
            prior_feedback,
            "",
            "Revise your plan to address this feedback. Output ONLY the JSON object.",
        ]
    return "\n".join(parts)


def parse_plan(text: str) -> dict:
    """Extract the first JSON object from a model response, tolerating prose / ```fences```."""
    plan = {"root_cause": "", "actions": []}
    if not text:
        return plan
    # strip code fences, then grab the first balanced-looking {...} block
    cleaned = re.sub(r"```(?:json)?", "", text)
    start = cleaned.find("{")
    if start == -1:
        return plan
    # raw_decode respects JSON string quoting, so a '}' inside a value (e.g. in
    # root_cause) doesn't truncate the object the way a manual brace-counter would.
    try:
        d, _ = json.JSONDecoder().raw_decode(cleaned, start)
    except ValueError:
        return plan
    if not isinstance(d, dict):
        return plan
    plan["root_cause"] = str(d.get("root_cause", "") or "")
    acts = d.get("actions", []) or []
    plan["actions"] = [a for a in acts if isinstance(a, dict) and a.get("tool")]
    return plan


def propose(scenario, prior_feedback: str | None = None, model: str = _SMALL_MODEL) -> dict:
    """Real proposer: prompt the small frozen model and parse its plan."""
    from agent.llm import call
    text = call(model, build_prompt(scenario, prior_feedback), max_tokens=600)
    return parse_plan(text)


def refine_loop(scenario, budget: int = 6, propose_fn=propose, judge_fn=None, log=None) -> dict:
    """Linear propose->run->score->feedback loop. Returns per-iteration log + best.
    judge_fn is the diagnosis judge (None -> the real LLM judge)."""
    from rex import scoring
    iterations, feedback = [], None
    best_score, best_iter = -1.0, -1
    for i in range(budget):
        plan = propose_fn(scenario, feedback)
        sim_result = run_plan(plan, scenario)
        # Judge the diagnosis ONCE per iteration (memoized by stated cause) so
        # score/feedback/failed_checks agree and we don't spend redundant judge calls.
        cache: dict = {}

        def memo(stated, gold, herrings, _fn=judge_fn):
            # gold/herrings are scenario-constant within a loop; key on (stated, gold)
            # to be explicit and avoid cross-scenario collisions if memo is ever reused.
            key = (stated, gold)
            if key not in cache:
                fn = _fn or scoring._llm_judge
                cache[key] = bool(fn(stated, gold, herrings))
            return cache[key]

        score, fb = score_plan(plan, scenario, sim_result, judge_fn=memo)
        fc = failed_checks(plan, scenario, sim_result, judge_fn=memo)
        rec = {
            "iter": i, "score": round(score, 4), "resolved": bool(sim_result["resolved"]),
            "stated_root_cause": plan.get("root_cause", ""),
            "diagnosis_correct": "root_cause" not in fc,
            "failed_checks": fc,
            "blocked": sim_result.get("blocked_actions", []),
            "plan": plan, "feedback": fb,
        }
        iterations.append(rec)
        if log:
            log(rec)
        if score > best_score:
            best_score, best_iter = score, i
        # Stop only on a CLEAN win: resolved AND correct root cause AND correct fix
        # AND no trap. A resolved-but-trap-laden plan is not done — keep refining so
        # the feedback can drive the trap out.
        if not rec["failed_checks"]:
            break
        feedback = fb
    result = {
        "scenario": scenario.name,
        "iterations": iterations,
        "best_score": round(best_score, 4),
        "best_iter": best_iter,
        "resolved": any(it["resolved"] for it in iterations),
        "clean_win": any(not it["failed_checks"] for it in iterations),
    }
    # novelty router: a clean win -> resolved; budget exhausted without one -> escalate
    result["outcome"] = "resolved" if result["clean_win"] else "escalated"
    if result["outcome"] == "escalated":
        from rex.escalate import escalation_report
        result["escalation"] = escalation_report(scenario, result)
    return result
