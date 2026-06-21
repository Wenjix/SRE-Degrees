"""CIDG scenario spec — the single source of truth for both the Tier-A fast sim
and the live cloud mesh (LKE + GKE).

A scenario is a declarative topology + an injected root cause + the canonical fix.
Cascades, misleading symptoms, and worsening-naive-fixes are NOT authored here — the
engine DERIVES them from `topology` + `root_cause` + `propagate()`. The optional
`assertions` block states which emergent properties must hold; tooling fails loudly if
the engine does not produce them (see docs/ENVIRONMENT_DESIGN.md §9).

Usage:
    python -m sim.spec validate scenarios/cidg/*.yaml
"""
from __future__ import annotations

import dataclasses as dc
import glob as _glob
import json
import os
import sys
from dataclasses import dataclass, field
from typing import Any, Optional

import yaml

# ---------------------------------------------------------------------------
# Closed vocabularies (validation rejects anything outside these)
# ---------------------------------------------------------------------------
NODE_KINDS = {
    "service", "datastore", "cache", "queue", "pool",
    "control_plane", "monitoring", "node", "lb", "external",
}

# Edge semantics drive propagate(): see docs/ENVIRONMENT_DESIGN.md §5.
EDGE_TYPES = {
    "required",    # error-multiply + latency-add along the chain (hard cascade)
    "optional",    # fallback at higher cost (graceful degradation; clear_cache can worsen)
    "pool",        # shared finite resource; Σ demand > pool_size throttles ALL sharers
    "queue",       # async backpressure; lag integrates
    "discovery",   # service -> control-plane (Consul/quota/service-control)
    "observes",    # monitoring -> data-plane (degrades observation when in blast radius)
}

# Root-cause kinds = the closed vocab the imputation/particle-filter enumerates.
ROOT_CAUSE_KINDS = {
    "cpu_starve", "mem_leak", "pool_leak", "thread_exhaust", "fd_exhaust",
    "churn_spike", "config_bloat", "bad_content", "bad_revision",
    "cert_expire", "cache_flush", "disk_fill", "node_notready",
    "net_delay", "dns_race", "dep_revoked", "defense_amplify", "host_agent_crash",
}

SLO_DIRECTIONS = {"higher_bad", "lower_bad"}


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass
class Resources:
    replicas: int = 1
    cpu_quota: Optional[float] = None       # cores
    mem_limit_mb: Optional[float] = None
    pool_size: Optional[int] = None         # for kind=pool / shared finite resource
    thread_limit: Optional[int] = None      # OS thread ceiling (Kinesis-style cap)
    fd_limit: Optional[int] = None
    extra: dict = field(default_factory=dict)


@dataclass
class Node:
    name: str
    kind: str
    resources: Resources = field(default_factory=Resources)
    limits: dict = field(default_factory=dict)     # named hard caps the root_cause can trip
    labels: dict = field(default_factory=dict)


@dataclass
class Edge:
    src: str
    dst: str
    type: str
    weight: float = 1.0
    latency_add_ms: float = 0.0
    timeout_ms: Optional[float] = None
    retry: float = 0.0              # retry amplification factor (positive feedback)
    fallback_quality: float = 0.0   # for optional edges: 0=no fallback, 1=perfect


@dataclass
class RateLaw:
    """How a hidden latent counter integrates over ticks toward a hard cap.
    The tempting fix typically pushes `var` the WRONG way (see worsen semantics)."""
    var: str                        # e.g. os_thread_count, boltdb_freelist, feature_file_bytes
    per_tick: float = 0.0           # base integration rate while the fault is active
    driver: Optional[str] = None    # metric whose level scales integration (e.g. request_rate)
    driver_gain: float = 0.0
    cap: Optional[float] = None      # crossing this trips the discontinuous failure region
    worsened_by: list = field(default_factory=list)  # tools that push `var` toward the cap


@dataclass
class RootCause:
    location: str                   # node name, or "A->B" for an edge
    kind: str
    rate_law: Optional[RateLaw] = None
    hidden: bool = True
    started_tick: int = 0
    severity: float = 0.6
    # hysteresis: once the cap is crossed, damage persists; the upstream-correct fix
    # alone does NOT restore SLO without a counter-reset action (e.g. restart).
    persistent: bool = False
    reset_by: list = field(default_factory=list)   # tools that reset the latent counter
    params: dict = field(default_factory=dict)


@dataclass
class Fault:
    """How the root cause is injected. `chaos_*` drives the live cloud mesh;
    `sim` drives Tier-A."""
    chaos_kind: Optional[str] = None    # stresschaos | networkchaos | podchaos | exec | ...
    chaos_yaml: Optional[str] = None
    exec_cmd: Optional[str] = None
    sim: dict = field(default_factory=dict)
    duration_s: int = 90


