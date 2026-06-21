#!/usr/bin/env bash
# 06_run_scenario.sh — drive ONE scenario end-to-end and score the 5-signal
# chain (metric breach → alert → preq CRE → action/fix → recovery).
#
#   SCENARIO=oom_kill bash 06_run_scenario.sh
#
# Idempotent: re-running with the same SCENARIO overwrites its result JSON.
# Every fault is registered for auto-cleanup on exit so the cluster never sticks.
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ./lib.sh

SCENARIO="${SCENARIO:-oom_kill}"
hdr "stage 06 — run scenario: $SCENARIO"

require_kubectl

# ---- load the scenario fields ----
get_scenario "$SCENARIO" >/dev/null 2>&1 || { err "unknown scenario: $SCENARIO"; exit 1; }
eval "$(get_scenario "$SCENARIO" | python3 -c '
import json, sys, shlex
d = json.load(sys.stdin)
def e(k, v): print(f"{k}={shlex.quote(str(v))}")
e("SVC", d["service"]); e("MQ", d["metric_query"]); e("DIR", d["direction"])
e("SLO", d["slo_threshold"]); e("MARKER", d["log_marker"]); e("FKIND", d["fault_kind"])
e("FDUR", d["fault_duration_s"]); e("FIXT", d["fix_timeout_s"])
e("ACHECK", d["alert_check"]); e("CRE", d["cre_id"])
')"

FAULT_FILE="$(mktemp)"; FIX_FILE="$(mktemp)"
get_scenario "$SCENARIO" | python3 -c '
import json, sys
d = json.load(sys.stdin)
open(sys.argv[1], "w").write(d["fault_yaml"])
open(sys.argv[2], "w").write(d["fix"])
' "$FAULT_FILE" "$FIX_FILE"

CHAOS_NAME=""
case "$FKIND" in
  stresschaos|networkchaos|iochaos|podchaos)
    CHAOS_NAME="$(python3 -c 'import sys,yaml; print(yaml.safe_load(open(sys.argv[1]))["metadata"]["name"])' "$FAULT_FILE")"
    ;;
esac

# fresh result (idempotent overwrite)
rm -f "$RESULTS_DIR/$SCENARIO.json"
write_result "$SCENARIO" "$(python3 -c 'import json,sys; print(json.dumps({"incident":sys.argv[1],"service":sys.argv[2],"direction":sys.argv[3],"slo_threshold":sys.argv[4],"cre_id":sys.argv[5]}))' "$SCENARIO" "$SVC" "$DIR" "$SLO" "$CRE")"

# ---- helpers ----
breached() {
  # breached <value> -> "1" if the metric is on the unhealthy side of the SLO
  python3 -c '
import sys
v, d, t = sys.argv[1], sys.argv[2], float(sys.argv[3])
try: val = float(v)
except Exception: print("0"); sys.exit()
print("1" if (val > t if d == "lower" else val < t) else "0")
' "$1" "$DIR" "$SLO"
}

ALERTNAMES="$(python3 -c 'import re,sys; print(" ".join(re.findall(r"alertname == \"([^\"]+)\"", sys.argv[1])))' "$ACHECK")"

unset_marker() {
  kubectl get deploy "$SVC" -n "$NS_TARGET" >/dev/null 2>&1 && \
    kubectl set env deploy/"$SVC" -n "$NS_TARGET" CHAOS_MARKER- >/dev/null 2>&1 || true
}

cleanup() {
  warn "cleanup: tearing down fault for $SCENARIO"
  [ -n "$CHAOS_NAME" ] && kubectl delete "$FKIND" "$CHAOS_NAME" -n "$NS_CHAOS" >/dev/null 2>&1 || true
  unset_marker
  # un-stick anything pod-exec faults may have left
  kubectl get nodes -o name 2>/dev/null | sed 's#node/##' | while read -r n; do
    kubectl uncordon "$n" >/dev/null 2>&1 || true
  done
  rm -f "$FAULT_FILE" "$FIX_FILE"
}
trap cleanup EXIT

# ---- a. pre-stage: metric must be HEALTHY (no incident yet) ----
log "a. pre-stage check — metric should be healthy"
pre="$(prom_query "$MQ" || echo NaN)"
if [ "$(breached "$pre")" = "1" ]; then
  warn "metric already breached pre-fault (value=$pre, slo=$SLO) — continuing anyway"
  write_result "$SCENARIO" "$(printf '{"pre_value":"%s","pre_healthy":false}' "$pre")"
else
  ok "pre-stage healthy (value=$pre, slo=$SLO)"
  write_result "$SCENARIO" "$(printf '{"pre_value":"%s","pre_healthy":true}' "$pre")"
fi

