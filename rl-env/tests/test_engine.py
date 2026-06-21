"""TDD tests for the CIDG Tier-A propagate engine.

The whole thesis is that cascades are EMERGENT from topology + propagate(), not
scripted. These tests pin that: the victim breaches only because the root broke;
the naive fix worsens; the correctly-ordered fix resolves; resolution is
root-cause-aware (not metric-masking).
"""
import os

from sim.spec import _spec_from_dict, load_spec

REPO = os.path.dirname(os.path.dirname(__file__))


def _required_chain():
    """caller --required--> dep. Fault lives on `dep`. SLO is on `caller` (the victim)."""
    return _spec_from_dict({
        "meta": {"id": "tiny-required"},
        "topology": {
            "nodes": [
                {"name": "caller", "kind": "service", "resources": {"replicas": 2}},
                {"name": "dep", "kind": "service", "resources": {"replicas": 2}},
            ],
            "edges": [{"from": "caller", "to": "dep", "type": "required",
                       "weight": 1.0, "latency_add_ms": 10}],
        },
        "root_cause": {"location": "dep", "kind": "cpu_starve", "severity": 0.9,
                       "hidden": True, "started_tick": 0},
        "fault": {"sim": {}},
        "slo": [{"metric": "error_rate_pct", "node": "caller",
                 "direction": "higher_bad", "threshold": 5, "sustain_ticks": 1}],
        "canonical_fix": {"steps": []},
        "assertions": {"cascades": True, "buried_gun_exists": False,
                       "loudest_alert_not_cause": True},
    })


def test_required_fault_cascades_only_because_root_broke():
    from sim.engine import World

    healthy = World.from_spec(_required_chain(), inject=False)
    healthy.run(ticks=10)
    faulted = World.from_spec(_required_chain(), inject=True)
    faulted.run(ticks=10)

    # control: with no fault, the victim is healthy
    assert healthy.metric("caller", "error_rate_pct") < 5
    # the root is broken
    assert faulted.metric("dep", "error_rate_pct") > 50
    # ...and the victim breached — EMERGENT cascade, not a scripted entry
    assert faulted.metric("caller", "error_rate_pct") > 5


def test_resolution_requires_clearing_the_root_not_just_metrics():
    from sim.engine import World, apply_action, is_resolved
    from sim.spec import Action

    w = World.from_spec(_required_chain(), inject=True)
    w.run(ticks=5)
    assert not is_resolved(w)                       # victim breached, root active

    # the causal remediation for cpu_starve on the ROOT clears it
    apply_action(w, Action("scale_deployment", {"target": "dep"}))
    w.run(ticks=5)
    assert w.metric("dep", "error_rate_pct") < 5
    assert w.metric("caller", "error_rate_pct") < 5
    assert is_resolved(w)                           # metrics under SLO AND root cleared


def test_wrong_target_does_not_resolve_even_if_it_is_the_right_tool():
    from sim.engine import World, apply_action, is_resolved
    from sim.spec import Action

    w = World.from_spec(_required_chain(), inject=True)
    w.run(ticks=5)
    # right tool (scale_deployment) but pointed at the VICTIM, not the root cause
    apply_action(w, Action("scale_deployment", {"target": "caller"}))
    w.run(ticks=5)
    assert not is_resolved(w)                       # root still faulted -> not resolved


def test_real_gcp_spec_cascades_to_a_product_victim():
    from sim.engine import World

    spec = load_spec(os.path.join(REPO, "scenarios", "cidg", "01-gcp-service-control.yaml"))
    w = World.from_spec(spec, inject=True)
    w.run(ticks=10)
    # the control plane is the root
    assert w.metric("service-control", "error_rate_pct") > 50
    # the cascade reaches a downstream PRODUCT victim via discovery + required edges,
    # i.e. the loudest alerts land on a victim, not the cause
    assert w.metric("workspace", "error_rate_pct") > 5
    assert w.metric("compute-api", "error_rate_pct") > 5
