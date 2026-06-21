# Infra-Ops Agent — verifiable RL environment + dataset for incident resolution

Train a small open model into a **platform-engineering / SRE agent** that resolves production
incidents — and **measure it with a verifiable reward**, not an LLM-judge.

The agent loop is a **verifiable state-transition task**:

```
system state (metrics / logs / alerts)  →  agent picks a tool  →  new state  →  resolved?
```

Inspired by the FIREBALL D&D dataset (structured before/after game state). Same idea, real
domain: `combat_state_before → command → combat_state_after` becomes
`system_state_before → remediation_tool → system_state_after`.

## What's here

| File | Role |
|---|---|
| `generate.py` | Synthesize SFT trajectories (15 incident types, 25-tool registry w/ trust tiers) |
| `generate_pathc.py` | Path C — failure trajectories + winner/loser **DPO preference pairs** |
| `verify.py` | **Verifiable reward / eval** — rules-engine check: did the metric cross back under SLO? |
| `fmt.py` | Trajectory ↔ chat / preference formatting |
| `train_sft.py` · `train_dpo.py` | **Unsloth + HF CLI** fine-tuning (Qwen 8B/14B) |
| `eval_agent.py` | Fix-tool accuracy (base → SFT → DPO) |
| `tools_registry.json` | 25 tools with trust tiers (`autonomous` / `approval` / `blocked`) |
| `HANDOFF.md` | One-page run order + file→role map |

## Quickstart

```bash
pip install -r requirements.txt

# 1) generate data (regenerates the full set locally; ~5s for 150k)
python generate.py --n 150000 --out incidents.jsonl          # SFT
python generate_pathc.py --rej 20000 --pairs 30000           # DPO pairs + rejections

# 2) verify the reward signal
python verify.py incidents.jsonl --sample 5000               # Path A
python verify.py rejections.jsonl --pathc-rejections         # failure discrimination

# 3) train (GPU / Colab)
python train_sft.py --model unsloth/Qwen2.5-7B-Instruct --data incidents.jsonl
python train_dpo.py --model qwen-infra-sft --data pairs.jsonl
python eval_agent.py --model qwen-infra-dpo --n 1000
```

> Data files (`*.jsonl`) are gitignored here — get them from Hugging Face (below) or
> regenerate locally with the scripts above (seeded → reproducible). Training runs on a GPU.

## Data (Hugging Face)

Pre-generated dataset: **https://huggingface.co/datasets/quantranger/infra-ops-incidents**
(`incidents.jsonl` 150k · `pairs.jsonl` 30k · `rejections.jsonl` 20k).

```python
from datasets import load_dataset
sft  = load_dataset("quantranger/infra-ops-incidents", data_files="incidents.jsonl", split="train")
dpo  = load_dataset("quantranger/infra-ops-incidents", data_files="pairs.jsonl",      split="train")
```
Or `hf download quantranger/infra-ops-incidents --repo-type dataset --local-dir .`

## Incident taxonomy (the "issues we replicate")

`oom_kill`, `crashloop`, `latency_spike`, `bad_deploy_errors`, `disk_pressure`, `cert_expiry`,
`memory_leak`, `db_pool_exhaustion`, `node_not_ready`, `consumer_lag`, `dns_failure`,
`upstream_5xx`, `cpu_saturation`, `stuck_rollout`, `cache_stampede`.

## Key design points

- **Verifiable reward.** Resolution = the affected metric returns under its `slo_threshold`.
  Deterministic, path-independent. Binary reward baseline (resolved = 1).
- **Two reward signals, honestly separated.** The verifier catches **100% of *outcome*
  failures** (wrong tool, premature close, unsafe action) but **0% of *process* failures**
  (skipped diagnosis, hallucinated args) — because those still resolve. That gap is exactly
  what the **DPO preference pairs** are for.
- **Trust-graduated guardrails.** Every tool has a trust tier; the design promotes a tool from
  `human-approval` → `autonomous` (or demotes it) based on proven consistency (RLHF), like a
  junior engineer earning trust.

## License

MIT — see `LICENSE`.
