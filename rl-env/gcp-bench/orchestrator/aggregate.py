#!/usr/bin/env python3
"""aggregate.py — read results/*.json, print a per-scenario table and write
results/aggregate.json. Columns:
  scenario, signal_metric, alert_fired, cre_detected, action_fired, recovered, reward
"""
import json
import os
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS_DIR = os.path.join(ROOT, "results")

COLS = ["signal_metric", "alert_fired", "cre_detected", "action_fired", "recovered", "reward"]


def tick(v):
    if isinstance(v, bool):
        return "✓" if v else "✗"
    return str(v)


def main():
    rows = []
    for path in sorted(glob.glob(os.path.join(RESULTS_DIR, "*.json"))):
        if os.path.basename(path) == "aggregate.json":
            continue
        d = json.load(open(path))
        rows.append({
            "scenario": d.get("scenario", os.path.basename(path)[:-5]),
            "signal_metric": bool(d.get("signal_metric", False)),
            "alert_fired": bool(d.get("alert_fired", False)),
            "cre_detected": bool(d.get("cre_detected", False)),
            "action_fired": bool(d.get("action_fired", False)),
            "recovered": bool(d.get("recovered", False)),
            "reward": int(d.get("reward", 0)),
        })

    # table
    w = max([len("scenario")] + [len(r["scenario"]) for r in rows], default=8)
    header = f"{'scenario':<{w}}  " + "  ".join(f"{c:<13}" for c in COLS)
    print(header)
    print("-" * len(header))
    for r in rows:
        line = f"{r['scenario']:<{w}}  " + "  ".join(f"{tick(r[c]):<13}" for c in COLS)
        print(line)

    n = len(rows)
    agg = {
        "n": n,
        "reward_sum": sum(r["reward"] for r in rows),
        "mean_reward": round(sum(r["reward"] for r in rows) / n, 3) if n else 0,
        "metric_rate": round(sum(r["signal_metric"] for r in rows) / n, 3) if n else 0,
        "alert_rate": round(sum(r["alert_fired"] for r in rows) / n, 3) if n else 0,
        "cre_rate": round(sum(r["cre_detected"] for r in rows) / n, 3) if n else 0,
        "recover_rate": round(sum(r["recovered"] for r in rows) / n, 3) if n else 0,
        "rows": rows,
    }
    out = os.path.join(RESULTS_DIR, "aggregate.json")
    json.dump(agg, open(out, "w"), indent=2)

    print("-" * len(header))
    print(f"n={n}  mean_reward={agg['mean_reward']}  "
          f"metric={agg['metric_rate']}  alert={agg['alert_rate']}  "
          f"cre={agg['cre_rate']}  recover={agg['recover_rate']}")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
