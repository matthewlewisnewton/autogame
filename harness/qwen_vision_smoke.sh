#!/usr/bin/env bash
# Smoke-test Qwen Code vision and Playwright MCP without changing global config.
#
# Usage:
#   bash harness/qwen_vision_smoke.sh [screenshot-or-image] [optional-live-url]
#
# The script uses QWEN_CODE_SYSTEM_SETTINGS_PATH for this process only. It does
# not create .qwen/settings.json and does not affect the normal harness coder.

set -uo pipefail
source "$(dirname "$0")/lib.sh"

IMAGE_PATH="${1:-}"
LIVE_URL="${2:-}"
SMOKE_DIR="${HARNESS_DIR}/tmp/qwen-vision-smoke-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SMOKE_DIR"

qwen_busy() {
  pgrep -f '(^| )qwen( |$)|/bin/qwen' >/dev/null 2>&1
}

if [ "${QWEN_VISION_FORCE:-0}" != "1" ]; then
  wait_seconds="${QWEN_VISION_WAIT_IDLE_SECONDS:-0}"
  deadline=$(( $(date +%s) + wait_seconds ))
  while qwen_busy; do
    if [ "$wait_seconds" -le 0 ] || [ "$(date +%s)" -ge "$deadline" ]; then
      log "ERROR: another qwen process is active; set QWEN_VISION_WAIT_IDLE_SECONDS or QWEN_VISION_FORCE=1 to override"
      exit 2
    fi
    log "[qwen-vision-smoke] waiting for qwen to become idle..."
    sleep 10
  done
fi

if [ -z "$IMAGE_PATH" ]; then
  # Prefer an existing screenshot artifact if one exists. This is only a smoke
  # helper, so a simple glob is enough and avoids depending on extra tooling.
  for candidate in tickets/*/subtickets/*/artifacts/iter-*/*.png; do
    [ -f "$candidate" ] || continue
    IMAGE_PATH="$candidate"
  done
fi

if [ -z "$IMAGE_PATH" ] || [ ! -f "$IMAGE_PATH" ]; then
  IMAGE_PATH="$SMOKE_DIR/red-square.png"
  printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAYAAADQHc7GAAAANElEQVR4nO3OMQEAMAgDsJz/0jmIEwy0gkjq3nuvYwL8DQH4GwLwNwTgbwjA3xCAvyEAf0MAoyQCdxC7yZwAAAAASUVORK5CYII=' | base64 -d > "$IMAGE_PATH"
fi

PROMPT="$(cat <<EOF
You are testing Qwen Code image and Playwright MCP support.

Explicitly call read_file on this image file as a vision input:
$IMAGE_PATH

If this URL is non-empty and reachable, use the Playwright MCP tools to inspect it:
$LIVE_URL

Reply with:
1. Whether you could inspect the image.
2. A one-sentence description of what the image shows.
3. Whether Playwright MCP tools were available, and what you did with them if a URL was provided.

End with exactly:
QWEN_VISION_SMOKE: DONE
EOF
)"

log "[qwen-vision-smoke] image: $IMAGE_PATH"
[ -n "$LIVE_URL" ] && log "[qwen-vision-smoke] url: $LIVE_URL"
run_qwen_vision "$PROMPT" "$SMOKE_DIR/qwen-vision-smoke.txt" "$SMOKE_DIR"; rc=$?
log "[qwen-vision-smoke] output: $SMOKE_DIR/qwen-vision-smoke.txt"
exit "$rc"
