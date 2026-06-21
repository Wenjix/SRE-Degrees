#!/usr/bin/env bash
# 01_provision_gke.sh — create the GKE cluster (THE ONLY STAGE THAT BILLS).
# Delegates to gcp/provision_gke.sh, then waits for nodes Ready. The kubeconfig
# is written to $KUBECONFIG by `gcloud ... get-credentials`. Gated by state/.done.1.
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ./lib.sh

PROVISION="$ROOT/gcp/provision_gke.sh"

hdr "stage 01 — provision GKE cluster"

if stage_done 1; then
  ok "stage 01 already done (state/.done.1) — skipping (cluster assumed up)"
  exit 0
fi

require_gcloud
[ -f "$PROVISION" ] || { err "missing provisioner: $PROVISION"; exit 1; }

echo
echo "${C_RED}╔══════════════════════════════════════════════════════════════╗${C_RST}"
echo "${C_RED}║  THIS CREATES REAL GKE INFRASTRUCTURE AND BILLS HOURLY.       ║${C_RST}"
echo "${C_RED}╚══════════════════════════════════════════════════════════════╝${C_RST}"
echo "  cluster = $GKE_CLUSTER"
echo "  project = $GCP_PROJECT   (account $GCP_ACCOUNT)"
echo "  zone    = $ZONE"
echo "  nodes   = ${NODE_COUNT} x ${NODE_TYPE}  (disk ${DISK_SIZE_GB}GB)"
echo "  k8s     = ${GKE_VERSION:-channel:$GKE_RELEASE_CHANNEL}"
echo "  cost    ≈ \$0.30/hr (3 x e2-standard-2 + cluster fee) — REMEMBER stage 09 teardown."
echo
read -r -p "Type EXACTLY 'provision' to create the cluster: " confirm
[ "$confirm" = "provision" ] || { warn "aborted — no resources created"; exit 1; }

# provision_gke.sh has its own 'yes' confirm; pipe it through so this stays one prompt.
log "delegating to $PROVISION"
echo "yes" | GKE_CLUSTER="$GKE_CLUSTER" ZONE="$ZONE" NODE_TYPE="$NODE_TYPE" \
  NODE_COUNT="$NODE_COUNT" DISK_SIZE_GB="$DISK_SIZE_GB" \
  GKE_RELEASE_CHANNEL="$GKE_RELEASE_CHANNEL" GKE_VERSION="$GKE_VERSION" \
  GCP_PROJECT="$GCP_PROJECT" KUBECONFIG="$KUBECONFIG" \
  bash "$PROVISION"

[ -f "$KUBECONFIG" ] || { err "kubeconfig not written to $KUBECONFIG"; exit 1; }
ok "kubeconfig at $KUBECONFIG"

log "waiting for nodes to register + become Ready (timeout ${PROBE_TIMEOUT_S}s)..."
for i in $(seq 1 30); do
  kubectl get nodes >/dev/null 2>&1 && break
  sleep 5
done
kubectl wait --for=condition=Ready nodes --all --timeout="${PROBE_TIMEOUT_S}s"
kubectl get nodes

mark_done 1
ok "cluster ready — proceed to stage 02"
