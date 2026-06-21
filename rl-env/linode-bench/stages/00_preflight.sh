#!/usr/bin/env bash
# 00_preflight.sh — verify local tooling + linode auth. Creates NOTHING, bills
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

# Required local tools
for c in linode-cli kubectl helm jq python3 ssh; do
  check_cmd "$c"
done

# linode-cli must be authenticated (read-only call, no resources)
if command -v linode-cli >/dev/null 2>&1; then
  if linode-cli regions list --text >/dev/null 2>&1; then
    ok "linode-cli authenticated"
  else
    err "linode-cli NOT authenticated — run: linode-cli configure"
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
