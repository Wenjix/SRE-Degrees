#!/usr/bin/env bash
# Deploy the CIDG M-real real-RPS call-mesh to the live GKE cluster.
# Reuses the existing kube-prometheus-stack (ServiceMonitor + PrometheusRule).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
export KUBECONFIG="${KUBECONFIG:-$HERE/../gcp-bench/state/gke-kubeconfig.yaml}"
NS=cidg-mreal

echo "context: $(kubectl config current-context)"
# namespace + configmap FIRST so the pods can mount server.py on first schedule
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NS" create configmap cidg-mreal-src \
  --from-file=server.py="$HERE/server.py" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "$HERE/k8s.yaml"
echo "waiting for rollouts..."
kubectl -n "$NS" rollout status deploy/db --timeout=180s
for d in payments orders checkout gateway loadgen; do
  kubectl -n "$NS" rollout status "deploy/$d" --timeout=180s
done
kubectl -n "$NS" get pods -o wide
