"""Run a REx scenario under HUD telemetry — observability / traceability / logging.

HUD (v6) is only importable from .venv-hud, so run this there:
    .venv-hud/bin/python -m rex.hud_run gcp_service_control

Every step of the REx run (propose -> run_plan -> score -> is_safe gate -> judge)
is wrapped with @hud.instrument, so the whole run is one HUD trace. Spans land in
HUD_TELEMETRY_LOCAL_DIR (default rex/runs/hud); inspect with:
    .venv-hud/bin/hud trace <id>     /     .venv-hud/bin/hud jobs
"""
from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("HUD_TELEMETRY_LOCAL_DIR", os.path.join(_HERE, "runs", "hud"))
os.makedirs(os.environ["HUD_TELEMETRY_LOCAL_DIR"], exist_ok=True)

import uuid  # noqa: E402

import hud  # noqa: E402  (must follow the env setup)
from hud.telemetry import flush  # noqa: E402
from hud.telemetry.context import set_trace_context  # noqa: E402

import rex.harness as H  # noqa: E402
import rex.scoring as S  # noqa: E402
import rex.tree as T  # noqa: E402
import rex.loop as L  # noqa: E402
from agent.llm import call  # noqa: E402
from rex.harness import load_scenario  # noqa: E402


def _instrument_call_path() -> None:
    """Wrap the REx functions so each call emits a HUD span. Reassign in every module
    that captured the reference (tree/loop import these by name)."""
    targets = {H: ["run_plan", "is_safe"], S: ["score_plan", "failed_checks", "judge_diagnosis"]}
    for mod, names in targets.items():
        for n in names:
            inst = hud.instrument(getattr(mod, n), name=f"rex.{n}")
            for other in (H, S, T, L):
                if hasattr(other, n):
                    setattr(other, n, inst)


@hud.instrument(name="rex.propose")
def _propose(scenario, prior_feedback):
    from rex.loop import build_prompt, parse_plan
    return parse_plan(call("claude-haiku-4-5", build_prompt(scenario, prior_feedback),
                           max_tokens=500, temperature=0.4))


@hud.instrument(name="rex.run")
def rex_run(name: str, budget: int = 5) -> dict:
    return T.rex_tree(load_scenario(name), budget=budget, propose_fn=_propose)  # real LLM judge


def main(argv: list) -> int:
    _instrument_call_path()
    name = argv[0] if argv else "gcp_service_control"
    trace_id = uuid.uuid4().hex
    with set_trace_context(trace_id):       # spans attach to this trace -> <trace_id>.jsonl
        res = rex_run(name)
    flush()
    print(f"REx[{name}] outcome={res['outcome']} best_score={res['best_score']} "
          f"nodes={len(res['nodes'])} engine={res.get('engine')}")
    print(f"HUD trace id: {trace_id}  (inspect: .venv-hud/bin/hud trace {trace_id})")
    files = [f for f in os.listdir(os.environ["HUD_TELEMETRY_LOCAL_DIR"]) if f.endswith(".jsonl")]
    print(f"HUD trace(s) written: {len(files)} -> {os.environ['HUD_TELEMETRY_LOCAL_DIR']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
