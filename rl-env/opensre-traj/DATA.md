# Trajectory dataset — `out/hud_trajectories.jsonl`

Graded multi-step incident-diagnosis rollouts produced by running `hud_env.py`
through HUD v6 across a model spanning set. One JSON object per rollout.

## Record schema
```jsonc
{
  "model": "claude-opus-4-8",
  "trace_id": "…",                 // raw trace under out/hud_traces/<model>/<trace_id>.jsonl
  "scenario_id": "002-cpu_saturation",
  "incident": "cpu_saturation",
  "reward": 0.7738,                 // weighted sum of subscores (0–1)
  "subscores": {                    // the substance grade
    "root_cause_category": 1.0,     // weight 0.45 — matched true category (not a forbidden one)
    "evidence_keywords": 0.857,     // weight 0.30 — fraction of required mechanism terms present
    "ruled_out_red_herrings": 0.667,// weight 0.10 — ruled out the adversarial signals
    "remediation_tool": 0.0         // weight 0.15 — named the canonical fix tool
  },
  "n_tool_calls": 8,                // diagnostic tools invoked (multi-step)
  "tools_used": ["get_metrics", "get_logs", …],
  "n_agent_steps": 9,
  "answer": "ROOT_CAUSE: …\nROOT_CAUSE_CATEGORY: …\nFIX: …"
}
```

## Current contents (Claude half — generated on the origin machine)

| model | n | mean | std | min | max |
|---|---|---|---|---|---|
| claude-opus-4-8 (strong anchor) | 30 | 0.585 | 0.196 | 0.22 | 0.77 |
| claude-haiku-4-5 (weak anchor)  | 30 | 0.428 | 0.226 | 0.13 | 0.76 |

Per-incident difficulty (mean over both models), hardest → easiest:
`crashloop 0.22 · db_pool_exhaustion 0.24 · dns_failure 0.29 · cache_stampede 0.30 ·
oom_kill 0.45 · … · upstream_5xx 0.72 · cert_expiry 0.73`.

**Pending (teammate):** `glm-5p2`, `minimax-m3` via Fireworks — rate-limited on the
origin account; generated separately and merged in (see below).

## Regenerate / extend
```bash
cd opensre-traj
../.venv-hud/bin/python generate.py --n 20            # build out/trajectories.jsonl (the env corpus)
bash run_models.sh 2                                  # run the spanning set (group=2)
../.venv-hud/bin/python export_traces.py              # -> out/hud_trajectories.jsonl + leaderboard
```

## Merge the Fireworks half
Drop the teammate's `out/hud_traces/glm-5p2/` and `out/hud_traces/minimax-m3/`
directories into `opensre-traj/out/hud_traces/`, then re-run:
```bash
../.venv-hud/bin/python export_traces.py
```
`export_traces.py` rebuilds `hud_trajectories.jsonl` from *all* model dirs present, so
the combined 4-model dataset + leaderboard appear automatically. (Or, if they sent a
`hud_trajectories.jsonl`, just concatenate it — records are independent lines.)
