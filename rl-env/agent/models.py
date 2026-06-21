"""The model roster — the frozen, swappable policies that generate trajectories.

A spanning set (weak + strong anchors across two providers) so cross-model runs
show real within-group reward spread (HUD task-design doctrine). Add a model by
adding a row; the runner iterates this dict.
"""

ROSTER = {
    "claude-opus-4-8": {
        "provider": "anthropic", "model": "claude-opus-4-8", "anchor": "strong",
        "no_temperature": True,   # temperature is deprecated for this model
    },
    "glm-5p2": {
        "provider": "fireworks", "model": "accounts/fireworks/models/glm-5p2", "anchor": "strong",
    },
    "minimax-m3": {
        "provider": "fireworks", "model": "accounts/fireworks/models/minimax-m3", "anchor": "mid",
    },
    "claude-haiku-4-5": {
        "provider": "anthropic", "model": "claude-haiku-4-5-20251001", "anchor": "weak",
    },
    # qwen3.x / gemma drop in here once the exact Fireworks slugs are confirmed
    # (their account /models endpoint is down, so the slugs can't be enumerated).
}
