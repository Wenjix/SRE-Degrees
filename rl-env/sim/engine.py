"""CIDG Tier-A engine — the ground-truth simulator.

ONE transition kernel `propagate()` over a typed dependency graph makes cascades
emergent. State is the graph; metrics are FUNCTIONS of (hidden fault + topology),
never set directly. See docs/ENVIRONMENT_DESIGN.md §4-5.

This module is grown strictly test-first (tests/test_engine.py).
"""
from __future__ import annotations

from sim.spec import Action, ScenarioSpec

# Edge types through which a dependency's degradation reaches its caller.
_DEP_TYPES = {"required", "discovery", "pool", "queue"}

# Causal remediation: which tools actually clear each root-cause kind. This is the
# engine's "physics" of what fixes what — NOT read from the spec's answer key, so a
# right-tool/wrong-target or a tempting-but-wrong tool genuinely fails to resolve.
# (Tools that WORSEN a kind live in the spec's root_cause.rate_law.worsened_by.)
REMEDIATION = {
    "cpu_starve":     {"scale_deployment", "increase_memory_limit"},
    "mem_leak":       {"increase_memory_limit", "restart_pod", "restart_service"},
    "pool_leak":      {"restart_service", "restart_pod"},
    "fd_exhaust":     {"restart_service", "restart_pod"},
    "thread_exhaust": {"rollback_deployment", "restart_service"},  # NB: scaling worsens this
    "churn_spike":    {"modify_network_policy", "restart_service"},
    "config_bloat":   {"modify_network_policy", "restart_service"},
    "bad_content":    {"rollback_deployment"},
    "bad_revision":   {"rollback_deployment"},
    "cert_expire":    {"renew_certificate"},
    "cache_flush":    {"clear_cache"},
    "disk_fill":      {"rotate_logs", "restart_pod"},
    "node_notready":  {"cordon_node", "drain_node"},
    "net_delay":      {"modify_network_policy"},
    "dns_race":       {"modify_network_policy", "restart_service"},
    "dep_revoked":    {"modify_network_policy", "restart_service", "failover_service"},
    "defense_amplify": {"modify_network_policy", "scale_deployment"},
    "host_agent_crash": {"rollback_deployment"},
}


def _dep_order(spec: ScenarioSpec) -> list:
    """Return node names so every dependency precedes the node that depends on it
    (deps first). `src` depends on `dst` for dependency-bearing edge types."""
    deps = {n.name: [] for n in spec.nodes}
    for e in spec.edges:
        if e.type in _DEP_TYPES and e.src in deps and e.dst in deps:
            deps[e.src].append(e.dst)
    order, seen, temp = [], set(), set()

    def visit(n: str):
        if n in seen or n in temp:   # temp guard breaks cycles (handled properly later)
            return
        temp.add(n)
        for d in deps[n]:
            visit(d)
        temp.discard(n)
        seen.add(n)
        order.append(n)

    for n in deps:
        visit(n)
    return order


class World:
    """A live episode: the graph + per-node metric vectors + the hidden fault."""

    def __init__(self, spec: ScenarioSpec, inject: bool = True):
        self.spec = spec
        self.tick = 0
        self.nodes = {n.name: {"error_rate_pct": 0.0, "p99_latency_ms": 50.0}
                      for n in spec.nodes}
        self.own_error = {n.name: 0.0 for n in spec.nodes}
        rc = spec.root_cause
        loc = rc.location.split("->")[0].strip() if "->" in rc.location else rc.location
        self._fault_node = loc
        if inject:
            self.own_error[loc] = rc.severity
        self._order = _dep_order(spec)
        # required + discovery both propagate error/latency to the dependent: if a
        # required dep or the control plane you discover through is down, you're down.
        self._error_edges = [e for e in spec.edges if e.type in ("required", "discovery")]
        self.propagate()

    @classmethod
    def from_spec(cls, spec: ScenarioSpec, inject: bool = True) -> "World":
        return cls(spec, inject)

    def metric(self, node: str, key: str) -> float:
        return self.nodes[node][key]

    def run(self, ticks: int = 1) -> "World":
        for _ in range(ticks):
            self.tick += 1
            self.propagate()
        return self

    def propagate(self) -> None:
        """Recompute every node's metrics from its own fault + its required deps,
        in dependency order. error multiplies through required chains; latency adds."""
        for name in self._order:
            survival = 1.0 - self.own_error[name]
            latency = 50.0
            for e in self._error_edges:
                if e.src != name:
                    continue
                dep_err = self.nodes[e.dst]["error_rate_pct"] / 100.0
                survival *= (1.0 - dep_err * e.weight)
                latency += self.nodes[e.dst]["p99_latency_ms"] * e.weight + e.latency_add_ms
            self.nodes[name]["error_rate_pct"] = 100.0 * (1.0 - survival)
            self.nodes[name]["p99_latency_ms"] = latency

    # -- ground-truth predicates ------------------------------------------------
    @property
    def root_cleared(self) -> bool:
        return self.own_error[self._fault_node] == 0.0


def apply_action(world: World, action: Action) -> None:
    """Apply a remediation. The root cause is cleared ONLY by a tool that causally
    fixes its kind AND targets the root node — right-tool/wrong-target does nothing."""
    kind = world.spec.root_cause.kind
    target = action.args.get("target")
    if action.tool in REMEDIATION.get(kind, set()) and target == world._fault_node:
        world.own_error[world._fault_node] = 0.0
    world.propagate()


def _slo_ok(world: World) -> bool:
    # first SLO that names a node is the primary victim; avoids self.nodes[None] KeyError
    primary = next((s.node for s in world.spec.slo if s.node), None)
    for s in world.spec.slo:
        node = s.node or primary
        val = world.metric(node, s.metric)
        if s.direction == "higher_bad" and val >= s.threshold:
            return False
        if s.direction == "lower_bad" and val <= s.threshold:
            return False
    return True


def is_resolved(world: World) -> bool:
    """Root-cause-aware: SLOs back under threshold AND the hidden root is cleared.
    Metric-masking (green metrics, root still active) does NOT count as resolved."""
    return world.root_cleared and _slo_ok(world)
