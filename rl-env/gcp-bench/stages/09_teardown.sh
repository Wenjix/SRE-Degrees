#!/usr/bin/env bash
# 09_teardown.sh — STOP BILLING. Removes chaos experiments and DELETES the GKE
# cluster via gcp/teardown_gke.sh. Asks for explicit confirmation.
# Gated by state/.done.9 (skip if already torn down).
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ./lib.sh

TEARDOWN="$ROOT/gcp/teardown_gke.sh"

hdr "stage 09 — teardown (stops billing)"

if stage_done 9; then
  ok "stage 09 already done (state/.done.9) — cluster already torn down"
  exit 0
fi

[ -f "$TEARDOWN" ] || { err "missing teardown script: $TEARDOWN"; exit 1; }

echo
echo "${C_RED}This DELETES the GKE cluster '$GKE_CLUSTER' and stops all billing.${C_RST}"
echo "  Any unsaved in-cluster state is lost."
read -r -p "Type EXACTLY 'teardown' to proceed: " confirm
[ "$confirm" = "teardown" ] || { warn "aborted — cluster left running (STILL BILLING)"; exit 1; }

log "delegating to $TEARDOWN"
# teardown_gke.sh runs its own 'delete' confirmation.
GKE_CLUSTER="$GKE_CLUSTER" ZONE="$ZONE" GCP_PROJECT="$GCP_PROJECT" \
  bash "$TEARDOWN"

# Belt-and-suspenders: only mark done if NO same-named cluster remains anywhere
# in the project (guards a declined/partial delete from recording false success).
if gcloud container clusters list --project "$GCP_PROJECT" \
     --filter="name=$GKE_CLUSTER" --format='value(name)' 2>/dev/null | grep -q .; then
  err "cluster '$GKE_CLUSTER' still exists in $GCP_PROJECT — NOT marking stage 09 done (still billing). Re-run teardown."
  exit 1
fi

mark_done 9
# clear the provisioning markers so a future run starts clean
rm -f "$STATE_DIR/.done.1" "$STATE_DIR/.done.2" "$STATE_DIR/.done.3" \
      "$STATE_DIR/.done.4" "$STATE_DIR/.done.5"
ok "teardown complete — billing stopped"
