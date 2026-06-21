#!/usr/bin/env python3
"""export_traces.py — turn HUD traces (out/hud_traces/<model>/*.jsonl) into a clean
trajectory dataset (out/hud_trajectories.jsonl) + print a spanning-set leaderboard.

Each output record is one graded multi-step investigation rollout:
  {model, scenario_id, incident, reward, subscores, n_tool_calls, tools_used,
   n_agent_steps, answer}
"""
import glob
import json
import os
import re
import statistics as st
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
TRACES = os.path.join(HERE, "out", "hud_traces")
OUT = os.path.join(HERE, "out", "hud_trajectories.jsonl")


def _payload(ev):
    return ev.get("attributes", {}).get("hud.payload", {})


def parse_trace(path, model):
    rows = [json.loads(l) for l in open(path) if l.strip()]
    rec = {"model": model, "trace_id": os.path.basename(path)[:-6],
           "scenario_id": None, "reward": None, "subscores": {},
           "n_tool_calls": 0, "tools_used": [], "n_agent_steps": 0, "answer": None}
    for ev in rows:
        name = ev.get("name")
        p = _payload(ev)
        if name == "step.tool":
            rec["n_tool_calls"] += 1
            s = json.dumps(p)
            for t in ("describe_pod", "get_events", "get_logs", "get_node_status",
                      "get_deployment_status", "get_metrics", "get_alerts", "query_traces"):
                if f'"{t}"' in s and t not in rec["tools_used"]:
                    rec["tools_used"].append(t)
        elif name == "step.agent":
            rec["n_agent_steps"] += 1
        tc = p.get("task_call", {})
        if tc.get("phase") == "setup":
            rec["scenario_id"] = (tc.get("arguments") or {}).get("scenario_id")
        elif tc.get("phase") == "evaluate":
            rec["answer"] = (tc.get("arguments") or {}).get("answer")
            res = tc.get("result")
            if isinstance(res, dict):
                subs = res.get("subscores", []) or []
                for s in subs:
                    rec["subscores"][s.get("name")] = s.get("value")
                # read the AUTHORITATIVE grade (HUD renames reward->score on the wire);
                # fall back to the weighted sum only if absent (NO /tw — HUD weights are
                # already normalized; dividing diverges once a negative-weight penalty exists).
                if res.get("score") is not None or res.get("reward") is not None:
                    rec["reward"] = res.get("score", res.get("reward"))
                elif subs:
                    rec["reward"] = round(
                        sum(s.get("weight", 0) * s.get("value", 0) for s in subs), 4)
    # fallback: scrape reward if not in evaluate result
    if rec["reward"] is None:
        for ev in rows:
            m = re.search(r'"reward":\s*(-?\d+(?:\.\d+)?)', json.dumps(_payload(ev)))
            if m:
                rec["reward"] = float(m.group(1)); break
    if rec["scenario_id"]:
        rec["incident"] = re.sub(r"^\d+-", "", re.sub(r"-s\d+$", "", rec["scenario_id"]))
    return rec


def main():
    recs = []
    dropped = 0
    for model_dir in sorted(glob.glob(os.path.join(TRACES, "*"))):
        if not os.path.isdir(model_dir):
            continue
        model = os.path.basename(model_dir)
        for f in glob.glob(os.path.join(model_dir, "*.jsonl")):
            r = parse_trace(f, model)
            # require a real final answer — blank means the rollout errored (e.g. a
            # 429 rate-limit), which would otherwise be a fake reward=0, not a real miss.
            if r["reward"] is not None and r["scenario_id"] and (r.get("answer") or "").strip():
                recs.append(r)
            else:
                dropped += 1
    if dropped:
        print(f"(dropped {dropped} errored/blank rollouts — e.g. rate-limited)")

    if not recs:
        print(f"no traces under {TRACES} — run run_models.sh first"); return

    # enrich each rollout with corpus metadata (source/provenance/trap), joined on scenario_id
    corpus_path = os.path.join(HERE, "out", "trajectories.jsonl")
    corpus = {}
    if os.path.exists(corpus_path):
        for line in open(corpus_path):
            line = line.strip()
            if line:
                c = json.loads(line)
                corpus[c["scenario_id"]] = c
    for r in recs:
        c = corpus.get(r["scenario_id"], {})
        m = c.get("meta", {})
        r["source"] = c.get("source", "synthetic")
        r["true_category"] = m.get("root_cause_category")
        r["source_company"] = m.get("source_company")
        r["source_url"] = m.get("source_url")
        r["trap_actions"] = m.get("trap_actions", [])
        r["difficulty"] = c.get("difficulty")
    with open(OUT, "w") as f:
        for r in recs:
            f.write(json.dumps(r) + "\n")

    # leaderboard
    by_model = defaultdict(list)
    for r in recs:
        by_model[r["model"]].append(r["reward"])
    print(f"\n{len(recs)} trajectories -> {OUT}\n")
    print(f"{'model':22} {'n':>4} {'mean':>6} {'std':>6} {'min':>5} {'max':>5}")
    print("-" * 52)
    order = sorted(by_model, key=lambda m: -st.mean(by_model[m]))
    for m in order:
        v = by_model[m]
        print(f"{m:22} {len(v):>4} {st.mean(v):>6.3f} "
              f"{(st.pstdev(v) if len(v) > 1 else 0):>6.3f} {min(v):>5.2f} {max(v):>5.2f}")

    # per-incident difficulty (mean over all models)
    by_inc = defaultdict(list)
    for r in recs:
        by_inc[r.get("incident", "?")].append(r["reward"])
    print(f"\nper-incident mean reward (all models), avg tools/rollout="
          f"{st.mean([r['n_tool_calls'] for r in recs]):.1f}")
    for inc in sorted(by_inc, key=lambda i: st.mean(by_inc[i])):
        print(f"  {inc:20} {st.mean(by_inc[inc]):.3f}  (n={len(by_inc[inc])})")


if __name__ == "__main__":
    main()
