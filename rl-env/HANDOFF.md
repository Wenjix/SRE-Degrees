# Infra-Ops Agent — training-ready handoff

Everything needed to train + evaluate the agent. Generated locally; **training scripts run on a
GPU (Colab/cloud) — not run here (no GPU).** Stack = Unsloth + HF CLI + Trackio (see
project-root `skills.md`, from Ben Burtenshaw's talk).

## Files → training role
| File | Role | Size |
|---|---|---|
| `incidents.jsonl` | **SFT** data — 150k correct trajectories (FIREBALL schema) | 434 MB |
| `pairs.jsonl` | **DPO** data — 30k winner/loser preference pairs | 177 MB |
| `rejections.jsonl` | 20k labeled failures (`failure_mode`) — RM / analysis | 60 MB |
| `verify.py` | **verifiable reward / eval** — rules-engine check of state_diff→SLO | — |
| `tools_registry.json` | 25 tools + trust tiers (guardrails/RLHF input) | — |
| `generate.py` / `generate_pathc.py` | regenerate / scale the data | — |
| `fmt.py` | trajectory ↔ chat / preference formatting (shared) | — |
| `train_sft.py` / `train_dpo.py` / `eval_agent.py` | training + eval | — |
| `framing-questions.md` | team alignment doc | — |

## Run order
```bash
pip install -r requirements.txt && huggingface-cli login
# 1) SFT
python train_sft.py --model unsloth/Qwen2.5-7B-Instruct --data incidents.jsonl --out qwen-infra-sft
# 2) DPO (from the SFT checkpoint)
python train_dpo.py --model qwen-infra-sft --data pairs.jsonl --out qwen-infra-dpo
# 3) Eval the headline number (run for each model)
python eval_agent.py --model unsloth/Qwen2.5-7B-Instruct --n 1000   # base
python eval_agent.py --model qwen-infra-sft --n 1000                # +SFT
python eval_agent.py --model qwen-infra-dpo --n 1000                # +DPO
```
Track runs in **Trackio** (`report_to="trackio"`), let a reporter agent read the raw Parquet
for the demo dashboard (skills.md, Boss 3).

## The result we're chasing (the pitch)
- **Headline:** fix-tool / incident-resolved accuracy, **base → +SFT → +DPO**, with a small
  Qwen **matching/beating a frontier baseline at a fraction of the token cost**.
- **Verifiable reward story:** `verify.py` gives Path-A **100%** and catches **100% of outcome
  failures**; it catches **0% of process failures** (they still resolve) → that's exactly why
  DPO/preference data exists. Two complementary signals, honestly shown.
- **Guardrails story:** every tool has a trust tier; demo a tool **auto-promoting**
  human-approval → autonomous after N consistent correct uses (RLHF).

## Honest gaps (say these, don't hide them)
- Data is **synthetic + templated** (like FIREBALL Path-A). Enrich thoughts with a teacher
  (free **MiniMax M3** to Jun 22) and/or real scraped RCAs to expand realism.
- `eval_agent.py` is the **single-decision proxy**; full multi-step agentic rollout needs a tool
  simulator (or kube-sre-gym) — replay then grade end-state with `verify.py`. Stretch goal.
