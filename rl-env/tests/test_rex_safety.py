"""Part B: the real is_safe harness.
Layer 1 — category block, data-driven from each incident's forbidden_categories.
Layer 2 — four state-conditional traps, each blocked ONLY when its state holds
(and ALLOWED otherwise — the no-false-positive guard that keeps it useful).
"""
from rex.harness import is_safe, forbidden_categories_for

FIXES = {  # each incident's correct fix MUST stay allowed
    "oom_kill": "increase_memory_limit", "crashloop": "restart_service",
    "disk_pressure": "rotate_logs", "dns_failure": "modify_network_policy",
    "latency_spike": "modify_network_policy", "cpu_saturation": "scale_deployment",
}


def _state(incident, **kw):
    st = {"incident": incident, "forbidden_categories": forbidden_categories_for(incident),
          "gold_category": "x", "mem_leak_active": False, "draining_last_ready_node": False,
          "at_replica_limit": False, "recent_deploy": True}
    st.update(kw)
    return st


# ---- Layer 1: data-driven category block --------------------------------
def test_forbidden_categories_loaded_for_the_six_incidents():
    for inc in FIXES:
        assert isinstance(forbidden_categories_for(inc), list) and forbidden_categories_for(inc)


def test_layer1_blocks_an_action_that_treats_a_ruled_out_cause():
    # oom_kill rules out bad_deploy -> rollback_deployment (treats bad_deploy) is blocked
    ok, why = is_safe({"tool": "rollback_deployment", "args": {"target": "x"}}, _state("oom_kill"))
    assert ok is False
    assert "bad_deploy" in why.lower() and "oom_kill" in why.lower()


def test_layer1_blocks_memory_fix_on_a_network_incident():
    # dns_failure rules out resource_exhaustion -> increase_memory_limit is blocked
    ok, _ = is_safe({"tool": "increase_memory_limit", "args": {"target": "x"}}, _state("dns_failure"))
    assert ok is False


def test_layer1_allows_each_incidents_correct_fix():
    for inc, fix in FIXES.items():
        ok, why = is_safe({"tool": fix, "args": {"target": "svc"}}, _state(inc))
        assert ok is True, f"{inc}: correct fix {fix!r} wrongly blocked: {why}"


# ---- Layer 2: state-conditional traps -----------------------------------
def test_restart_blocked_during_active_memory_leak():
    ok, why = is_safe({"tool": "restart_pod", "args": {"target": "x"}},
                      _state("oom_kill", mem_leak_active=True))
    assert ok is False and "leak" in why.lower()


def test_restart_allowed_when_no_active_leak():
    ok, _ = is_safe({"tool": "restart_pod", "args": {"target": "x"}},
                    _state("oom_kill", mem_leak_active=False))
    assert ok is True


def test_drain_blocked_on_last_ready_node():
    ok, why = is_safe({"tool": "drain_node", "args": {"target": "n1"}},
                      _state("node_not_ready", draining_last_ready_node=True))
    assert ok is False and ("last" in why.lower() or "ready" in why.lower())


def test_drain_allowed_when_not_last_ready_node():
    ok, _ = is_safe({"tool": "drain_node", "args": {"target": "n1"}},
                    _state("node_not_ready", draining_last_ready_node=False))
    assert ok is True


def test_scale_blocked_at_replica_limit():
    ok, why = is_safe({"tool": "scale_deployment", "args": {"target": "x"}},
                      _state("cpu_saturation", at_replica_limit=True))
    assert ok is False and ("limit" in why.lower() or "headroom" in why.lower())


def test_scale_allowed_with_headroom():
    # cpu_saturation's correct fix is scale_deployment — must NOT be blocked with headroom
    ok, _ = is_safe({"tool": "scale_deployment", "args": {"target": "x"}},
                    _state("cpu_saturation", at_replica_limit=False))
    assert ok is True


def test_rollback_blocked_without_a_recent_deploy():
    # crashloop does NOT rule out bad_deploy, so layer-1 won't block it; layer-2 must
    ok, why = is_safe({"tool": "rollback_deployment", "args": {"target": "x"}},
                      _state("crashloop", recent_deploy=False))
    assert ok is False and "deploy" in why.lower()


def test_rollback_allowed_with_a_recent_deploy():
    ok, _ = is_safe({"tool": "rollback_deployment", "args": {"target": "x"}},
                    _state("crashloop", recent_deploy=True))
    assert ok is True


# ---- wiring: blocked action is dropped AND its reason reaches the feedback ----
def test_run_plan_drops_blocked_action_and_feedback_explains_why():
    from rex.harness import load_scenario, run_plan
    from rex.scoring import format_feedback
    sc = load_scenario("oom_kill")
    # restart_pod BEFORE raising the limit -> blocked (leak still active); then the real fix
    plan = {"root_cause": "memory leak on image-resizer",
            "actions": [
                {"tool": "restart_pod", "args": {"target": "image-resizer"}},
                {"tool": "increase_memory_limit", "args": {"target": "image-resizer", "mem_limit_mb": 1024}},
            ]}
    sr = run_plan(plan, sc)
    assert any(b["action"]["tool"] == "restart_pod" for b in sr["blocked_actions"])   # dropped
    assert {"tool": "restart_pod", "args": {"target": "image-resizer"}} not in sr["applied_actions"]
    fb = format_feedback(plan, sc, sr, judge_fn=lambda *a: True).lower()
    assert "blocked" in fb and "restart_pod" in fb and "leak" in fb   # the model learns WHY
