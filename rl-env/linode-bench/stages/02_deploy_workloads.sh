#!/usr/bin/env bash
# 02_deploy_workloads.sh — create ns rlvr-target and apply the 16 mock services
# + redis + upstream-mock + load-gen. Idempotent: re-apply is a no-op.
# Gated by state/.done.2.
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ./lib.sh

hdr "stage 02 — deploy target workloads"

if stage_done 2; then
  ok "stage 02 already done (state/.done.2) — skipping"
  exit 0
fi

require_kubectl

# Idempotent namespace
if kubectl get ns "$NS_TARGET" >/dev/null 2>&1; then
  ok "namespace $NS_TARGET exists"
else
  kubectl create ns "$NS_TARGET"
  ok "created namespace $NS_TARGET"
fi

log "applying workloads.yaml (kubectl apply is idempotent)"
kubectl apply -f workloads.yaml

log "waiting for the 16 service deployments to become available..."
for svc in checkout payments auth cart search inventory orders notifications \
           gateway user-profile recommendations billing shipping catalog \
           sessions media-upload; do
  kubectl rollout status deploy/"$svc" -n "$NS_TARGET" --timeout=120s || warn "$svc not ready yet"
done
kubectl rollout status deploy/redis -n "$NS_TARGET" --timeout=120s || warn "redis not ready"
kubectl rollout status deploy/upstream-mock -n "$NS_TARGET" --timeout=120s || warn "upstream-mock not ready"

kubectl get deploy -n "$NS_TARGET"
mark_done 2
ok "workloads deployed"
