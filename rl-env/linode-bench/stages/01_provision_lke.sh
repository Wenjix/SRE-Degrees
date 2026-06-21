#!/usr/bin/env bash
# 01_provision_lke.sh — create the LKE cluster (THE ONLY STAGE THAT BILLS).
# Delegates to the shared akamai-env/provision_lke.sh, then waits for nodes
# Ready and saves the kubeconfig to $KUBECONFIG. Gated by state/.done.1.
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ./lib.sh

PROVISION="/Users/mei/ashish-life-os/hackathons/inference-time/akamai-env/provision_lke.sh"

hdr "stage 01 — provision LKE cluster"

if stage_done 1; then
  ok "stage 01 already done (state/.done.1) — skipping (cluster assumed up)"
  exit 0
fi

require_linode_cli
[ -f "$PROVISION" ] || { err "missing provisioner: $PROVISION"; exit 1; }

echo
echo "${C_RED}╔══════════════════════════════════════════════════════════════╗${C_RST}"
echo "${C_RED}║  THIS CREATES REAL LINODE INFRASTRUCTURE AND BILLS HOURLY.    ║${C_RST}"
echo "${C_RED}╚══════════════════════════════════════════════════════════════╝${C_RST}"
echo "  label   = $LKE_LABEL"
echo "  region  = $REGION"
echo "  nodes   = ${NODE_COUNT} x ${NODE_TYPE}"
echo "  k8s     = $LKE_K8S_VERSION"
echo "  cost    ≈ \$0.108/hr for 3 x g6-standard-2 — REMEMBER stage 09 teardown."
echo
read -r -p "Type EXACTLY 'provision' to create the cluster: " confirm
[ "$confirm" = "provision" ] || { warn "aborted — no resources created"; exit 1; }

# The shared provisioner writes lke-kubeconfig.yaml into its CWD and reads
# LABEL/REGION/NODE_TYPE/NODE_COUNT/K8S_VERSION from the env. Run it from
# STATE_DIR so its output lands at $KUBECONFIG (state/lke-kubeconfig.yaml).
log "delegating to $PROVISION"
(
  cd "$STATE_DIR"
  LABEL="$LKE_LABEL" REGION="$REGION" NODE_TYPE="$NODE_TYPE" \
  NODE_COUNT="$NODE_COUNT" K8S_VERSION="$LKE_K8S_VERSION" \
    bash "$PROVISION"
)

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
