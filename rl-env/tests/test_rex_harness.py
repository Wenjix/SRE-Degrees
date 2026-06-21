"""Phase-1 harness: load the oom_kill scenario, dispatch a plan through the real
sim (sim/engine.py), gate each action via is_safe (stub), read resolved.
"""
from rex.harness import load_scenario, run_plan, is_safe

CANONICAL = {
    "root_cause": "per-process memory leak; OOMKilled on image-resizer",
    "actions": [
        {"tool": "increase_memory_limit", "args": {"target": "image-resizer", "mem_limit_mb": 1024}},
        {"tool": "restart_pod", "args": {"target": "image-resizer"}},
    ],
}
TRAP_ONLY = {
    "root_cause": "needs more replicas",
    "actions": [{"tool": "scale_deployment", "args": {"target": "image-resizer", "replicas": 6}}],
}


def test_load_oom_scenario_exposes_ground_truth():
    sc = load_scenario("oom_kill")
    assert sc.fault_node == "image-resizer"
    assert "increase_memory_limit" in sc.correct_fix_tools
    assert "restart_pod" in sc.correct_fix_tools
    traps = {t["tool"] for t in sc.trap_actions}
    assert "scale_deployment" in traps
    assert "clear_cache" in traps
    assert sc.category == "resource_exhaustion"


def test_prompt_shows_symptom_without_leaking_fix_or_root_kind():
    p = load_scenario("oom_kill").prompt_text.lower()
    assert "image-resizer" in p           # the agent must know what to target
    assert "oom" in p                     # the surface symptom is fair game
    assert "increase_memory_limit" not in p   # do NOT hand over the fix
    assert "restart_pod" not in p
    assert "mem_leak" not in p            # do NOT hand over the root-cause kind


def test_run_plan_canonical_fix_resolves():
    res = run_plan(CANONICAL, load_scenario("oom_kill"))
    assert res["root_cleared"] is True
    assert res["resolved"] is True
    assert res["blocked_actions"] == []


def test_run_plan_trap_only_does_not_resolve():
    res = run_plan(TRAP_ONLY, load_scenario("oom_kill"))
    assert res["resolved"] is False
    assert res["root_cleared"] is False


def test_is_safe_stub_allows_everything():
    ok, reason = is_safe({"tool": "drain_node", "args": {"target": "x"}}, {})
    assert ok is True
    assert reason == ""
