# Source this:  source /Users/mei/rl/gcp-bench/env.sh
export ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export STATE_DIR="$ROOT/state"
export RESULTS_DIR="$ROOT/results"
export SCENARIOS_DIR="$ROOT/scenarios"

# ---------- GCP account + project (pinned per-process for safety) ----------
# The hackathon gave a *temporary* account with $25 in credits. We pin the
# account + project into the gcloud env so every command in this bench targets
# the temp account — NEVER the machine's default gcloud account. Override either
# before sourcing.  (Log in once with:  gcloud auth login "$GCP_ACCOUNT")
export GCP_ACCOUNT="${GCP_ACCOUNT:-devstar4126@gcplab.me}"
export GCP_PROJECT="${GCP_PROJECT:-}"          # REQUIRED — set to the temp project id
export CLOUDSDK_CORE_ACCOUNT="$GCP_ACCOUNT"
[ -n "$GCP_PROJECT" ] && export CLOUDSDK_CORE_PROJECT="$GCP_PROJECT"
# GKE auth uses the gke-gcloud-auth-plugin exec credential (ships with the SDK).
export USE_GKE_GCLOUD_AUTH_PLUGIN="${USE_GKE_GCLOUD_AUTH_PLUGIN:-True}"

# ---------- Cluster defaults (override before running a stage) ----------
# Three nodes is the floor for Chaos Mesh (need scheduler spread + room to
# actually drain a node without killing the workload). e2-standard-2 = 2 vCPU
# / 8 GB — the GCP analog of Linode g6-standard-2; comfortably fits
# kube-prometheus-stack + 16 mock service pods. GKE Standard (NOT Autopilot):
# Chaos Mesh needs a privileged chaos-daemon DaemonSet + host containerd socket,
# which Autopilot forbids.
export GKE_CLUSTER="${GKE_CLUSTER:-rlvr-bench}"
export ZONE="${ZONE:-us-central1-a}"            # zonal cluster = cheapest; us-central1 is the cheapest region
export GKE_RELEASE_CHANNEL="${GKE_RELEASE_CHANNEL:-regular}"  # let GKE pick a valid version
export GKE_VERSION="${GKE_VERSION:-}"           # optional exact pin (overrides channel)
export NODE_TYPE="${NODE_TYPE:-e2-standard-2}"
export NODE_COUNT="${NODE_COUNT:-3}"
export DISK_SIZE_GB="${DISK_SIZE_GB:-32}"       # lean boot disk (default 100 GB is overkill for a short bench)

# Namespaces the test bench owns (kept tidy by teardown) — identical to linode-bench
export NS_TARGET="${NS_TARGET:-rlvr-target}"
export NS_CHAOS="${NS_CHAOS:-chaos-mesh}"
export NS_MON="${NS_MON:-monitoring}"
export NS_PREQ="${NS_PREQ:-preq}"

# Polling
export PROBE_TIMEOUT_S="${PROBE_TIMEOUT_S:-300}"    # cluster ready / node Ready timeout
export SCENARIO_WAIT_S="${SCENARIO_WAIT_S:-90}"     # how long to wait per scenario for alert+recovery

# Where the kubeconfig lives (written by stage 01 via `gcloud ... get-credentials`)
export KUBECONFIG="${KUBECONFIG:-$STATE_DIR/gke-kubeconfig.yaml}"
export PATH="$ROOT/bin:$PATH"
