"""Run the frontier REx sweep UNDER HUD telemetry -> one registered job in the dashboard.

Each (model, incident) REx run becomes one registered HUD trace under a single job, so
https://hud.ai/jobs/<id> shows every frontier model's REx rollout with its reward and the
full span tree (rex.propose -> run_plan -> is_safe -> score_plan -> judge_diagnosis).

Unlike rex.hud_run (which only writes spans locally and 404s on upload because the trace
is never registered), this follows the platform contract:
  POST /trace/job/{job}/enter  -> register the batch job
  POST /trace/{trace}/enter    -> a rollout started (carries the model)
  ... run REx instrumented under set_trace_context(trace) ; flush() uploads its spans ...
  POST /trace/{trace}/exit     -> reward / status

    HUD_API_KEY=... .venv-hud/bin/python -m rex.hud_frontier
"""
from __future__ import annotations

import os
import uuid

_HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("HUD_TELEMETRY_LOCAL_DIR", os.path.join(_HERE, "runs", "hud"))
os.makedirs(os.environ["HUD_TELEMETRY_LOCAL_DIR"], exist_ok=True)

import hud  # noqa: E402
from hud.telemetry import flush  # noqa: E402
from hud.telemetry.context import set_trace_context  # noqa: E402
from hud.utils.platform import PlatformClient  # noqa: E402

import rex.harness as H  # noqa: E402
import rex.scoring as S  # noqa: E402
import rex.tree as T  # noqa: E402
import rex.loop as L  # noqa: E402
from agent.llm import call  # noqa: E402
from rex.harness import load_scenario  # noqa: E402

MODELS = ["claude-haiku-4-5", "claude-opus-4-8", "gpt-5.5", "gemini-3.1-pro", "deepseek-v4-pro"]
SCENARIOS = ["oom_kill", "gcp_service_control", "singleton_node_notready"]
BUDGET = 3
MAX_TOKENS = 4000


def _instrument_call_path() -> None:
    targets = {H: ["run_plan", "is_safe"], S: ["score_plan", "failed_checks", "judge_diagnosis"]}
    for mod, names in targets.items():
        for n in names:
            inst = hud.instrument(getattr(mod, n), name=f"rex.{n}")
            for other in (H, S, T, L):
                if hasattr(other, n):
                    setattr(other, n, inst)


def _make_propose(model: str):
    @hud.instrument(name="rex.propose")
    def _p(scenario, prior_feedback):
        from rex.loop import build_prompt, parse_plan
        return parse_plan(call(model, build_prompt(scenario, prior_feedback), max_tokens=MAX_TOKENS))
    return _p


@hud.instrument(name="rex.run")
def _rex_run(model: str, name: str) -> dict:
    return T.rex_tree(load_scenario(name), budget=BUDGET, propose_fn=_make_propose(model))


def main() -> int:
    _instrument_call_path()
    pc = PlatformClient.from_settings()
    job_id = uuid.uuid4().hex
    web = "https://hud.ai"
    try:
        pc.post(f"/trace/job/{job_id}/enter",
                json={"name": "REx frontier sweep (instrumented)", "group": 1})
    except Exception as e:
        print(f"job enter failed (telemetry off / no key?): {e}")
    print(f"JOB: {web}/jobs/{job_id}\n")

    for model in MODELS:
        for name in SCENARIOS:
            trace_id = uuid.uuid4().hex
            try:
                pc.post(f"/trace/{trace_id}/enter", json={"job_id": job_id, "model": model})
            except Exception as e:
                print(f"  trace enter err: {e}")
            with set_trace_context(trace_id):
                res = _rex_run(model, name)
            flush()
            try:
                pc.post(f"/trace/{trace_id}/exit",
                        json={"status": "completed", "reward": res["best_score"]})
            except Exception as e:
                print(f"  trace exit err: {e}")
            print(f"  {model:18} {name:24} best={res['best_score']:.3f} "
                  f"outcome={res['outcome']:9} nodes={len(res['nodes'])}")
    print(f"\nDONE -> {web}/jobs/{job_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
