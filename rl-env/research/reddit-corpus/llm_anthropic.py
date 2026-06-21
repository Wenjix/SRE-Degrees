#!/usr/bin/env python3
"""
Synthesis helper — calls Claude Sonnet 4.5 directly via Anthropic API.

Why direct (not TokenRouter): the user's Anthropic API key is more reliable than
the TokenRouter proxy for this use case. TokenRouter was failing intermittently
on long contexts.

Usage:
    export ANTHROPIC_API_KEY=...      # already in ~/.hermes/.env
    python3 llm_anthropic.py --prompt "..." [--out path] [--max-tokens 3500] [--model claude-sonnet-4-5]

The script reads the key from ~/.hermes/.env if not set in env.
"""
import argparse, json, os, subprocess, sys
from pathlib import Path


def load_key():
    """Read ANTHROPIC_API_KEY from env, falling back to ~/.hermes/.env."""
    k = os.environ.get("ANTHROPIC_API_KEY")
    if k:
        return k
    env_file = Path.home() / ".hermes" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("ANTHROPIC_API_KEY=") and not line.startswith("#"):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("ANTHROPIC_API_KEY not found in env or ~/.hermes/.env")


def call_claude(prompt: str, model: str = "claude-opus-4-8", max_tokens: int = 3500,
                system: str = "You are a sharp analyst. Be specific. Avoid filler."):
    """Call Anthropic Messages API via curl. Returns (text, usage_dict)."""
    key = load_key()
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
    }

    # Write payload to temp file (avoids shell quoting on long prompts)
    payload_file = "/tmp/_claude_payload.json"
    Path(payload_file).write_text(json.dumps(payload, ensure_ascii=False))

    r = subprocess.run(
        ["curl", "-sL", "--max-time", "180",
         "-H", f"x-api-key: {key}",
         "-H", "anthropic-version: 2023-06-01",
         "-H", "Content-Type: application/json",
         "--data-binary", f"@{payload_file}",
         "https://api.anthropic.com/v1/messages"],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        raise RuntimeError(f"curl rc={r.returncode}: {r.stderr[:200]}")
    try:
        resp = json.loads(r.stdout)
    except Exception as e:
        raise RuntimeError(f"parse err: {e}; body[:500]={r.stdout[:500]}")

    if "error" in resp:
        raise RuntimeError(f"API error: {resp['error']}")
    if "content" not in resp or not resp["content"]:
        raise RuntimeError(f"unexpected response: {json.dumps(resp)[:500]}")

    text = "".join(c.get("text", "") for c in resp["content"] if c.get("type") == "text")
    usage = resp.get("usage", {})
    return text, usage


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--system", default="You are a sharp analyst. Be specific. Avoid filler.")
    ap.add_argument("--model", default="claude-sonnet-4-5")
    ap.add_argument("--max-tokens", type=int, default=3500)
    ap.add_argument("--out", help="Write output to this file (otherwise print to stdout)")
    args = ap.parse_args()

    text, usage = call_claude(args.prompt, args.model, args.max_tokens, args.system)
    if args.out:
        Path(args.out).write_text(text)
        print(f"Wrote {len(text)} chars → {args.out}")
    else:
        print(text)
    print(f"\n[usage: in={usage.get('input_tokens')} out={usage.get('output_tokens')}]", file=sys.stderr)


if __name__ == "__main__":
    main()