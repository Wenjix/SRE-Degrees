"""Phase-1 refinement loop: propose -> run -> score -> feed feedback -> repeat.
The proposer is injectable so the loop mechanics are tested deterministically;
the real haiku-backed propose() is exercised by the probe run, not here.
Also tests the pure plan parser used by the real propose().
"""
from rex.harness import load_scenario
from rex.loop import refine_loop, parse_plan, build_prompt

SC = load_scenario("oom_kill")

CANONICAL = {
    "root_cause": "per-process memory leak; OOMKilled on image-resizer, RSS over limit",
    "actions": [
        {"tool": "increase_memory_limit", "args": {"target": "image-resizer", "mem_limit_mb": 1024}},
        {"tool": "restart_pod", "args": {"target": "image-resizer"}},
    ],
}
TRAP = {"root_cause": "too few replicas",
        "actions": [{"tool": "scale_deployment", "args": {"target": "image-resizer", "replicas": 6}}]}


def _judge(stated, gold, herrings):
    """Deterministic diagnosis judge so loop tests don't hit the network."""
    s = stated.lower()
    return any(k in s for k in ("memory", "leak", "oom", "rss"))


# ---- loop mechanics (deterministic, injected proposer) --------------------
def test_loop_stops_early_when_resolved():
    res = refine_loop(SC, budget=6, propose_fn=lambda sc, fb: CANONICAL, judge_fn=_judge)
    assert res["resolved"] is True
    assert len(res["iterations"]) == 1


def test_loop_respects_budget_when_never_resolved():
    res = refine_loop(SC, budget=4, propose_fn=lambda sc, fb: TRAP, judge_fn=_judge)
    assert res["resolved"] is False
    assert len(res["iterations"]) == 4


def test_resolved_but_trap_laden_plan_keeps_refining():
    # The sim resolves (the correct fix is present) BUT a trap action is also present —
    # that is NOT a clean win, so the loop must keep refining, not stop.
    resolved_with_trap = {
        "root_cause": "memory leak; OOMKilled on image-resizer, RSS over its limit",
        "actions": [
            {"tool": "increase_memory_limit", "args": {"target": "image-resizer", "mem_limit_mb": 1024}},
            {"tool": "scale_deployment", "args": {"target": "image-resizer", "replicas": 6}},
        ],
    }
    res = refine_loop(SC, budget=3, propose_fn=lambda sc, fb: resolved_with_trap, judge_fn=_judge)
    assert res["iterations"][0]["resolved"] is True
    assert "trap_action" in res["iterations"][0]["failed_checks"]
    assert len(res["iterations"]) == 3   # never clean -> runs the full budget


def test_best_score_climbs_when_feedback_is_informative():
    def climber(sc, prior_feedback):
        # improves once the feedback names the correct remediation
        if prior_feedback and "increase_memory_limit" in prior_feedback:
            return CANONICAL
        return TRAP
    res = refine_loop(SC, budget=6, propose_fn=climber, judge_fn=_judge)
    scores = [it["score"] for it in res["iterations"]]
    assert scores[-1] > scores[0]          # it climbed
    assert res["resolved"] is True


def test_each_iteration_is_logged():
    res = refine_loop(SC, budget=3, propose_fn=lambda sc, fb: TRAP, judge_fn=_judge)
    for i, it in enumerate(res["iterations"]):
        assert it["iter"] == i
        assert "score" in it and "resolved" in it


def test_prior_feedback_is_fed_after_first_iter():
    seen = []
    def rec(sc, prior_feedback):
        seen.append(prior_feedback)
        return TRAP
    refine_loop(SC, budget=3, propose_fn=rec, judge_fn=_judge)
    assert seen[0] is None          # first proposal has no prior feedback
    assert seen[1] is not None      # subsequent proposals receive feedback text


# ---- pure plan parser (used by the real propose) -------------------------
def test_parse_plan_extracts_plain_json():
    p = parse_plan('{"root_cause": "x", "actions": [{"tool": "restart_pod", "args": {"target": "a"}}]}')
    assert p["root_cause"] == "x"
    assert p["actions"][0]["tool"] == "restart_pod"


def test_parse_plan_handles_prose_and_fences():
    text = "Here is my plan:\n```json\n{\"root_cause\":\"y\",\"actions\":[]}\n```\nDone."
    p = parse_plan(text)
    assert p["root_cause"] == "y"
    assert p["actions"] == []


def test_parse_plan_degrades_gracefully_on_garbage():
    p = parse_plan("no json here")
    assert p["root_cause"] == ""
    assert p["actions"] == []


def test_build_prompt_includes_symptom_tools_and_feedback():
    pr = build_prompt(SC, prior_feedback="PRIOR-FEEDBACK-MARKER")
    assert SC.fault_node in pr
    assert "restart_pod" in pr            # the action space is offered
    assert "PRIOR-FEEDBACK-MARKER" in pr  # feedback is woven into a refine prompt
    assert "root_cause" in pr             # the required output shape is specified
