"""No-tools variant of the incident-diagnosis env, for models without function-calling
(e.g. gemma served via ollama). All evidence is inlined in the prompt; the agent gives
a one-shot diagnosis. Same substance grader as the tool env.

  ../.venv-hud/bin/hud eval hud_env_static.py openai_compatible \
      -m gemma3:1b -c base_url=http://localhost:11434/v1 -c api_key=ollama -y
"""
import json

from hud import Environment

from hud_env import (SCENARIOS, CATEGORIES, _redact_alert, _grade, canonical_ids)

env = Environment(name="cidg-incident-static")  # NO capability -> no tools sent to the model

STATIC_PROMPT = """You are the on-call SRE. An alert fired and ALL the collected evidence is below.
Reason over it and report EXACTLY:

ROOT_CAUSE: <1-2 sentences: the specific failing component and the mechanism>
ROOT_CAUSE_CATEGORY: <one of: {cats}>
FIX: <the single remediation action you would run>

ALERT:
{alert}

EVIDENCE:
{evidence}
"""


def _evidence_text(rec):
    out = []
    for name, content in (rec.get("evidence") or {}).items():
        out.append(f"### {name}\n{json.dumps(content, indent=2)[:1800]}")
    return "\n\n".join(out)


@env.template()
async def investigate_static(scenario_id: str = "001-oom_kill"):
    rec = SCENARIOS.get(scenario_id)
    if rec is None:
        raise KeyError(f"unknown scenario_id {scenario_id!r}")
    prompt = STATIC_PROMPT.format(
        cats=", ".join(CATEGORIES),
        alert=json.dumps(_redact_alert(rec["alert"]), indent=2),
        evidence=_evidence_text(rec),
    )
    answer = yield prompt
    yield await _grade(answer, rec)


tasks = [investigate_static(scenario_id=i) for i in canonical_ids()]
