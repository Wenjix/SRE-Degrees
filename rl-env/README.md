# SRE Research Environment

This directory contains the research substrate behind SRE Promotion Engine:
incident simulators, trajectory generators, frozen-model refinement loops, and
live-cluster validation scaffolding for autonomous SRE agents.

The current repo is **not** a completed SFT/DPO training package. Earlier notes
about root-level `train_sft.py`, `train_dpo.py`, `eval_agent.py`, `verify.py`,
and `generate_pathc.py` are obsolete. The current, runnable path is:

```text
scenario specs -> Tier-A sim / opensre corpus -> frozen-model evals -> REx refinement
```

## What Is Implemented

| Area | Files | What it does |
|---|---|---|
| Tier-A sim | `sim/engine.py`, `sim/spec.py`, `scenarios/cidg/*.yaml` | Deterministic graph simulator with root-cause-aware resolution. |
| REx harness | `rex/` | Runs frozen-model plans through safety gating, scoring, feedback, Thompson-tree refinement, and escalation. |
| opensre trajectory generator | `opensre-traj/` | Renders 15 synthetic canonical incidents plus 19 real-postmortem-derived incidents into opensre-style folders and JSONL. |
| HUD eval env | `opensre-traj/hud_env.py` | Exposes evidence through MCP tools and grades category, evidence use, red-herring handling, and remediation tool. |
| Live single-fault benches | `gcp-bench/`, `linode-bench/` | Provision Kubernetes, inject faults, verify metric/alert/action/recovery loops. |
| Scoped physical cascade | `mreal/` | Real HTTP call mesh where upstream faults propagate to downstream victims through actual requests. |

## Quickstart

```bash
# lightweight runtime: PyYAML + requests
pip install -r requirements-rex.txt

# offline, deterministic tests
python3 -m pytest tests/test_rex_*.py tests/test_engine.py tests/test_spec.py

# generate an opensre-style corpus into a temp directory
python3 opensre-traj/generate.py --n 1 --out /tmp/opensre-smoke
```

Expected offline test status at the time of this README update:

```text
68 passed
```

The generator smoke test should emit 34 records: 15 synthetic canonical
incidents plus 19 real-postmortem-derived incidents.

## Live / Keyed Runs

REx probes require provider keys in `rl-env/.env`:

```bash
python3 -m rex.probe oom_kill
python3 -m rex.probe gcp_service_control
python3 -m rex.frontier
```

HUD trajectory evals require a HUD venv at `rl-env/.venv-hud` plus provider keys:

```bash
cd opensre-traj
bash run_models.sh 2
../.venv-hud/bin/python export_traces.py
```

Live Kubernetes validation requires cloud credentials and should be run only when
you intend to create billable resources:

```bash
cd gcp-bench
source env.sh
bash stages/00_preflight.sh
bash orchestrator/run_all.sh

# scoped real HTTP cascade mesh, reusing the GKE bench kubeconfig
bash ../mreal/deploy.sh
```

## Reward Signals

Keep these reward tracks separate:

- **REx reward:** graded score over diagnosis, correct fix, root-aware
  resolution, and trap avoidance:

  ```text
  score = 0.30*diagnosis + 0.25*correct_fix + 0.45*resolved - 0.60*trap
  ```

- **Live bench recovery reward:** binary check that the runbook loop recovered,
  executed the canonical action, and satisfied guardrails. This validates the
  infrastructure loop, but it is not the same as REx's root-cause-aware score.

- **HUD diagnosis reward:** weighted substance score over root-cause category,
  evidence keywords, red-herring handling, and remediation tool.

## Current Evidence

- Offline tests validate the simulator, spec loader, REx loop mechanics, safety
  gate, scoring, escalation, and Thompson-tree refinement with fake proposers and
  deterministic judges.
- `opensre-traj/DATA.md` records 60 Claude HUD rollouts generated on the origin
  machine; raw traces are not committed in this checkout.
- The root README's 5-incident x 5-model REx table is preliminary calibration.
  Archive `rex/runs/*.json`, HUD traces, model IDs, prompts, outputs, seeds, and
  run dates before using it in a paper.

## Publication Direction

The strongest paper direction is a verifiable SRE incident-response environment,
not a broad claim that the repo already trained an autonomous SRE agent.

Before submission, prioritize:

1. Expand evaluation from 5 REx incidents to the 15 canonical synthetic specs and
   the 19 held-out real-postmortem-derived specs.
2. Run ablations: zero-shot, naive retry, scalar-only feedback, no gold-root
   reveal, no safety gate, reward-component removals, and judge variants.
3. Validate M-real sign agreement for loudest victim, root location, and
   trap-worsens bit.
4. Publish immutable artifacts for every result table.
5. Only then run SFT/DPO/RLVR or HUD training on an open model, with confidence
   intervals, safety violations, and cost per clean win.

## Requirements Notes

- `requirements-rex.txt` is the lightweight runtime for sim + REx.
- `requirements.txt` is the GPU/SFT stack. Install it only on a GPU box or
  Colab, not on a dev laptop.
- Generated data under `opensre-traj/out/`, live bench `results/`, and raw HUD
  traces are gitignored. Regenerate or publish immutable external artifacts when
  claiming reproducibility.

## Key Docs

- `ARCHITECTURE.md` - research architecture and preliminary REx result table.
- `docs/ENVIRONMENT_DESIGN.md` - full design rationale, red-team critique,
  roadmap, and residual risks.
- `rex/README.md` - REx vertical slice and run order.
- `opensre-traj/SCHEMA.md` - opensre-compatible diagnosis/remediation schema.
- `opensre-traj/DATA.md` - HUD trajectory record schema and current rollout
  summary.
- `opensre-traj/real-incidents/catalog.md` - 19 first-party-postmortem-derived
  cascading incident specs.
