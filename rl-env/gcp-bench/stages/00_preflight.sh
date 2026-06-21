#!/usr/bin/env bash
# 00_preflight.sh — verify local tooling + GCP auth. Creates NOTHING, bills
# NOTHING. Prints PASS/FAIL per check; exits 0 only if every check passes.
set -euo pipefail
cd "$(dirname "$0")"
source ../env.sh
source ./lib.sh

hdr "stage 00 — preflight (no resources created)"

fail=0
check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then ok "found: $1"; else err "MISSING: $1"; fail=1; fi
}

# Required local tools (gke-gcloud-auth-plugin is needed for kubectl→GKE auth)
for c in gcloud kubectl helm jq python3 gke-gcloud-auth-plugin; do
  check_cmd "$c"
done

# gcloud must have the temp account logged in (read-only, no resources)
if command -v gcloud >/dev/null 2>&1; then
  if gcloud auth list --filter="account=$GCP_ACCOUNT" --format="value(account)" 2>/dev/null | grep -q .; then
    ok "gcloud account logged in: $GCP_ACCOUNT"
  else
    err "gcloud account '$GCP_ACCOUNT' NOT logged in — run: gcloud auth login \"$GCP_ACCOUNT\""
    fail=1
  fi

  # project must be set + accessible as the temp account
  if [ -z "${GCP_PROJECT:-}" ]; then
    err "GCP_PROJECT not set — export GCP_PROJECT=<temp-project-id>  (list with: gcloud projects list)"
    fail=1
  elif gcloud projects describe "$GCP_PROJECT" >/dev/null 2>&1; then
    ok "project accessible: $GCP_PROJECT"
    # Is the Kubernetes Engine API enabled? (provision enables it; just inform here)
    if gcloud services list --enabled --filter="config.name=container.googleapis.com" \
         --format="value(config.name)" 2>/dev/null | grep -q container; then
      ok "Kubernetes Engine API enabled"
    else
      warn "Kubernetes Engine API not enabled yet — stage 01 will enable it (container.googleapis.com)"
    fi

    # Cloud Billing must be linked, or stage 01 (services enable + clusters create)
    # hard-fails with FAILED_PRECONDITION on a fresh temp project. (GA command —
    # the beta component is not installed in this SDK.)
    be=$(gcloud billing projects describe "$GCP_PROJECT" --format="value(billingEnabled)" 2>/dev/null || echo "")
    if [ "$be" = "True" ]; then
      ok "Cloud Billing linked to $GCP_PROJECT"
    elif [ "$be" = "False" ]; then
      err "Cloud Billing NOT linked to $GCP_PROJECT — stage 01 will fail. Link the credit's billing account:"
      err "  gcloud billing accounts list                                   # find ACCOUNT_ID"
      err "  gcloud billing projects link \"$GCP_PROJECT\" --billing-account ACCOUNT_ID"
      fail=1
    else
      warn "could not read billing status (cloudbilling API off or perms) — if stage 01 fails with a billing error, run: gcloud billing projects link \"$GCP_PROJECT\" --billing-account ACCOUNT_ID"
    fi

    # clusters create defaults to --network=default; lab/temp projects may have
    # compute.skipDefaultNetworkCreation and no 'default' VPC. Warn-only.
    if gcloud compute networks describe default --project "$GCP_PROJECT" >/dev/null 2>&1; then
      ok "default VPC network present"
    else
      warn "no 'default' VPC in $GCP_PROJECT — stage 01 'clusters create' will fail. Create one first: gcloud compute networks create default --subnet-mode=auto --project $GCP_PROJECT"
    fi
  else
    err "project '$GCP_PROJECT' not accessible as $GCP_ACCOUNT"
    fail=1
  fi
fi

# registry must parse
if python3 -c "import json; json.load(open('../scenarios/registry.json'))" 2>/dev/null; then
  n=$(python3 -c "import json; print(len(json.load(open('../scenarios/registry.json'))['scenarios']))")
  ok "registry.json parses ($n scenarios)"
else
  err "registry.json does not parse"; fail=1
fi

# all CRE files present
missing_cre=0
while read -r cre; do
  [ -z "$cre" ] && continue
  if [ ! -f "../scenarios/$cre" ]; then err "missing CRE: $cre"; missing_cre=1; fi
done < <(python3 -c "import json; [print(s['cre_id']) for s in json.load(open('../scenarios/registry.json'))['scenarios']]")
[ "$missing_cre" -eq 0 ] && ok "all 15 CRE yaml files present" || fail=1

echo
if [ "$fail" -eq 0 ]; then
  ok "PREFLIGHT PASS — safe to provision (stage 01)"
  exit 0
else
  err "PREFLIGHT FAIL — fix the above before stage 01"
  exit 1
fi
