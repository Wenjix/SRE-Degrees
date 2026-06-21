"""HUD v6 environment — incident root-cause diagnosis over the opensre corpus.

The 300-scenario corpus (out/trajectories.jsonl) becomes an interactive
investigation env: the agent reads evidence through 8 diagnostic MCP tools, then
states a root cause + category + fix. Graded on substance (category match,
evidence keywords, ruling out red herrings, correct remediation) — not shape.

Local test:   .venv-hud/bin/hud eval hud_env.py claude --model claude-haiku-4-5
Scale:        see run_models.py (spanning set across providers, group= for spread)
"""
import asyncio
import contextlib
import json
import re
import socket
from pathlib import Path

from fastmcp import FastMCP
from hud import Environment
from hud.capabilities import Capability
from hud.graders import SubScore, combine

HERE = Path(__file__).resolve().parent
CORPUS = HERE / "out" / "trajectories.jsonl"

CATEGORIES = ["resource_exhaustion", "bad_deploy", "dependency_failure", "network_fault",
              "config_error", "data_quality", "saturation", "node_failure", "healthy", "unknown"]

# tool name -> evidence file it returns
TOOL_EVIDENCE = {
    "describe_pod": "k8s_pods.json", "get_events": "k8s_events.json",
    "get_logs": "k8s_pod_logs.json", "get_node_status": "k8s_node_health.json",
    "get_deployment_status": "k8s_deployments.json", "get_metrics": "prometheus_metrics.json",
    "get_alerts": "prometheus_alerts.json", "query_traces": "traces.json",
}


def _load():
    recs = {}
    if CORPUS.exists():
        for line in open(CORPUS):
            line = line.strip()
            if line:
                r = json.loads(line)
                recs[r["scenario_id"]] = r
    return recs


SCENARIOS = _load()
_ACTIVE = {"rec": None}  # the scenario this rollout's tools serve (one rollout = one subprocess)


def _ev(name):
    rec = _ACTIVE["rec"] or {}
    return rec.get("evidence", {}).get(name, {"note": f"{name} not available for this incident"})


server = FastMCP(name="incident-tools")
env = Environment(name="cidg-incident")
_srv_task = None


@server.tool
async def describe_pod(service_id: str = "", namespace: str = "") -> str:
    """Pod status for the service: phase, container restart counts, current/last
    container state (e.g. CrashLoopBackOff, OOMKilled, exit codes), and conditions."""
    return json.dumps(_ev("k8s_pods.json"), indent=2)


@server.tool
async def get_events(namespace: str = "") -> str:
    """Recent Kubernetes events in the namespace (Warning + Normal): BackOff, OOMKilled,
    FailedScheduling, Unhealthy probes, image pulls, scaling, rollouts."""
    return json.dumps(_ev("k8s_events.json"), indent=2)


@server.tool
async def get_logs(service_id: str = "") -> str:
    """Most recent application and kernel log lines from the service's pod."""
    return json.dumps(_ev("k8s_pod_logs.json"), indent=2)


@server.tool
async def get_node_status() -> str:
    """Node health for the cluster: Ready / MemoryPressure / DiskPressure / PIDPressure
    conditions, schedulability (cordon), and OS image."""
    return json.dumps(_ev("k8s_node_health.json"), indent=2)


@server.tool
async def get_deployment_status(service_id: str = "") -> str:
    """Deployment rollout state: desired/available/updated/unavailable replicas, the
    current image, and progress conditions."""
    return json.dumps(_ev("k8s_deployments.json"), indent=2)


@server.tool
async def get_metrics(service_id: str = "") -> str:
    """Current Prometheus metric values for the service (cpu/memory utilization, p99
    latency, error rate, cache hit ratio, connection pool, consumer lag, etc.)."""
    return json.dumps(_ev("prometheus_metrics.json"), indent=2)


@server.tool
async def get_alerts() -> str:
    """Currently firing Prometheus / Alertmanager alerts across the cluster."""
    return json.dumps(_ev("prometheus_alerts.json"), indent=2)


@server.tool
async def query_traces(service_id: str = "") -> str:
    """Distributed-trace spans for the service: per-dependency latency breakdown and
    error attribution across the call path."""
    return json.dumps(_ev("traces.json"), indent=2)


