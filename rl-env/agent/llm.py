"""Unified, frozen-LLM policy client across providers.

Two providers, one interface:
  - Anthropic  -> POST /v1/messages          (Claude Opus/Haiku)
  - Fireworks  -> POST /inference/v1/completions  (glm-5p2, minimax-m3, ...)

The agent never fine-tunes these; they are swappable policies (see agent/models.py).
Keys load from the repo .env (gitignored). build_request() is pure (testable with
no network); call() performs the HTTP round-trip.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from agent.models import ROSTER

_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
_FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/completions"
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

    raise ValueError(f"unknown provider {provider!r} for model {name!r}")


def _post(url: str, headers: dict, payload: dict, timeout: float = 90.0) -> dict:
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
    return ""


def call(name: str, prompt: str, **kw) -> str:
    """Run one completion against `name`, return the text. Raises on transport error."""
    url, headers, payload = build_request(name, prompt, **kw)
    return _extract(name, _post(url, headers, payload))
