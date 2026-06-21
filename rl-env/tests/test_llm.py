"""TDD for the unified model client (Anthropic messages + Fireworks completions).

Request-shape tests are pure (no network). A separate live smoke (test_llm_live)
is opt-in via RUN_LIVE_LLM=1 so CI stays offline/free.
"""
import os

import pytest

from agent.llm import build_request


def test_anthropic_request_shape():
    url, headers, payload = build_request("claude-opus-4-8", "ping", max_tokens=16)
    assert url == "https://api.anthropic.com/v1/messages"
    assert headers.get("x-api-key")                       # resolved from env/.env
    assert headers.get("anthropic-version")
    assert payload["model"] == "claude-opus-4-8"
    assert payload["max_tokens"] == 16
    assert payload["messages"][-1]["content"] == "ping"


def test_fireworks_request_shape():
    url, headers, payload = build_request("glm-5p2", "ping", max_tokens=16)
    assert url == "https://api.fireworks.ai/inference/v1/completions"
    assert headers.get("Authorization", "").startswith("Bearer ")
    assert payload["model"] == "accounts/fireworks/models/glm-5p2"
    assert "ping" in payload["prompt"]                    # text-completion endpoint


def test_unknown_model_raises():
    with pytest.raises(KeyError):
        build_request("not-a-model", "ping")


@pytest.mark.skipif(os.environ.get("RUN_LIVE_LLM") != "1",
                    reason="set RUN_LIVE_LLM=1 to hit real APIs")
@pytest.mark.parametrize("name", ["claude-opus-4-8", "claude-haiku-4-5", "glm-5p2", "minimax-m3"])
def test_live_completion(name):
    from agent.llm import call
    out = call(name, "Reply with exactly the word: pong", max_tokens=16)
    assert out and isinstance(out, str)
