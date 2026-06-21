#!/usr/bin/env python3
"""capture_live.py — snapshot REAL evidence from the live GKE bench into the
opensre scenario format (the "live-verified" anchors).

For each incident it: injects the registry fault, waits, snapshots real cluster
evidence (kubectl pods/events/logs/nodes/deployments + Prometheus metrics/alerts)
in opensre shape, writes out/live/k8s/<NNN>-<incident>/, then cleans up (runs the
registry fix). Diagnosis ground truth (answer.yml) is taken from the spec pack.

Requires: KUBECONFIG set to the bench cluster (source gcp-bench/env.sh first).

  python3 capture_live.py crashloop node_not_ready oom_kill
"""
import argparse
import glob
import json
import os
import subprocess
import sys
import time
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from generate import dump_yaml, ORDER  # noqa: E402

REGISTRY = "/Users/mei/rl/gcp-bench/scenarios/registry.json"
NS = os.environ.get("NS_TARGET", "rlvr-target")
MON = os.environ.get("NS_MON", "monitoring")
PROM = (f"/api/v1/namespaces/{MON}/services/kube-prometheus-stack-prometheus:9090"
        f"/proxy/api/v1/query")
AM = (f"/api/v1/namespaces/{MON}/services/kube-prometheus-stack-alertmanager:9093"
      f"/proxy/api/v2/alerts")


def kc(*args, check=False):
    return subprocess.run(["kubectl", *args], capture_output=True, text=True, check=check)


def kjson(*args):
    r = kc(*args)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"_raw": r.stdout[:2000], "_err": r.stderr[:500]}


def prom(q):
    r = kc("get", "--raw", f"{PROM}?query={urllib.parse.quote(q)}")
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"status": "error"}


def get_scenario(incident):
    d = json.load(open(REGISTRY))
    for s in d["scenarios"]:
        if s["incident"] == incident:
            return s
    sys.exit(f"unknown incident {incident}")


def load_spec(incident):
    p = os.path.join(HERE, "specs", f"{incident}.json")
    return json.load(open(p)) if os.path.exists(p) else {}


def snapshot(svc):
    """Real cluster evidence for service `svc` in the bench namespace, opensre-shaped."""
    pods = kjson("get", "pods", "-n", NS, "-l", f"app={svc}", "-o", "json")
    ev = {
        "k8s_pods.json": _trim_pods(pods),
        "k8s_events.json": kjson("get", "events", "-n", NS,
                                 "--field-selector", f"involvedObject.kind=Pod", "-o", "json"),
        "k8s_deployments.json": kjson("get", "deploy", svc, "-n", NS, "-o", "json"),
        "k8s_node_health.json": _trim_nodes(kjson("get", "nodes", "-o", "json")),
        "prometheus_alerts.json": _am(),
    }
    # logs from the first matching pod
    names = [p["metadata"]["name"] for p in pods.get("items", [])][:1]
    if names:
        lg = kc("logs", "-n", NS, names[0], "--tail", "40")
        ev["k8s_pod_logs.json"] = {"pod": names[0], "lines": lg.stdout.splitlines()[-40:]}
    return ev


def _trim_pods(pods):
    out = []
    for p in pods.get("items", []):
        cs = (p.get("status", {}).get("containerStatuses") or [{}])[0]
        out.append({
            "name": p["metadata"]["name"],
            "namespace": p["metadata"]["namespace"],
            "phase": p.get("status", {}).get("phase"),
            "node_name": p.get("spec", {}).get("nodeName"),
            "ready": cs.get("ready"),
            "restart_count": cs.get("restartCount"),
            "state": cs.get("state"),
            "last_state": cs.get("lastState"),
        })
    return {"pods": out}


def _trim_nodes(nodes):
    out = []
    for n in nodes.get("items", []):
        conds = {c["type"]: c["status"] for c in n.get("status", {}).get("conditions", [])}
        out.append({"name": n["metadata"]["name"],
                    "unschedulable": n.get("spec", {}).get("unschedulable", False),
                    "conditions": conds,
                    "os_image": n.get("status", {}).get("nodeInfo", {}).get("osImage")})
    return {"nodes": out}