@dataclass
class SmokingGun:
    """The discriminating evidence: it EXISTS but needs the right read to surface."""
    tool: str                       # e.g. get_logs, query_traces
    node: str
    signature: str                  # substring/pattern the agent must find
    buried_under: int = 0           # how many noise lines/alerts it's buried under


@dataclass
class Observation:
    alerting: str = "uniform"       # uniform alerting over the metric vector (emergent loudness)
    monitoring_degrades: bool = False
    smoking_guns: list = field(default_factory=list)  # list[SmokingGun]


@dataclass
class Action:
    tool: str
    args: dict = field(default_factory=dict)


@dataclass
class Fix:
    steps: list = field(default_factory=list)   # list[Action], order matters
    ordering_notes: str = ""


@dataclass
class SLO:
    metric: str
    direction: str                  # higher_bad | lower_bad
    threshold: float
    node: Optional[str] = None      # the node whose metric must recover (None = primary victim)
    sustain_ticks: int = 3


@dataclass
class Assertions:
    cascades: bool = True
    loudest_alert_not_cause: bool = True
    fix_resolves: bool = True
    buried_gun_exists: bool = True
    hysteresis: bool = False
    monitoring_degrades: bool = False


@dataclass
class Chance:
    flap_prob: float = 0.0
    jitter: float = 0.0
    partial_recovery_prob: float = 0.0


@dataclass
class ScenarioSpec:
    meta: dict                      # id, title, source, urls, failure_class, clouds[]
    nodes: list                     # list[Node]
    edges: list                     # list[Edge]
    root_cause: RootCause
    fault: Fault
    slo: list                       # list[SLO]
    canonical_fix: Fix
    observation: Observation = field(default_factory=Observation)
    trap_actions: list = field(default_factory=list)   # list[Action] (intended, for tests)
    paired_positive: Optional[str] = None              # id of a sibling where the trap tool is CORRECT
    assertions: Assertions = field(default_factory=Assertions)
    chance: Chance = field(default_factory=Chance)
    seed: int = 0

    @property
    def id(self) -> str:
        return self.meta.get("id", "unknown")

    def node(self, name: str) -> Optional[Node]:
        return next((n for n in self.nodes if n.name == name), None)


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------
def _build(cls, d: Any):
    """Recursively build a (possibly nested) dataclass from a dict, tolerating
    extra/missing keys for forward-compat."""
    if d is None:
        return None
    fields = {f.name: f for f in dc.fields(cls)}
    kwargs = {}
    for k, v in (d.items() if isinstance(d, dict) else []):
        if k not in fields:
            continue  # ignore unknown keys (forward-compat); validate() flags structure
        kwargs[k] = v
    return cls(**kwargs)


def _spec_from_dict(d: dict) -> ScenarioSpec:
    nodes = []
    for nd in d.get("topology", {}).get("nodes", []):
        res = _build(Resources, nd.get("resources", {})) or Resources()
        nodes.append(Node(
            name=nd["name"], kind=nd.get("kind", "service"), resources=res,
            limits=nd.get("limits", {}), labels=nd.get("labels", {}),
        ))
    edges = []
    for ed in d.get("topology", {}).get("edges", []):
        edges.append(Edge(
            src=ed["from"], dst=ed["to"], type=ed["type"],
            weight=ed.get("weight", 1.0), latency_add_ms=ed.get("latency_add_ms", 0.0),
            timeout_ms=ed.get("timeout_ms"), retry=ed.get("retry", 0.0),
            fallback_quality=ed.get("fallback_quality", 0.0),
        ))
    rc_d = d["root_cause"]
    rc = RootCause(
        location=rc_d["location"], kind=rc_d["kind"],
        rate_law=_build(RateLaw, rc_d.get("rate_law")),
        hidden=rc_d.get("hidden", True), started_tick=rc_d.get("started_tick", 0),
        severity=rc_d.get("severity", 0.6), persistent=rc_d.get("persistent", False),
        reset_by=rc_d.get("reset_by", []), params=rc_d.get("params", {}),
    )
    obs_d = d.get("observation", {})
    obs = Observation(
        alerting=obs_d.get("alerting", "uniform"),
        monitoring_degrades=obs_d.get("monitoring_degrades", False),
        smoking_guns=[_build(SmokingGun, g) for g in obs_d.get("smoking_guns", [])],
    )
    fix = Fix(
        steps=[_build(Action, a) for a in d.get("canonical_fix", {}).get("steps", [])],
        ordering_notes=d.get("canonical_fix", {}).get("ordering_notes", ""),
    )
    return ScenarioSpec(
        meta=d["meta"],
        nodes=nodes, edges=edges, root_cause=rc, fault=_build(Fault, d["fault"]),
        slo=[_build(SLO, s) for s in d["slo"]],
        canonical_fix=fix, observation=obs,
        trap_actions=[_build(Action, a) for a in d.get("trap_actions", [])],
        paired_positive=d.get("paired_positive"),
        assertions=_build(Assertions, d.get("assertions", {})) or Assertions(),
        chance=_build(Chance, d.get("chance", {})) or Chance(),
        seed=d.get("seed", 0),
    )


