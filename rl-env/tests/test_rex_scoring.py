"""Phase-1 scoring: GRADED score in [0,1] + SPECIFIC feedback.

A1: the root-cause component is now judged by mapping the stated cause to the gold
root (phrasing-robust) — NOT exact keyword match — and a red herring scores wrong.
The judge is injectable so these tests are deterministic.
"""
from rex.harness import load_scenario
from rex.scoring import (score_plan, format_feedback, judge_diagnosis,
                         build_judge_prompt, failed_checks)

SC = load_scenario("oom_kill")


def fake_judge(stated_cause, gold_root, red_herrings):
    """Deterministic stand-in for the LLM judge: correct iff the cause names the real
    mechanism (memory/leak/oom or the control plane), regardless of exact wording."""
    s = stated_cause.lower()
    return any(k in s for k in ("memory", "ram", "leak", "oom", "service-control", "control plane"))


PERFECT = {
    "root_cause": "per-process memory leak causing OOMKilled on image-resizer; RSS exceeds the limit",
    "actions": [
        {"tool": "increase_memory_limit", "args": {"target": "image-resizer", "mem_limit_mb": 1024}},
        {"tool": "restart_pod", "args": {"target": "image-resizer"}},
    ],
}
TRAP = {"root_cause": "too few replicas under load",
        "actions": [{"tool": "scale_deployment", "args": {"target": "image-resizer", "replicas": 6}}]}
DIAG_ONLY = {"root_cause": "a memory leak / OOM on image-resizer", "actions": []}


def _sr(plan, resolved):
    return {"resolved": resolved, "root_cleared": resolved,
            "applied_actions": plan["actions"], "blocked_actions": []}


# ---- graded score -------------------------------------------------------
def test_perfect_resolved_plan_scores_high():
    s, _ = score_plan(PERFECT, SC, _sr(PERFECT, True), judge_fn=fake_judge)
    assert s >= 0.9


def test_trap_plan_heavily_penalized():
    s, _ = score_plan(TRAP, SC, _sr(TRAP, False), judge_fn=fake_judge)
    assert s < 0.3


def test_resolution_raises_score():
    hi = score_plan(PERFECT, SC, _sr(PERFECT, True), judge_fn=fake_judge)[0]
    lo = score_plan(PERFECT, SC, _sr(PERFECT, False), judge_fn=fake_judge)[0]
    assert hi > lo


def test_partial_credit_for_correct_diagnosis_without_fix():
    s, _ = score_plan(DIAG_ONLY, SC, _sr(DIAG_ONLY, False), judge_fn=fake_judge)
    assert 0.0 < s < 0.4


def test_score_always_in_unit_interval():
    for plan, resolved in [(PERFECT, True), (TRAP, False), (DIAG_ONLY, False)]:
        s, _ = score_plan(plan, SC, _sr(plan, resolved), judge_fn=fake_judge)
        assert 0.0 <= s <= 1.0


# ---- A1: the diagnosis judge --------------------------------------------
def test_judge_credits_a_differently_worded_correct_diagnosis():
    # NONE of answer.yml's exact keywords, but the same meaning -> correct
    assert judge_diagnosis("the box ran out of RAM and the kernel killed the process",
                           SC, judge_fn=fake_judge) is True


def test_judge_rejects_a_red_herring():
    assert judge_diagnosis("the service simply needs more replicas", SC, judge_fn=fake_judge) is False


def test_score_uses_the_judge_not_exact_keywords():
    plan = {"root_cause": "the container ran out of RAM so the kernel OOM-killed it",
            "actions": PERFECT["actions"]}
    s, _ = score_plan(plan, SC, _sr(plan, True), judge_fn=fake_judge)
    assert s >= 0.9


def test_build_judge_prompt_contains_stated_gold_and_red_herrings():
    p = build_judge_prompt("MY-STATED-CAUSE", SC).lower()
    assert "my-stated-cause" in p
    assert "memory" in p                       # the gold root description
    assert "replicas" in p or "scaling" in p   # a red herring is offered as a wrong option


def test_failed_checks_flags_wrong_diagnosis_and_trap():
    fc = failed_checks(TRAP, SC, _sr(TRAP, False), judge_fn=fake_judge)
    assert "root_cause" in fc
    assert "trap_action" in fc
    assert "not_resolved" in fc


# ---- feedback -----------------------------------------------------------
def test_feedback_names_the_trap_and_says_why():
    fb = format_feedback(TRAP, SC, _sr(TRAP, False), judge_fn=fake_judge).lower()
    assert "scale_deployment" in fb
    assert any(w in fb for w in ("worsen", "won't", "will not", "not resolve", "trap", "wrong"))


def test_feedback_reveals_the_correct_root_cause_when_wrong():
    fb = format_feedback(TRAP, SC, _sr(TRAP, False), judge_fn=fake_judge).lower()
    assert "memory" in fb or "leak" in fb


def test_feedback_states_resolution_status():
    fb = format_feedback(TRAP, SC, _sr(TRAP, False), judge_fn=fake_judge).lower()
    assert "not resolved" in fb or "did not resolve" in fb or "still" in fb


def test_feedback_confirms_a_correct_fix_when_present():
    fb = format_feedback(PERFECT, SC, _sr(PERFECT, True), judge_fn=fake_judge).lower()
    assert "increase_memory_limit" in fb or "valid" in fb or "correct fix" in fb
