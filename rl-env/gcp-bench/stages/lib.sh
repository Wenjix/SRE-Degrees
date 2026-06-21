#!/usr/bin/env bash
# Shared helpers for the gcp-bench stage scripts.
# Source this from every stage script:  source "$(dirname "$0")/lib.sh"
#
# Assumes env.sh was sourced already (defines ROOT, KUBECONFIG, NS_*, GCP_*).

set -euo pipefail

# ---------- paths ----------
ROOT="${ROOT:-/Users/mei/rl/gcp-bench}"
STATE_DIR="$ROOT/state"
RESULTS_DIR="$ROOT/results"
SCENARIOS_DIR="$ROOT/scenarios"
mkdir -p "$STATE_DIR" "$RESULTS_DIR"

KUBECONFIG="${KUBECONFIG:-$STATE_DIR/gke-kubeconfig.yaml}"
export KUBECONFIG

# ---------- colors ----------
if [ -t 1 ]; then C_RED=$'\033[0;31m'; C_GRN=$'\033[0;32m'; C_YEL=$'\033[0;33m'; C_BLU=$'\033[0;34m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
else C_RED=; C_GRN=; C_YEL=; C_BLU=; C_DIM=; C_RST=; fi

log()  { echo "${C_BLU}[$(date +%H:%M:%S)]${C_RST} $*"; }
ok()   { echo "${C_GRN}  ✓${C_RST} $*"; }
warn() { echo "${C_YEL}  !${C_RST} $*"; }
err()  { echo "${C_RED}  ✗${C_RST} $*" >&2; }
hdr()  { echo; echo "${C_BLU}========== $* ==========${C_RST}"; }

# ---------- prereqs ----------
require() {
  command -v "$1" >/dev/null 2>&1 || { err "missing: $1 — install before continuing"; exit 1; }
}

require_gcloud() {
  require gcloud
  # An account must be logged in AND active (we pin it via CLOUDSDK_CORE_ACCOUNT in env.sh).
  if ! gcloud auth list --filter="account=$GCP_ACCOUNT" --format="value(account)" 2>/dev/null | grep -q .; then
    err "gcloud account '$GCP_ACCOUNT' not logged in — run: gcloud auth login \"$GCP_ACCOUNT\""
    exit 1
  fi
  [ -n "${GCP_PROJECT:-}" ] || { err "GCP_PROJECT not set — export GCP_PROJECT=<temp-project-id> (see: gcloud projects list)"; exit 1; }
  gcloud projects describe "$GCP_PROJECT" >/dev/null 2>&1 || { err "project '$GCP_PROJECT' not accessible as $GCP_ACCOUNT"; exit 1; }
}

require_kubectl() {
  require kubectl
  kubectl cluster-info >/dev/null 2>&1 || { err "no reachable cluster — set KUBECONFIG or run 01_provision_gke.sh first"; exit 1; }
}

# ---------- stage gate ----------
stage_done() { [ -f "$STATE_DIR/.done.$1" ]; }
mark_done()  { date -u +%s > "$STATE_DIR/.done.$1"; ok "stage $1 complete"; }

# ---------- result writer ----------
# write_result <scenario> <json-patch> — appends/patches keys into the result JSON
write_result() {
  local scenario="$1"; shift
  python3 - "$RESULTS_DIR/$scenario.json" "$scenario" "$@" <<'PY'
import json, sys, os, time
path, scenario = sys.argv[1], sys.argv[2]
patch = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
if os.path.exists(path):
    d = json.load(open(path))
else:
    d = {"scenario": scenario, "started_at": time.time()}
for k, v in patch.items():
    if isinstance(v, dict) and isinstance(d.get(k), dict):
        d[k].update(v)
    else:
        d[k] = v
d["updated_at"] = time.time()
json.dump(d, open(path, "w"), indent=2, default=str)
PY
}

# ---------- prometheus helpers ----------
prom_ready() {
  kubectl -n "${NS_MON:-monitoring}" get deploy kube-prometheus-stack-prometheus >/dev/null 2>&1 && \
  kubectl -n "${NS_MON:-monitoring}" get pods -l app.kubernetes.io/name=prometheus -o jsonpath='{.items[*].status.containerStatuses[*].ready}' 2>/dev/null | grep -q true
}

prom_query() {
  # prom_query <promql> — returns last value or "NaN", via the kube-apiserver
  # service proxy. (The kube-prometheus-stack Prometheus image is distroless — no
  # shell/wget to `kubectl exec` into — and Prometheus is a StatefulSet, not a
  # Deployment, so the old `exec deploy/... -- wget` could never work here.)
  local q
  q=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$1")
  kubectl get --raw "/api/v1/namespaces/${NS_MON:-monitoring}/services/kube-prometheus-stack-prometheus:9090/proxy/api/v1/query?query=$q" 2>/dev/null | \
    python3 -c "import json,sys
try:
    d=json.load(sys.stdin); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else 'NaN')
except Exception:
    print('NaN')"
}

# ---------- alertmanager helpers ----------
am_alerts() {
  kubectl get --raw "/api/v1/namespaces/${NS_MON:-monitoring}/services/kube-prometheus-stack-alertmanager:9093/proxy/api/v2/alerts" 2>/dev/null | \
    python3 -c "import json,sys
try:
    d=json.load(sys.stdin); print(json.dumps([{'name':a['labels'].get('alertname'),'state':a['state']['state']} for a in d]))
except Exception:
    print('[]')"
}

# ---------- chaos-mesh helpers ----------
chaos_apply() {
  # chaos_apply <yaml> — apply and wait for "All Injected"
  echo "$1" | kubectl apply -f -
  local name=$(echo "$1" | python3 -c "import sys,yaml; print(yaml.safe_load(sys.stdin)['metadata']['name'])")
  for i in $(seq 1 30); do
    phase=$(kubectl get "$2"/"$name" -o jsonpath='{.status.experiment.phase}' 2>/dev/null || echo "")
    if [ "$phase" = "Running" ] || [ "$phase" = "Finished" ] || [ "$phase" = "All Injected" ]; then
      return 0
    fi
    sleep 2
  done
  warn "chaos $name did not reach Running phase"
}

chaos_delete() {
  local kind="$1" name="$2"
  kubectl delete "$kind" "$name" 2>/dev/null || true
}

# ---------- registry loader ----------
load_registry() {
  python3 -c "
import json
d = json.load(open('$SCENARIOS_DIR/registry.json'))
for s in d['scenarios']:
    print(s['incident'])
" | grep -v '^$'
}

get_scenario() {
  # get_scenario <name> — prints the JSON for one scenario
  python3 -c "
import json,sys
d = json.load(open('$SCENARIOS_DIR/registry.json'))
for s in d['scenarios']:
    if s['incident'] == sys.argv[1]:
        print(json.dumps(s))
        sys.exit(0)
sys.exit(1)
" "$1"
}
