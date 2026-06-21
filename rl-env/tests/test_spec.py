"""Smoke tests for the CIDG scenario spec loader/validator."""
import glob
import os

import pytest

from sim.spec import load_spec, validate

REPO = os.path.dirname(os.path.dirname(__file__))
SPECS = sorted(glob.glob(os.path.join(REPO, "scenarios", "cidg", "*.yaml")))


def test_specs_exist():
    assert SPECS, "no scenario specs found under scenarios/cidg/"


@pytest.mark.parametrize("path", SPECS, ids=[os.path.basename(p) for p in SPECS])
def test_spec_loads_and_validates(path):
    spec = load_spec(path)
    errs = validate(spec)
    assert not errs, f"{os.path.basename(path)} invalid:\n  " + "\n  ".join(errs)


def test_reference_spec_shape():
    spec = load_spec(os.path.join(REPO, "scenarios", "cidg", "01-gcp-service-control.yaml"))
    assert spec.id == "gcp-service-control"
    # cascade must be able to propagate: required/pool/queue edges present
    assert any(e.type in ("required", "pool", "queue") for e in spec.edges)
    # monitoring-degraded observability needs an 'observes' edge
    assert any(e.type == "observes" for e in spec.edges)
    # the trap and the canonical fix must use the SAME tool family (the trap is the
    # tempting version of the fix) — restart_service appears in both
    fix_tools = {a.tool for a in spec.canonical_fix.steps}
    trap_tools = {a.tool for a in spec.trap_actions}
    assert trap_tools & {"restart_service", "scale_deployment"}
    assert "modify_network_policy" in fix_tools  # disable-bad-path before restart
    # hysteresis must declare a reset tool
    assert spec.root_cause.persistent and spec.root_cause.reset_by
