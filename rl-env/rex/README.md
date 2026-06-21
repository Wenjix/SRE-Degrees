# REx — SRE remediation via refinement (vertical slice)

A frozen small model (haiku) proposes a remediation **candidate** = `{root_cause, ordered
tool-calls}`; the sim scores it; a safety **harness** gates each action; **feedback** (failing
checks as text) drives the next attempt — `propose → run → score → gate → refine → resolve`.
Linear today (the Thompson-sampling tree is the next lever).

## Run from a clean checkout
```bash
pip install -r requirements-rex.txt          # pyyaml + requests (NOT requirements.txt — that's the GPU/SFT stack)

# offline — no API keys needed (proposer/judge are injected as fakes in tests):
python3 -m pytest tests/test_rex_*.py tests/test_engine.py tests/test_spec.py

# live probes — need an Anthropic key:
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env
python3 -m rex.probe oom_kill                # GO/NO-GO: refine loop climbs on OOM
python3 -m rex.probe gcp_service_control     # hidden-root diagnostic climb (wrong->right)
```

## Layout
| file | what |
|---|---|
| `rex/loop.py` | linear refine loop (`refine_loop`) + `propose` (haiku), `parse_plan`, `build_prompt` |
| `rex/harness.py` | `load_scenario`, `run_plan` (dispatch through `sim/engine.py`), **`is_safe`** (2-layer safety), `build_state` |
| `rex/scoring.py` | graded `score_plan` + `format_feedback` + the phrasing-robust diagnosis **judge** |
| `rex/probe.py` | the GO/NO-GO + diagnostic-climb probes |

## Foundation it depends on (committed)
- `sim/engine.py`, `sim/spec.py` — Tier-A propagate sim (`apply_action` / root-cause-aware `is_resolved`)
- `agent/llm.py`, `agent/models.py` — frozen-model client + `ROSTER` (small = `claude-haiku-4-5`)
- `scenarios/cidg/*.yaml` — scenario specs (rex uses `01-gcp-service-control`, `21-leaf-oom-positive`)
- `tools_registry.json` — the 25-tool action space; `opensre-traj/specs/*.json` — per-incident
  `forbidden_categories` the harness reads