@env.initialize
async def _start():
    global _srv_task
    if _srv_task is None:
        s = socket.socket(); s.bind(("", 0)); port = s.getsockname()[1]; s.close()
        _srv_task = asyncio.create_task(
            server.run_async(transport="http", host="127.0.0.1", port=port, show_banner=False))
        await asyncio.sleep(0.4)
        env.add_capability(Capability.mcp(name="tools", url=f"http://127.0.0.1:{port}/mcp"))


@env.shutdown
async def _stop():
    global _srv_task
    if _srv_task is not None:
        _srv_task.cancel()
        with contextlib.suppress(Exception):
            await _srv_task
        _srv_task = None


PROMPT = """You are the on-call SRE. The alert below just fired. Investigate with the available
tools — describe_pod, get_events, get_logs, get_node_status, get_deployment_status,
get_metrics, get_alerts, query_traces — reading enough evidence to distinguish the true
root cause from look-alikes. Then report EXACTLY:

ROOT_CAUSE: <1-2 sentences: the specific failing component and the mechanism>
ROOT_CAUSE_CATEGORY: <one of: {cats}>
FIX: <the single remediation action you would run>

ALERT:
{alert}
"""


def _redact_alert(alert):
    """Drop fields that would leak the conclusion (doctrine: keep the answer out)."""
    a = json.loads(json.dumps(alert))
    a.get("commonAnnotations", {}).pop("k8s_failure_mode", None)
    return a


def _kw_hit(k, ans):
    """Substance match: exact substring, or (for multi-word keywords) all significant
    words present — so 'memory limit' matches '...512Mi cgroup limit... memory...' but a
    keyword still requires the real terms, not just the shape."""
    k = k.lower().strip()
    if k in ans:
        return True
    words = [w for w in re.split(r"[\s_\-]+", k) if len(w) > 2]
    return len(words) > 1 and all(w in ans for w in words)


def _parse_category(ans):
    m = re.search(r"root[_ ]cause[_ ]category[\s:*\-]+([a-z_]+)", ans)
    if m:
        for c in CATEGORIES:
            if c in m.group(1):
                return c
    found = [c for c in CATEGORIES if c in ans]
    return found[-1] if found else None


async def _grade(answer, rec):
    ans = (answer or "").lower()
    a = rec.get("answer", {})
    rem = rec.get("remediation", {})
    true_cat = a.get("root_cause_category")
    forbidden = set(a.get("forbidden_categories", []))

    stated = _parse_category(ans)
    cat_val = 1.0 if stated == true_cat else (0.0 if stated in forbidden else 0.15 if stated else 0.0)

    kws = [k for k in a.get("required_keywords", []) if k]
    kw_val = sum(1 for k in kws if _kw_hit(k, ans)) / len(kws) if kws else 0.0

    ro = [k for k in a.get("ruling_out_keywords", []) if k]
    ro_val = sum(1 for k in ro if _kw_hit(k, ans)) / len(ro) if ro else 0.0

    fix = (rem.get("fix_tool") or "").lower()
    rem_val = 1.0 if fix and fix in ans else 0.0

    return await combine(
        SubScore(name="root_cause_category", weight=0.45, value=cat_val,
                 metadata={"true": true_cat, "stated": stated}),
        SubScore(name="evidence_keywords", weight=0.30, value=kw_val),
        SubScore(name="ruled_out_red_herrings", weight=0.10, value=ro_val),
        SubScore(name="remediation_tool", weight=0.15, value=rem_val,
                 metadata={"expected": fix}),
    )


@env.template()
async def investigate(scenario_id: str = "001-oom_kill"):
    rec = SCENARIOS.get(scenario_id)
    if rec is None:
        raise KeyError(f"unknown scenario_id {scenario_id!r} (have {len(SCENARIOS)})")
    _ACTIVE["rec"] = rec
    alert = json.dumps(_redact_alert(rec["alert"]), indent=2)
    answer = yield PROMPT.format(cats=", ".join(CATEGORIES), alert=alert)
    yield await _grade(answer, rec)


def canonical_ids():
    """The 15 seed-0 scenarios (one per incident), in registry order."""
    return sorted(sid for sid in SCENARIOS if not re.search(r"-s\d+$", sid))


# `hud eval hud_env.py <model>` runs this module-level list (one task per incident).
tasks = [investigate(scenario_id=i) for i in canonical_ids()]
