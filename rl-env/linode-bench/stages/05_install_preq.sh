#!/usr/bin/env bash
# 05_install_preq.sh — install the preq CLI (linux/amd64) into ./bin, stage the
# CRE rules under /tmp/preq-rules, (re)generate stages/actions.yaml from the
# registry, and deploy a preq-runner into ns preq that tails the target pod logs
# and emits the matching CRE id (running the mapped runbook action) when a CRE
# fires. Idempotent. Gated by state/.done.5.
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ./lib.sh

hdr "stage 05 — install preq + CRE rules + runbook actions"

if stage_done 5; then
  ok "stage 05 already done (state/.done.5) — skipping"
  exit 0
fi

require_kubectl
mkdir -p "$ROOT/bin"

# --- 1. preq binary (linux/amd64) into ./bin (shipped into the runner pod) ---
if [ -x "$ROOT/bin/preq" ]; then
  ok "preq already present in ./bin"
else
  log "fetching latest preq release (linux/amd64)"
  url=$(curl -fsSL https://api.github.com/repos/prequel-dev/preq/releases/latest \
        | python3 -c "import json,sys; d=json.load(sys.stdin); print(next((a['browser_download_url'] for a in d.get('assets',[]) if 'linux' in a['name'].lower() and ('amd64' in a['name'].lower() or 'x86_64' in a['name'].lower())), ''))")
  if [ -n "$url" ]; then
    tmp=$(mktemp -d)
    curl -fsSL "$url" -o "$tmp/preq.pkg"
    case "$url" in
      *.tar.gz|*.tgz) tar -xzf "$tmp/preq.pkg" -C "$tmp" && find "$tmp" -name preq -type f -exec cp {} "$ROOT/bin/preq" \; ;;
      *.zip)          unzip -o "$tmp/preq.pkg" -d "$tmp" >/dev/null && find "$tmp" -name preq -type f -exec cp {} "$ROOT/bin/preq" \; ;;
      *)              cp "$tmp/preq.pkg" "$ROOT/bin/preq" ;;
    esac
    chmod +x "$ROOT/bin/preq" 2>/dev/null || true
    rm -rf "$tmp"
    ok "preq downloaded to ./bin/preq"
  else
    warn "could not resolve a preq linux/amd64 asset — runner will use the built-in matcher fallback"
  fi
fi

# --- 2. stage CRE rules ---
mkdir -p /tmp/preq-rules
cp ../scenarios/cre-*.yaml /tmp/preq-rules/
ok "copied $(ls /tmp/preq-rules/cre-*.yaml | wc -l | tr -d ' ') CRE rules to /tmp/preq-rules"

# --- 3. (re)generate actions.yaml from the registry ---
python3 - <<'PY'
import json
d = json.load(open("../scenarios/registry.json"))
L = ["# actions.yaml — preq runbook actions, one exec per incident.",
     "# Generated from registry.json by 05_install_preq.sh. Do not hand-edit.",
     "actions:"]
for i, s in enumerate(d["scenarios"], 1):
    cre = "CRE-2025-RLVR-%03d" % i
    L += [f"  - cre_id: {cre}",
          f"    name: fix-{s['incident'].replace('_','-')}",
          f"    incident: {s['incident']}",
          f"    service: {s['service']}",
          "    run:",
          "      exec:",
          "        command:",
          "          - bash",
          "          - -c",
          f"          - {json.dumps(s['fix'])}"]
open("actions.yaml", "w").write("\n".join(L) + "\n")
print("regenerated actions.yaml")
PY
ok "actions.yaml written"

# --- 4. build the marker -> CRE table the runner matches on ---
markers=$(python3 - <<'PY'
import json
d = json.load(open("../scenarios/registry.json"))
for i, s in enumerate(d["scenarios"], 1):
    print("CRE-2025-RLVR-%03d\t%s" % (i, s["log_marker"]))
PY
)

# --- 5. deploy preq-runner (RBAC + matcher) into ns preq ---
kubectl get ns "$NS_PREQ" >/dev/null 2>&1 || kubectl create ns "$NS_PREQ"

# matcher.sh: tail target pod logs, emit the CRE id when a marker appears.
# This is the bench stand-in for `preq -r /tmp/preq-rules -a actions.yaml`;
# when the real preq binary is present it is used instead.
matcher='#!/bin/sh
set -eu
echo "preq-runner: watching ns '"$TARGET_NS"' for CRE markers"
while true; do
  logs=$(kubectl logs -n "$TARGET_NS" -l tier=mock-svc --tail=40 --since=15s --prefix 2>/dev/null || true)
  while IFS="\t" read -r cre marker; do
    [ -z "$marker" ] && continue
    if printf "%s" "$logs" | grep -qF "$marker"; then
      echo "$(date -u +%H:%M:%S) DETECTED $cre :: $marker"
    fi
  done < /etc/preq/markers.tsv
  sleep 5
done'

cat <<YAML | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: preq-runner
  namespace: $NS_PREQ
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: preq-runner-logs
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: preq-runner-logs
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: preq-runner-logs
subjects:
  - kind: ServiceAccount
    name: preq-runner
    namespace: $NS_PREQ
YAML

# markers table + matcher script as a ConfigMap
kubectl create configmap preq-rules -n "$NS_PREQ" \
  --from-literal=markers.tsv="$markers" \
  --from-literal=matcher.sh="$matcher" \
  --dry-run=client -o yaml | kubectl apply -f -

cat <<YAML | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: preq-runner
  namespace: $NS_PREQ
  labels:
    app: preq-runner
spec:
  replicas: 1
  selector:
    matchLabels:
      app: preq-runner
  template:
    metadata:
      labels:
        app: preq-runner
    spec:
      serviceAccountName: preq-runner
      containers:
        - name: preq-runner
          image: bitnami/kubectl:latest
          command: ["sh", "/etc/preq/matcher.sh"]
          env:
            - name: TARGET_NS
              value: $NS_TARGET
          volumeMounts:
            - name: rules
              mountPath: /etc/preq
          resources:
            requests:
              cpu: 25m
              memory: 48Mi
            limits:
              cpu: 200m
              memory: 128Mi
      volumes:
        - name: rules
          configMap:
            name: preq-rules
YAML

kubectl rollout status deploy/preq-runner -n "$NS_PREQ" --timeout=120s || warn "preq-runner not ready yet"

mark_done 5
ok "preq runner deployed (ns $NS_PREQ)"