# ---- b. inject fault ----
log "b. injecting fault (kind=$FKIND)"
# Drive the marker + synthetic metrics for the target service.
if [ "$SVC" != "any" ] && kubectl get deploy "$SVC" -n "$NS_TARGET" >/dev/null 2>&1; then
  kubectl set env deploy/"$SVC" -n "$NS_TARGET" CHAOS_MARKER="$MARKER" >/dev/null 2>&1 || true
fi
case "$FKIND" in
  stresschaos|networkchaos|iochaos|podchaos)
    kubectl apply -f "$FAULT_FILE"
    ;;
  *)
    # kubectl / custom: run in THIS shell so vars (e.g. $NODE) reach the fix
    eval "$(cat "$FAULT_FILE")" || warn "fault command returned non-zero"
    ;;
esac
write_result "$SCENARIO" '{"fault_injected": true}'
ok "fault injected"

# ---- c. wait for metric to breach SLO ----
log "c. waiting for metric to breach SLO (timeout $((FDUR + 30))s)"
signal_metric=false
for i in $(seq 1 $(((FDUR + 30) / 5))); do
  v="$(prom_query "$MQ" || echo NaN)"
  if [ "$(breached "$v")" = "1" ]; then
    ok "metric breached: value=$v slo=$SLO"
    signal_metric=true
    write_result "$SCENARIO" "$(printf '{"breach_value":"%s","signal_metric":true}' "$v")"
    break
  fi
  sleep 5
done
[ "$signal_metric" = true ] || { warn "metric never breached SLO"; write_result "$SCENARIO" '{"signal_metric": false}'; }

# ---- d. wait for the Prometheus alert to fire ----
log "d. waiting for alert to fire (timeout 60s) — expecting one of: $ALERTNAMES"
alert_fired=false
for i in $(seq 1 12); do
  alerts="$(am_alerts 2>/dev/null || echo '[]')"
  for an in $ALERTNAMES; do
    if echo "$alerts" | grep -q "\"$an\""; then
      ok "alert firing: $an"
      alert_fired=true
      write_result "$SCENARIO" "$(printf '{"alert_fired":true,"alert_name":"%s"}' "$an")"
      break 2
    fi
  done
  sleep 5
done
[ "$alert_fired" = true ] || { warn "no matching alert fired"; write_result "$SCENARIO" '{"alert_fired": false}'; }

# ---- e. wait for preq to detect the CRE ----
log "e. waiting for preq CRE detection (timeout 60s)"
cre_detected=false
for i in $(seq 1 12); do
  if kubectl logs -n "$NS_PREQ" deploy/preq-runner --tail=100 2>/dev/null | grep -q "CRE-2025-RLVR"; then
    ok "preq detected a CRE"
    cre_detected=true
    write_result "$SCENARIO" '{"cre_detected": true}'
    break
  fi
  sleep 5
done
[ "$cre_detected" = true ] || { warn "preq did not report a CRE"; write_result "$SCENARIO" '{"cre_detected": false}'; }

# ---- f. apply the fix (runbook action) ----
log "f. applying fix (runbook action)"
unset_marker
if eval "$(cat "$FIX_FILE")"; then
  ok "fix command executed"
  write_result "$SCENARIO" '{"action_fired": true}'
else
  warn "fix command returned non-zero"
  write_result "$SCENARIO" '{"action_fired": false}'
fi

# ---- g. wait for recovery (metric back to healthy) ----
log "g. waiting for recovery (timeout ${FIXT}s)"
recovered=false
for i in $(seq 1 $((FIXT / 5))); do
  v="$(prom_query "$MQ" || echo NaN)"
  if [ "$(breached "$v")" = "0" ] && [ "$v" != "NaN" ]; then
    ok "recovered: value=$v slo=$SLO"
    recovered=true
    write_result "$SCENARIO" "$(printf '{"recovery_value":"%s","recovered":true}' "$v")"
    break
  fi
  sleep 5
done
[ "$recovered" = true ] || { warn "metric did not return under SLO"; write_result "$SCENARIO" '{"recovered": false}'; }

# ---- h/i. summarize + reward ----
reward=0
[ "$recovered" = true ] && [ "$cre_detected" = true ] && reward=1
write_result "$SCENARIO" "$(printf '{"reward":%d}' "$reward")"

echo
hdr "scenario $SCENARIO summary"
printf "  %-16s %s\n" "signal_metric" "$signal_metric"
printf "  %-16s %s\n" "alert_fired"   "$alert_fired"
printf "  %-16s %s\n" "cre_detected"  "$cre_detected"
printf "  %-16s %s\n" "action_fired"  "${action_fired:-true}"
printf "  %-16s %s\n" "recovered"     "$recovered"
printf "  %-16s %s\n" "reward"        "$reward"
if [ "$reward" -eq 1 ]; then ok "SCENARIO $SCENARIO: PASS (reward=1)"; else err "SCENARIO $SCENARIO: FAIL (reward=0)"; fi
# cleanup runs via trap
