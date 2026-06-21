"""Unified, frozen-LLM policy client across providers.

Three providers, one interface:
  - Anthropic  -> POST /v1/messages              (Claude Opus/Haiku, native)
  - Fireworks  -> POST /inference/v1/completions  (glm-5p2, minimax-m3, ...)
  - Gateway    -> POST /v1/chat/completions       (HUD inference gateway: one key,
                  many cross-provider frontier models — gpt-5.x, gemini-3.x,
                  deepseek-v4, grok, claude, ... all OpenAI-compatible chat)

The agent never fine-tunes these; they are swappable policies (see agent/models.py).
Keys load from the repo .env (gitignored): ANTHROPIC_API_KEY, FIREWORKS_API_KEY,
HUD_API_KEY (for the gateway). build_request() is pure (testable with no network);
call() performs the HTTP round-trip.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from agent.models import ROSTER

_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
_FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/completions"
_GATEWAY_URL = "https://inference.beta.hud.ai/v1/chat/completions"
_ANTHROPIC_VERSION = "2023-06-01"


def _load_env() -> None:
    """Populate os.environ from the repo .env for any key not already set."""
    env = Path(__file__).resolve().parent.parent / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def build_request(name: str, prompt: str, max_tokens: int = 512,
                  temperature: float = 0.1, system: str | None = None,
                  stop: list | None = None):
    """Resolve a roster name into (url, headers, payload) for its provider.
    Raises KeyError for an unknown model name."""
    _load_env()
    spec = ROSTER[name]
    provider, model = spec["provider"], spec["model"]

    if provider == "anthropic":
        headers = {
            "x-api-key": os.environ.get("ANTHROPIC_API_KEY", ""),
            "anthropic-version": _ANTHROPIC_VERSION,
            "content-type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        if not spec.get("no_temperature"):
            payload["temperature"] = temperature
        if system:
            payload["system"] = system
        if stop:
            payload["stop_sequences"] = stop
        return _ANTHROPIC_URL, headers, payload

    if provider == "fireworks":
        headers = {
            "Authorization": f"Bearer {os.environ.get('FIREWORKS_API_KEY', '')}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        # the completions endpoint has no system role, so `system` is prepended into the
        # prompt (Anthropic uses its native system field) — cross-provider scores are
        # therefore not strictly apples-to-apples.
        full = f"{system}\n\n{prompt}" if system else prompt
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": 1,
            "prompt": full,
        }
        if stop:
            payload["stop"] = stop
        return _FIREWORKS_URL, headers, payload

    if provider == "gateway":
        # OpenAI-compatible chat via the HUD inference gateway. Many frontier models
        # here are reasoning models that only accept the default temperature, so we
        # mark them no_temperature in the roster and omit it (REx gets its diversity
        # from per-node feedback, not sampling temperature).
        headers = {
            "Authorization": f"Bearer {os.environ.get('HUD_API_KEY', '')}",
            "Content-Type": "application/json",
        }
        messages = ([{"role": "system", "content": system}] if system else []) + \
                   [{"role": "user", "content": prompt}]
        payload = {"model": model, "max_tokens": max_tokens, "messages": messages}
        if not spec.get("no_temperature"):
            payload["temperature"] = temperature
        if stop:
            payload["stop"] = stop
        return _GATEWAY_URL, headers, payload

    raise ValueError(f"unknown provider {provider!r} for model {name!r}")


def _post(url: str, headers: dict, payload: dict, timeout: float = 180.0) -> dict:
    # requests bundles certifi (the macOS framework Python has no system cert store).
    import requests
    r = requests.post(url, headers=headers, data=json.dumps(payload), timeout=timeout)
    r.raise_for_status()
    return r.json()


def _extract(name: str, resp: dict) -> str:
    provider = ROSTER[name]["provider"]
    if provider == "anthropic":
        parts = resp.get("content", [])
        return "".join(p.get("text", "") for p in parts if p.get("type") == "text")
    if provider == "fireworks":
        return (resp.get("choices") or [{}])[0].get("text", "")
    if provider == "gateway":
        msg = (resp.get("choices") or [{}])[0].get("message", {}) or {}
        return msg.get("content", "") or ""
    return ""


def call(name: str, prompt: str, **kw) -> str:
    """Run one completion against `name`, return the text. Raises on transport error."""
    url, headers, payload = build_request(name, prompt, **kw)
    return _extract(name, _post(url, headers, payload))
