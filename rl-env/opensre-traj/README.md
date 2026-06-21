# opensre-traj — trajectory data in the opensre standard

Generates trajectory data for the 15 infra-ops incidents to the **opensre**
benchmark standard ([Tracer-Cloud/opensre](https://github.com/Tracer-Cloud/opensre)
`tests/synthetic/<provider>/<id>/`), **extended with remediation** (the repo's
FIREBALL `state_before → fix → state_after`). See [SCHEMA.md](SCHEMA.md) for the
exact contract.

opensre is a *diagnosis* benchmark (read-only evidence → structured root cause).
We mirror its scenario layout and scoring contract and append the fix + recovery
our live GKE bench performs, so each trajectory covers **detect → diagnose → fix → verify**.

## Layout

```
opensre-traj/
├── SCHEMA.md          # the standard (opensre + remediation extension)
├── specs/<incident>.json   # 15 incident spec packs (templates w/ {{PLACEHOLDER}}s)
├── lib_opensre.py     # placeholder fill, deterministic ids, trajectory render
├── generate.py        # synthetic-at-scale: specs -> folders + JSONL
├── capture_live.py    # live-verified: real GKE evidence -> opensre folders
└── out/
    ├── synthetic/k8s/<NNN>-<incident>[-sSEED]/{alert.json,scenario.yml,*.json,answer.yml}
    ├── live/k8s/<NNN>-<incident>/{...}        # real evidence snapshots
    └── trajectories.jsonl                      # flattened mirror (training/eval)
```

## Generate

```bash
# synthetic at scale (N variants per incident) — offline, deterministic
python3 generate.py --n 20           # -> 300 scenarios + trajectories.jsonl

# live-verified anchors from the running GKE bench (real evidence)
source /Users/mei/rl/gcp-bench/env.sh
export GCP_PROJECT=<project>
python3 capture_live.py crashloop node_not_ready oom_kill
```

Each synthetic scenario is **deterministic** in `(incident, seed)`: re-running
`generate.py` reproduces byte-identical output. Variants differ by realistic
GKE-style identifiers (pod replicaset hashes, node names, cluster) while the
service/namespace and the causal evidence stay the incident's canonical ones.

## What a scenario contains

| file | role |
|---|---|
| `alert.json` | the trigger (opensre alert shape) |
| `scenario.yml` | metadata + `adversarial_signals` (red herrings) + `available_evidence` |
| `<evidence>.json` | observable state, one per read-tool (`k8s_pods`, `k8s_events`, `k8s_pod_logs`, …) |
| `answer.yml` | ground-truth root cause + `optimal_trajectory` + **`remediation`** (fix + state_before→after) |

The JSONL `trajectory[]` is the rendered investigation (optimal read sequence →
evidence) + the remediation step + `end_incident` — the same alternating
assistant/tool shape as the repo's FIREBALL SFT records, so it drops into the
existing `fmt.py` chat/preference formatters.

## Relationship to the repo

- **Source of truth:** `gcp-bench/scenarios/registry.json` (the 15 incidents:
  metric/slo/fault/fix) + `cre-*.yaml` (diagnosis) + `tools_registry.json` (25 tools/tiers).
- **Live substrate:** the GKE bench (`gcp-bench/`) provides the real cluster the
  `capture_live.py` anchors are snapshotted from.
- **vs the old FIREBALL data** (`incidents.jsonl`): same before→fix→after spine,
  re-shaped into opensre's diagnosis-first scenario folders + scored against an
  explicit `answer.yml` (root cause, required keywords, optimal trajectory).
