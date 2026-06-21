#!/usr/bin/env bash
# 04_install_chaos_mesh.sh — install Chaos Mesh (containerd runtime) into
# ns chaos-mesh and wait for the chaos-daemon DaemonSet. Idempotent.
# Gated by state/.done.4.
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ./lib.sh

hdr "stage 04 — install Chaos Mesh"

if stage_done 4; then
  ok "stage 04 already done (state/.done.4) — skipping"
  exit 0
fi

require_kubectl
require helm

if helm repo list 2>/dev/null | grep -q chaos-mesh; then
  ok "helm repo chaos-mesh already added"
else
  helm repo add chaos-mesh https://charts.chaos-mesh.org
fi
helm repo update chaos-mesh >/dev/null

kubectl get ns "$NS_CHAOS" >/dev/null 2>&1 || kubectl create ns "$NS_CHAOS"

log "helm upgrade --install chaos-mesh (containerd socket)"
helm upgrade --install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace "$NS_CHAOS" \
  --set chaosDaemon.runtime=containerd \
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock \
  --set dashboard.create=true \
  --wait --timeout 6m

log "waiting for chaos-daemon DaemonSet..."
kubectl -n "$NS_CHAOS" rollout status daemonset/chaos-daemon --timeout=300s || warn "chaos-daemon not fully ready"

kubectl get pods -n "$NS_CHAOS"
mark_done 4
ok "chaos-mesh installed"
