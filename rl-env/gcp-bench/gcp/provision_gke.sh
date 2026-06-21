#!/usr/bin/env bash
# Provision a GKE Standard cluster for the scenario environment.
# COSTS MONEY (against the temp $25 credit account). Run only after
# `gcloud auth login`. Reads config from the env (set by ../env.sh) and writes
# the kubeconfig to $KUBECONFIG via `get-credentials`.
#
# GKE Standard, NOT Autopilot: Chaos Mesh needs a privileged chaos-daemon
# DaemonSet + the host containerd socket, which Autopilot forbids.
set -euo pipefail

# Self-pin the temp account even if env.sh wasn't sourced (never bill the
# machine's default gcloud account). Idempotent with env.sh.
GCP_ACCOUNT="${GCP_ACCOUNT:-devstar4126@gcplab.me}"
export CLOUDSDK_CORE_ACCOUNT="$GCP_ACCOUNT"

GKE_CLUSTER="${GKE_CLUSTER:-rlvr-bench}"
ZONE="${ZONE:-us-central1-a}"
NODE_TYPE="${NODE_TYPE:-e2-standard-2}"
NODE_COUNT="${NODE_COUNT:-3}"
DISK_SIZE_GB="${DISK_SIZE_GB:-32}"
GKE_RELEASE_CHANNEL="${GKE_RELEASE_CHANNEL:-regular}"
GKE_VERSION="${GKE_VERSION:-}"
GCP_PROJECT="${GCP_PROJECT:?set GCP_PROJECT to the temp project id}"
KUBECONFIG="${KUBECONFIG:?set KUBECONFIG (env.sh does this)}"

command -v gcloud >/dev/null || { echo "gcloud not installed (https://cloud.google.com/sdk)"; exit 1; }

# An exact version pin overrides the release channel.
VERSION_ARGS=(--release-channel "$GKE_RELEASE_CHANNEL")
if [ -n "$GKE_VERSION" ]; then
  VERSION_ARGS=(--cluster-version "$GKE_VERSION" --no-enable-autoupgrade)
fi

echo "About to create GKE cluster:"
echo "  cluster=$GKE_CLUSTER  project=$GCP_PROJECT  zone=$ZONE"
echo "  nodes=${NODE_COUNT}x${NODE_TYPE}  disk=${DISK_SIZE_GB}GB  ${VERSION_ARGS[*]}"
echo "  THIS BILLS against the temp account's \$25 credits (~\$0.30/hr — teardown when done)."
read -r -p "Type 'yes' to proceed: " ok
[ "$ok" = "yes" ] || { echo "aborted."; exit 1; }

# 1. Kubernetes Engine API (idempotent; also pulls in compute.googleapis.com)
echo "enabling container.googleapis.com (idempotent)..."
gcloud services enable container.googleapis.com --project "$GCP_PROJECT"

# 2. Create the cluster (zonal = cheapest; one control plane, no HA).
#    --workload-pool is off; default COS-containerd nodes give us the
#    /run/containerd/containerd.sock that Chaos Mesh expects.
echo "creating cluster $GKE_CLUSTER (this takes ~4-6 min)..."
gcloud container clusters create "$GKE_CLUSTER" \
  --project "$GCP_PROJECT" \
  --zone "$ZONE" \
  --num-nodes "$NODE_COUNT" \
  --machine-type "$NODE_TYPE" \
  --disk-size "$DISK_SIZE_GB" \
  --disk-type pd-balanced \
  --image-type COS_CONTAINERD \
  --no-enable-autorepair \
  "${VERSION_ARGS[@]}"

# 3. Write the kubeconfig to OUR state file (not the user's ~/.kube/config).
echo "fetching credentials -> $KUBECONFIG"
gcloud container clusters get-credentials "$GKE_CLUSTER" \
  --project "$GCP_PROJECT" --zone "$ZONE"

echo "kubeconfig at $KUBECONFIG — use: export KUBECONFIG=$KUBECONFIG"
echo "remember to run teardown_gke.sh (or stage 09) when finished (stops billing)."
