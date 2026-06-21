#!/usr/bin/env bash
# run_all.sh — run every non-skipped scenario in the registry end-to-end, then
# verify + aggregate. Assumes stages 01–05 are already done (cluster up).
# Does NOT provision or tear down — that stays an explicit, billed decision.
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ../stages/lib.sh

hdr "orchestrator — run all scenarios"

require_kubectl

if ! stage_done 5; then
  warn "stages 01–05 may not be complete (no state/.done.5)."
  read -r -p "Continue anyway? [y/N] " go
  [ "$go" = "y" ] || { warn "aborted"; exit 1; }
fi

mapfile -t SCENARIOS < <(python3 -c '
import json
d = json.load(open("../scenarios/registry.json"))
for s in d["scenarios"]:
    if not s.get("skip", False):
        print(s["incident"])
')

log "running ${#SCENARIOS[@]} scenarios: ${SCENARIOS[*]}"
for sc in "${SCENARIOS[@]}"; do
  echo
  hdr "==> $sc"
  SCENARIO="$sc" bash ../stages/06_run_scenario.sh || warn "scenario $sc errored (continuing)"
done

echo
bash ../stages/07_verify.sh || true

echo
python3 aggregate.py

ok "run_all complete — results in $RESULTS_DIR, aggregate in $RESULTS_DIR/aggregate.json"