def load_spec(path: str) -> ScenarioSpec:
    with open(path) as f:
        return _spec_from_dict(yaml.safe_load(f))


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def _tool_names() -> set:
    """Tool registry is the action space; canonical_fix/trap tools must be in it."""
    reg = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tools_registry.json")
    try:
        with open(reg) as f:
            return {t["name"] for t in json.load(f)}
    except (OSError, ValueError):
        return set()


def validate(spec: ScenarioSpec) -> list:
    """Return a list of human-readable errors ([] means valid)."""
    errs: list = []
    names = [n.name for n in spec.nodes]
    if len(names) != len(set(names)):
        errs.append("duplicate node names")
    nameset = set(names)

    for n in spec.nodes:
        if n.kind not in NODE_KINDS:
            errs.append(f"node {n.name!r}: unknown kind {n.kind!r} (allowed: {sorted(NODE_KINDS)})")

    for e in spec.edges:
        if e.type not in EDGE_TYPES:
            errs.append(f"edge {e.src}->{e.dst}: unknown type {e.type!r} (allowed: {sorted(EDGE_TYPES)})")
        if e.src not in nameset:
            errs.append(f"edge {e.src}->{e.dst}: src not a node")
        if e.dst not in nameset:
            errs.append(f"edge {e.src}->{e.dst}: dst not a node")
        if e.type == "pool":
            dst = spec.node(e.dst)
            if dst and dst.resources.pool_size is None:
                errs.append(f"pool edge ->{e.dst}: target has no resources.pool_size")

    rc = spec.root_cause
    if rc.kind not in ROOT_CAUSE_KINDS:
        errs.append(f"root_cause.kind {rc.kind!r} not in closed vocab {sorted(ROOT_CAUSE_KINDS)}")
    loc = rc.location
    if "->" in loc:
        a, b = (x.strip() for x in loc.split("->", 1))
        if a not in nameset or b not in nameset:
            errs.append(f"root_cause.location edge {loc!r} references unknown node(s)")
    elif loc not in nameset:
        errs.append(f"root_cause.location {loc!r} is not a node or edge")
    if rc.persistent and not rc.reset_by:
        errs.append("root_cause.persistent=true but reset_by is empty (hysteresis needs a reset tool)")

    if not spec.slo:
        errs.append("no SLO defined")
    for s in spec.slo:
        if s.direction not in SLO_DIRECTIONS:
            errs.append(f"slo {s.metric!r}: bad direction {s.direction!r}")
        if s.node and s.node not in nameset:
            errs.append(f"slo {s.metric!r}: node {s.node!r} not in topology")

    tools = _tool_names()
    if tools:
        for a in spec.canonical_fix.steps:
            if a.tool not in tools:
                errs.append(f"canonical_fix: tool {a.tool!r} not in tools_registry.json")
        for a in spec.trap_actions:
            if a.tool not in tools:
                errs.append(f"trap_action: tool {a.tool!r} not in tools_registry.json")

    for g in spec.observation.smoking_guns:
        if g and g.node not in nameset:
            errs.append(f"smoking_gun: node {g.node!r} not in topology")

    # Structural faithfulness pre-checks (the engine re-checks emergently at run time).
    if spec.assertions.cascades:
        hard = [e for e in spec.edges if e.type in ("required", "pool", "queue")]
        if not hard:
            errs.append("assertions.cascades=true but no required/pool/queue edges to propagate through")
    if spec.assertions.monitoring_degrades and not any(e.type == "observes" for e in spec.edges):
        errs.append("assertions.monitoring_degrades=true but no 'observes' edge in topology")
    if spec.assertions.buried_gun_exists and not spec.observation.smoking_guns:
        errs.append("assertions.buried_gun_exists=true but no observation.smoking_guns defined")

    return errs


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def _main(argv: list) -> int:
    if len(argv) < 2 or argv[0] != "validate":
        print("usage: python -m sim.spec validate <glob...>", file=sys.stderr)
        return 2
    paths: list = []
    for pat in argv[1:]:
        paths.extend(sorted(_glob.glob(pat)))
    if not paths:
        print("no files matched", file=sys.stderr)
        return 2
    bad = 0
    for p in paths:
        try:
            spec = load_spec(p)
            errs = validate(spec)
        except Exception as e:  # noqa: BLE001 — surface any load error per-file
            print(f"FAIL  {p}: load error: {e}")
            bad += 1
            continue
        if errs:
            bad += 1
            print(f"FAIL  {p}  [{spec.id}]")
            for e in errs:
                print(f"        - {e}")
        else:
            print(f"OK    {p}  [{spec.id}]  "
                  f"{len(spec.nodes)} nodes / {len(spec.edges)} edges / "
                  f"rc={spec.root_cause.kind}")
    print(f"\n{len(paths) - bad}/{len(paths)} specs valid")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
