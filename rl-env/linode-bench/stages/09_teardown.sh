#!/usr/bin/env bash
# 09_teardown.sh — STOP BILLING. Removes chaos experiments and DELETES the LKE
# cluster via the shared akamai-env/teardown.sh. Asks for explicit confirmation.
# Gated by state/.done.9 (skip if already torn down).
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ./lib.sh

TEARDOWN="/Users/mei/ashish-life-os/hackathons/inference-time/akamai-env/teardown.sh"

hdr "stage 09 — teardown (stops billing)"

if stage_done 9; then
  ok "stage 09 already done (state/.done.9) — cluster already torn down"
  exit 0
fi

[ -f "$TEARDOWN" ] || { err "missing teardown script: $TEARDOWN"; exit 1; }

echo
echo "${C_RED}This DELETES the LKE cluster '$LKE_LABEL' and stops all billing.${C_RST}"
echo "  Any unsaved in-cluster state is lost."
read -r -p "Type EXACTLY 'teardown' to proceed: " confirm
[ "$confirm" = "teardown" ] || { warn "aborted — cluster left running (STILL BILLING)"; exit 1; }

log "delegating to $TEARDOWN"
# teardown.sh reads LABEL and runs its own 'delete' confirmation.
LABEL="$LKE_LABEL" bash "$TEARDOWN"

mark_done 9
# clear the provisioning markers so a future run starts clean
rm -f "$STATE_DIR/.done.1" "$STATE_DIR/.done.2" "$STATE_DIR/.done.3" \
      "$STATE_DIR/.done.4" "$STATE_DIR/.done.5"
ok "teardown complete — billing stopped"
