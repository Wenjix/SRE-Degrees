"""Floor 3: the novelty router + escalation handoff.

When REx exhausts its budget without a clean win, the loop's outcome is 'escalated'
and we produce a structured handoff (observed / ruled out / best-guess action NOT
executed / why escalating). Held-out scenario: a single-node pool whose only node is
NotReady — the standard fix (drain) is blocked by the harness (last Ready node), so no
safe in-band resolution exists and the agent MUST escalate.
"""
from rex.harness import load_scenario
from rex.loop import refine_loop
from rex.escalate import escalation_report

CLEAN = {
    "root_cause": "per-process memory leak; OOMKilled on image-resizer, RSS over limit",
    "actions": [
        {"tool": "increase_memory_limit", "args": {"target": "image-resizer", "mem_limit_mb": 1024}},
        {"tool": "restart_pod", "args": {"target": "image-resizer"}},
    ],
}


def _judge_true(*a):
    return True


def test_outcome_resolved_on_clean_win():
    res = refine_loop(load_scenario("oom_kill"), budget=4,
                      propose_fn=lambda sc, fb: CLEAN, judge_fn=_judge_true)
    assert res["outcome"] == "resolved"
    assert res["clean_win"] is True


def test_outcome_escalated_when_budget_exhausted_without_clean_win():
    # a proposer that never produces a clean win (wrong fix, no resolve)
    junk = {"root_cause": "unsure", "actions": [{"tool": "get_logs", "args": {"target": "x"}}]}
    res = refine_loop(load_scenario("oom_kill"), budget=3,
                      propose_fn=lambda sc, fb: junk, judge_fn=lambda *a: False)
    assert res["outcome"] == "escalated"
    assert res["clean_win"] is False
    assert len(res["iterations"]) == 3


def test_singleton_node_scenario_escalates_because_fix_is_harness_blocked():
    sc = load_scenario("singleton_node_notready")
    # the agent correctly proposes the standard fix — but it's the last Ready node
    plan = {"root_cause": "the only worker node is NotReady",
            "actions": [{"tool": "drain_node", "args": {"target": "worker-node-1"}}]}
    res = refine_loop(sc, budget=4, propose_fn=lambda s, fb: plan, judge_fn=_judge_true)
    assert res["outcome"] == "escalated"
    # the fix was attempted every iteration and BLOCKED by the harness, never resolving
    assert any(b["action"]["tool"] == "drain_node" for it in res["iterations"] for b in it["blocked"])


def test_escalation_report_has_the_required_sections():
    sc = load_scenario("singleton_node_notready")
    plan = {"root_cause": "the only worker node is NotReady",
            "actions": [{"tool": "drain_node", "args": {"target": "worker-node-1"}}]}
    res = refine_loop(sc, budget=3, propose_fn=lambda s, fb: plan, judge_fn=_judge_true)
    report = escalation_report(sc, res).lower()
    assert "escalat" in report                       # it's an escalation
    assert "observed" in report or "symptom" in report
    assert "ruled out" in report
    assert "not executed" in report                  # best-guess action withheld
    assert "drain_node" in report                    # the withheld best guess
    assert "last ready node" in report or "blocked" in report   # WHY it couldn't act safely