def _am():
    r = kc("get", "--raw", AM)
    try:
        d = json.loads(r.stdout)
        return [{"alertname": a["labels"].get("alertname"), "state": a["state"]["state"]} for a in d]
    except Exception:
        return []


def capture(incident, out_root):
    sc = get_scenario(incident)
    spec = load_spec(incident)
    svc = sc["service"]
    print(f"[{incident}] injecting fault on {svc} ...")
    # mark the service unhealthy (drives the synthetic metrics + log marker), like 06 step b
    if svc != "any":
        kc("set", "env", f"deploy/{svc}", "-n", NS, f"CHAOS_MARKER={sc['log_marker']}")
    # chaos faults: apply the CR
    if sc["fault_kind"] in ("stresschaos", "networkchaos", "iochaos", "podchaos"):
        subprocess.run(["kubectl", "apply", "-f", "-"], input=sc["fault_yaml"], text=True,
                       capture_output=True)
    time.sleep(35)

    print(f"[{incident}] snapshotting real evidence ...")
    ev = snapshot(svc)
    metric_val = prom(sc["metric_query"])
    ev["prometheus_metrics.json"] = {"query": sc["metric_query"], "result": metric_val.get("data", {})}

    nnn = (ORDER.index(incident) + 1) if incident in ORDER else 99
    folder = os.path.join(out_root, "live", "k8s", f"{nnn:03d}-{incident}")
    os.makedirs(folder, exist_ok=True)
    for fn, content in ev.items():
        json.dump(content, open(os.path.join(folder, fn), "w"), indent=2)

    # alert.json: prefer the spec pack's (already opensre-shaped), else synthesize
    alert = spec.get("alert") or {
        "title": f"[live-k8s] {incident} — {svc}",
        "state": "alerting", "alert_source": "prometheus",
        "commonLabels": {"alertname": sc.get("alert_rule", incident), "severity": "critical",
                         "service": svc, "namespace": NS},
        "commonAnnotations": {"summary": sc.get("log_marker", incident), "context_sources": "k8s,prometheus"},
    }
    json.dump(alert, open(os.path.join(folder, "alert.json"), "w"), indent=2)

    dump_yaml({"base": "000-healthy", "scenario_id": f"{nnn:03d}-{incident}",
               "failure_mode": spec.get("failure_mode", incident), "severity": "critical",
               "scenario_difficulty": spec.get("scenario_difficulty", 2),
               "adversarial_signals": spec.get("scenario", {}).get("adversarial_signals", []),
               "available_evidence": [k[:-5] for k in ev],
               "source": "live"}, os.path.join(folder, "scenario.yml"))

    ans = dict(spec.get("answer", {}))
    ans["remediation"] = spec.get("remediation", {})
    ans["_note"] = "diagnosis from spec pack; evidence captured live from GKE"
    dump_yaml(ans, os.path.join(folder, "answer.yml"))

    print(f"[{incident}] cleanup (run fix) ...")
    if svc != "any":
        kc("set", "env", f"deploy/{svc}", "-n", NS, "CHAOS_MARKER-")
    subprocess.run(["bash", "-c", sc["fix"]], capture_output=True, text=True)
    print(f"[{incident}] -> {folder}")
    return folder


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("incidents", nargs="*",
                    default=["crashloop", "node_not_ready", "oom_kill"],
                    help="incidents to capture live (default: 3 with clearest real signatures)")
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    args = ap.parse_args()
    if not os.environ.get("KUBECONFIG"):
        sys.exit("KUBECONFIG not set — run: source /Users/mei/rl/gcp-bench/env.sh")
    for inc in args.incidents:
        try:
            capture(inc, args.out)
        except Exception as e:
            print(f"  ! {inc} capture failed: {e}")


if __name__ == "__main__":
    main()
