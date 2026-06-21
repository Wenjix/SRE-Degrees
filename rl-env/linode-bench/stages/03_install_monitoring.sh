#!/usr/bin/env bash
# 03_install_monitoring.sh — install kube-prometheus-stack (Prometheus +
# Alertmanager + Grafana) with a minimal footprint, then apply the RLVR
# PrometheusRule (alerts.yaml). Idempotent. Gated by state/.done.3.
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ./lib.sh

hdr "stage 03 — install monitoring (kube-prometheus-stack)"

if stage_done 3; then
  ok "stage 03 already done (state/.done.3) — skipping"
  exit 0
fi

require_kubectl
require helm

if helm repo list 2>/dev/null | grep -q prometheus-community; then
  ok "helm repo prometheus-community already added"
else
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
fi
helm repo update prometheus-community >/dev/null

kubectl get ns "$NS_MON" >/dev/null 2>&1 || kubectl create ns "$NS_MON"

log "helm upgrade --install kube-prometheus-stack (minimal resources)"
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace "$NS_MON" \
  --set grafana.enabled=true \
  --set grafana.persistence.enabled=false \
  --set prometheus.prometheusSpec.retention=2h \
  --set prometheus.prometheusSpec.resources.requests.cpu=100m \
  --set prometheus.prometheusSpec.resources.requests.memory=400Mi \
  --set prometheus.prometheusSpec.resources.limits.memory=900Mi \
  --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.ruleSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set alertmanager.alertmanagerSpec.resources.requests.cpu=25m \
  --set alertmanager.alertmanagerSpec.resources.requests.memory=64Mi \
  --set kube-state-metrics.resources.requests.cpu=25m \
  --set prometheusOperator.resources.requests.cpu=50m \
  --wait --timeout 8m

log "applying RLVR alert rules (alerts.yaml)"
kubectl apply -f alerts.yaml

log "waiting for Prometheus + Alertmanager to be Ready..."
kubectl -n "$NS_MON" rollout status statefulset/prometheus-kube-prometheus-stack-prometheus --timeout=300s || warn "prometheus not ready"
kubectl -n "$NS_MON" rollout status statefulset/alertmanager-kube-prometheus-stack-alertmanager --timeout=300s || warn "alertmanager not ready"

kubectl get pods -n "$NS_MON"
mark_done 3
ok "monitoring installed + alert rules applied"
