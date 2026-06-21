"""Real-world-incidents-only task list (same env + grader as hud_env)."""
import re
from hud_env import investigate, SCENARIOS  # noqa: F401  (env + MCP capability come with investigate)

real_ids = sorted(
    sid for sid in SCENARIOS
    if not re.search(r"-s\d+$", sid) and sid.split("-")[0].isdigit() and int(sid.split("-")[0]) >= 100
)
tasks = [investigate(scenario_id=i) for i in real_ids]
