#!/usr/bin/env bash
# Generate trajectory data by running the HUD env across the 4-model spanning set.
# Each rollout is a graded multi-step investigation; traces land per-model under
# out/hud_traces/<model>/ (the trajectory dataset). Aggregate with export_traces.py.
#
#   bash run_models.sh [GROUP]      # GROUP runs per task (default 2)
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ../.env; set +a
GROUP="${1:-2}"
HUD=../.venv-hud/bin/hud
BASE="$PWD/out/hud_traces"

run() {  # run <slug> <agent> [extra hud args...]
  local slug="$1" agent="$2"; shift 2
  export HUD_TELEMETRY_LOCAL_DIR="$BASE/$slug"
  mkdir -p "$HUD_TELEMETRY_LOCAL_DIR"
  echo "########## $slug ($agent) — 15 tasks x group=$GROUP ##########"
  $HUD eval hud_env.py "$agent" --full --group "$GROUP" --max-steps 10 -y "$@" 2>&1 \
    | grep -vE "Authlib|from authlib|compatible before|HUD_API_KEY" \
    | grep -iE "mean reward|runs:|success rate" || true
}

FW="-c base_url=https://api.fireworks.ai/inference/v1 -c api_key=$FIREWORKS_API_KEY"

run claude-haiku-4-5  claude            -m claude-haiku-4-5
run claude-opus-4-8   claude            -m claude-opus-4-8
run glm-5p2           openai_compatible -m accounts/fireworks/models/glm-5p2   $FW
run minimax-m3        openai_compatible -m accounts/fireworks/models/minimax-m3 $FW

echo "########## done — aggregate with: ../.venv-hud/bin/python export_traces.py ##########"
