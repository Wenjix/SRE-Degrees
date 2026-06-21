#!/usr/bin/env bash
# Generate trajectories for the 19 real-world incidents across the spanning set,
# into the same out/hud_traces/<model>/ dirs so they merge with the synthetic data.
set -euo pipefail
cd "$(dirname "$0")"; set -a; . ../.env; set +a
GROUP="${1:-2}"; HUD=../.venv-hud/bin/hud; BASE="$PWD/out/hud_traces"
run() { local slug="$1" agent="$2"; shift 2
  export HUD_TELEMETRY_LOCAL_DIR="$BASE/$slug"; mkdir -p "$HUD_TELEMETRY_LOCAL_DIR"
  echo "########## REAL: $slug — 19 incidents x group=$GROUP ##########"
  $HUD eval hud_env_real.py "$agent" --full --group "$GROUP" --max-steps 10 -y "$@" 2>&1 \
    | grep -vE "Authlib|from authlib|compatible before|HUD_API_KEY" | grep -iE "mean reward|runs:|success" || true
}
FW="-c base_url=https://api.fireworks.ai/inference/v1 -c api_key=$FIREWORKS_API_KEY"
run claude-haiku-4-5 claude            -m claude-haiku-4-5
run claude-opus-4-8  claude            -m claude-opus-4-8
run kimi-k2p5        openai_compatible -m accounts/fireworks/models/kimi-k2p5 $FW --max-concurrent 1
echo "########## done — aggregate: ../.venv-hud/bin/python export_traces.py ##########"
