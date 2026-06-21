"""Shared helpers for the opensre-standard trajectory generator.

A "spec pack" (specs/<incident>.json) is an incident template with {{PLACEHOLDER}}
tokens. We render N concrete variants per incident by filling placeholders with
deterministic, realistic GKE-style identifiers, then emit:
  - an opensre scenario folder (alert.json + scenario.yml + <evidence>.json + answer.yml)
  - a flattened JSONL record carrying a FIREBALL-style trajectory[].
"""
import hashlib

# read-tool -> evidence filename (must match SCHEMA.md)
TOOL_EVIDENCE = {
    "describe_pod": "k8s_pods.json",
    "get_pods": "k8s_pods.json",
    "get_events": "k8s_events.json",
    "get_logs": "k8s_pod_logs.json",
    "get_node_status": "k8s_node_health.json",
    "get_deployment_status": "k8s_deployments.json",
    "get_metrics": "prometheus_metrics.json",
    "get_alerts": "prometheus_alerts.json",
    "query_traces": "traces.json",
}

_K8S_HASH = "bcdfghjklmnpqrstvwxz2456789"  # chars k8s uses in pod/replicaset hashes


def _digest(s):
    return hashlib.sha256(s.encode()).digest()


def _hash_str(seed, n):
    return "".join(_K8S_HASH[b % len(_K8S_HASH)] for b in _digest(seed)[:n])


def subst_map(spec, incident, seed):
    """Deterministic placeholder values for one (incident, seed) variant.

    seed 0 uses the pack's placeholder_defaults verbatim (the canonical scenario);
    seeds > 0 vary pod hashes / node names / cluster so each variant is distinct
    but realistic. Service/namespace/workload stay the incident's canonical ones.
    """
    d = dict(spec.get("placeholder_defaults", {}))
    svc = d.get("SVC") or incident.replace("_", "-")
    ns = d.get("NS") or svc
    wl = d.get("WORKLOAD") or svc
    if seed == 0:
        m = {k: d.get(k, "") for k in
             ("SVC", "NS", "WORKLOAD", "POD", "POD2", "POD3", "NODE", "NODE2", "NODE3", "CLUSTER")}
        m["SVC"], m["NS"], m["WORKLOAD"] = svc, ns, wl
        # fill any missing identifiers even for seed 0
    else:
        m = {"SVC": svc, "NS": ns, "WORKLOAD": wl}
    rh = _hash_str(f"{incident}:{seed}:{wl}", 10)
    for i, key in enumerate(("POD", "POD2", "POD3")):
        if not m.get(key):
            m[key] = f"{wl}-{rh}-{_hash_str(f'{incident}:{seed}:pod{i}', 5)}"
    npool = _hash_str(f"{incident}:{seed}:pool", 8)
    for i, key in enumerate(("NODE", "NODE2", "NODE3")):
        if not m.get(key):
            m[key] = f"gke-{d.get('CLUSTER','prod')}-default-pool-{npool}-{_hash_str(f'{incident}:{seed}:n{i}', 4)}"
    if not m.get("CLUSTER"):
        m["CLUSTER"] = d.get("CLUSTER") or "prod-gke"
    return m


def substitute(obj, m):
    """Recursively replace {{TOKEN}} in all strings of a JSON-like object."""
    if isinstance(obj, str):
        for k, v in m.items():
            obj = obj.replace("{{" + k + "}}", str(v))
        return obj
    if isinstance(obj, dict):
        return {substitute(k, m): substitute(v, m) for k, v in obj.items()}
    if isinstance(obj, list):
        return [substitute(x, m) for x in obj]
    return obj


def render_trajectory(spec, m):
    """Build a FIREBALL-style alternating assistant/tool trajectory:
    optimal_trajectory reads -> remediation fix -> end_incident.
    """
    ans = spec.get("answer", {})
    rem = spec.get("remediation", {})
    svc, ns = m["SVC"], m["NS"]
    steps, n = [], 0

    def asst(thought, tool, args, **extra):
        nonlocal n
        n += 1
        steps.append({"step": n, "role": "assistant", "thought": thought,
                      "action": {"tool": tool, "args": args, **extra}})

    def tool(name, result):
        nonlocal n
        n += 1
        steps.append({"step": n, "role": "tool", "name": name, "result": result})

    for i, t in enumerate(ans.get("optimal_trajectory", [])):
        ev = TOOL_EVIDENCE.get(t, "evidence.json")
        thought = ("Triage the alert by reading the highest-signal source first."
                   if i == 0 else f"Corroborate with {t} before concluding.")
        asst(thought, t, {"service_id": svc, "namespace": ns})
        tool(t, {"success": True, "notes": f"returned {ev}", "evidence_ref": ev})

    metric = rem.get("primary_metric", "")
    before = rem.get("state_before", {})
    after = rem.get("state_after", {})
    fix_tool = rem.get("fix_tool", "restart_pod")
    asst(f"Root cause is {ans.get('root_cause_category','identified')}; applying the canonical fix.",
         fix_tool, {"service_id": svc, "namespace": ns},
         requires_approval=rem.get("trust_tier") != "autonomous")
    tool(fix_tool, {"success": True,
                    "state_diff": {k: {"before": before.get(k), "after": after.get(k)}
                                   for k in (before or {})} or {metric: {"before": None, "after": None}}})

    asst(f"{metric or 'metric'} back under SLO; closing the incident.",
         "end_incident", {"service_id": svc})
    tool("end_incident", {"success": True, "notes": "incident closed"})
    return steps
