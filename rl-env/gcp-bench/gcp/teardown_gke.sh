#!/usr/bin/env bash
# Tear down: remove chaos experiments and (optionally) DELETE the GKE cluster.
# Deleting the cluster removes the node VMs + control plane → stops all billing.
set -euo pipefail

# Self-pin the temp account even if env.sh wasn't sourced (never bill the
# machine's default gcloud account). Idempotent with env.sh.
GCP_ACCOUNT="${GCP_ACCOUNT:-devstar4126@gcplab.me}"
export CLOUDSDK_CORE_ACCOUNT="$GCP_ACCOUNT"

GKE_CLUSTER="${GKE_CLUSTER:-rlvr-bench}"
ZONE="${ZONE:-us-central1-a}"
GCP_PROJECT="${GCP_PROJECT:?set GCP_PROJECT to the temp project id}"

echo "removing chaos experiments..."
kubectl delete stresschaos,networkchaos,iochaos,podchaos --all -A 2>/dev/null || true

read -r -p "Also DELETE the GKE cluster '$GKE_CLUSTER' (stops all billing)? type 'delete': " ok
if [ "$ok" != "delete" ]; then
  echo "left cluster running (STILL BILLING)."
  exit 1   # non-zero so the caller does NOT mark stage 09 done
fi

command -v gcloud >/dev/null || { echo "gcloud not installed"; exit 1; }

# Delete EVERY cluster with this name anywhere in the project, not just $ZONE —
# a cluster created in a different zone (capacity retry, second sweep) would
# otherwise be left billing while teardown reports success. gcloud lists across
# all locations when no --zone/--region is given.
# Portable read into array (macOS ships bash 3.2 — no `mapfile`).
HITS=()
while IFS= read -r row; do
  [ -n "$row" ] && HITS+=("$row")
done < <(gcloud container clusters list \
  --project "$GCP_PROJECT" \
  --filter="name=$GKE_CLUSTER" \
  --format='value(name,location)')

if [ "${#HITS[@]}" -eq 0 ]; then
  echo "no cluster named $GKE_CLUSTER anywhere in $GCP_PROJECT"
else
  for row in "${HITS[@]}"; do
    cname="${row%%$'\t'*}"; cloc="${row##*$'\t'}"
    echo "deleting cluster $cname in $cloc ..."
    gcloud container clusters delete "$cname" \
      --location "$cloc" --project "$GCP_PROJECT" --quiet \
      && echo "deleted $cname ($cloc)"
  done
fi

# Refuse silent success: if any same-named cluster still exists, fail so the
# caller (stage 09) does not record teardown as complete.
REMAIN=$(gcloud container clusters list --project "$GCP_PROJECT" \
  --filter="name=$GKE_CLUSTER" --format='value(name)')
if [ -n "$REMAIN" ]; then
  echo "WARNING: cluster(s) still present (STILL BILLING): $REMAIN" >&2
  exit 1
fi
echo "all '$GKE_CLUSTER' clusters deleted in $GCP_PROJECT — billing stopped"
