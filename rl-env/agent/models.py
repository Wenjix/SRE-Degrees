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
    # --- cross-provider frontier models via the HUD inference gateway (one key) ---
    # These are reasoning models that only accept the default temperature, hence
    # no_temperature; the gateway is OpenAI-compatible chat. Enumerated from
    # `hud models list` against https://inference.beta.hud.ai.
    "gpt-5.5": {
        "provider": "gateway", "model": "gpt-5.5", "anchor": "strong", "no_temperature": True,
    },
    "gemini-3.1-pro": {
        "provider": "gateway", "model": "gemini-3.1-pro-preview", "anchor": "strong", "no_temperature": True,
    },
    "deepseek-v4-pro": {
        "provider": "gateway", "model": "deepseek/deepseek-v4-pro", "anchor": "strong", "no_temperature": True,
    },
    "grok-4.3": {
        "provider": "gateway", "model": "grok-4.3", "anchor": "strong", "no_temperature": True,
    },
}
