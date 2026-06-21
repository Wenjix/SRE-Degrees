#!/usr/bin/env bash
# 07_verify.sh — score every result in results/ with the same binary reward the
# RLVR dataset uses (resolved AND action_correct AND guardrail_ok). Writes
# /tmp/verify-report.json and prints the aggregate. Creates no cluster resources.
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ./lib.sh

hdr "stage 07 — verify results"

shopt -s nullglob
results=("$RESULTS_DIR"/*.json)
if [ "${#results[@]}" -eq 0 ]; then
  warn "no results in $RESULTS_DIR — run stage 06 first"
  exit 0
fi

python3 - "$RESULTS_DIR" <<'PY'
import json, os, sys, glob
rd = sys.argv[1]
report = {"runs": [], "aggregate": {}}
n = resolved = action_ok = guard_ok = reward_sum = 0
for path in sorted(glob.glob(os.path.join(rd, "*.json"))):
    if os.path.basename(path) == "aggregate.json":
        continue
    d = json.load(open(path))
    # Same rule as rl/verify/score.py, simplified for the live bench:
    #   resolved       — metric back under SLO at end of run
    #   action_correct — the canonical fix command executed
    #   guardrail_ok   — always true here (fixes are autonomous in the bench)
    resolved_i = bool(d.get("recovered", False))
    action_i = bool(d.get("action_fired", False))
    guard_i = True
    reward = int(resolved_i and action_i and guard_i)
    report["runs"].append({
        "scenario": d.get("scenario"),
        "resolved": resolved_i,
        "action_correct": action_i,
        "guardrail_ok": guard_i,
        "signal_metric": bool(d.get("signal_metric", False)),
        "alert_fired": bool(d.get("alert_fired", False)),
        "cre_detected": bool(d.get("cre_detected", False)),
        "reward": reward,
    })
    n += 1
    resolved += resolved_i
    action_ok += action_i
    guard_ok += guard_i
    reward_sum += reward

agg = report["aggregate"] = {
    "n": n,
    "resolve_rate": round(resolved / n, 3) if n else 0,
    "action_correct_rate": round(action_ok / n, 3) if n else 0,
    "guardrail_ok_rate": round(guard_ok / n, 3) if n else 0,
    "mean_reward": round(reward_sum / n, 3) if n else 0,
}
json.dump(report, open("/tmp/verify-report.json", "w"), indent=2)

print(f"  scenarios scored : {n}")
print(f"  resolve rate     : {agg['resolve_rate']}")
print(f"  action-correct   : {agg['action_correct_rate']}")
print(f"  guardrail ok     : {agg['guardrail_ok_rate']}")
print(f"  mean reward      : {agg['mean_reward']}")
print("  report           : /tmp/verify-report.json")
PY

ok "verification complete"
