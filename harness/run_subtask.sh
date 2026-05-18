#!/usr/bin/env bash
# Inner loop for ONE sub-ticket: qwen implements -> screenshot -> visual QA.
# Visual QA is done by gemini-flash; if gemini is unavailable, claude does that
# round's QA (qwen cannot see images, so qwen is never the QA agent).
#
#   harness/run_subtask.sh <sub-ticket-dir>
#
# Exit: 0 = passed (committed)   1 = failed after MAX_ITER   2 = tool failure

set -uo pipefail
source "$(dirname "$0")/lib.sh"

SUBDIR="${1:?usage: run_subtask.sh <sub-ticket-dir>}"
SUBDIR="${SUBDIR%/}"
TICKET_FILE="$SUBDIR/ticket.md"
[ -f "$TICKET_FILE" ] || { log "ERROR: $TICKET_FILE not found"; exit 1; }

FEEDBACK="$SUBDIR/feedback.md"
LABEL="$(basename "$(dirname "$(dirname "$SUBDIR")")")/$(basename "$SUBDIR")"
: > "$SUBDIR/log.txt"
exec > >(tee -a "$SUBDIR/log.txt") 2>&1
trap 'stop_game' EXIT

log "=== sub-ticket: $LABEL ==="
coder_toolfail=0

for (( iter=1; iter<=MAX_ITER; iter++ )); do
  log "--- $LABEL : iteration $iter/$MAX_ITER ---"
  ARTI="$SUBDIR/artifacts/iter-$iter"
  mkdir -p "$ARTI"

  # 1. CODER (qwen)
  log "[qwen] implementing..."
  CODER_PROMPT="$(render_prompt "$PROMPTS_DIR/implement.md" \
    TICKET_FILE "$TICKET_FILE" FEEDBACK_FILE "$FEEDBACK")"
  if ! run_qwen "$CODER_PROMPT" "$ARTI/qwen.txt"; then
    coder_toolfail=$((coder_toolfail + 1))
    log "[tool-failure] qwen coder unavailable ($coder_toolfail consecutive)"
    if [ "$coder_toolfail" -ge 2 ]; then
      log "=== ABORT $LABEL: coder tool repeatedly unavailable — escalating ==="
      exit 2
    fi
    continue
  fi
  coder_toolfail=0

  # 2. Start game + capture screenshots
  log "[game] starting servers..."
  start_game "$ARTI"
  if wait_for_game 45; then
    log "[playwright] capturing screenshots..."
    node "$HARNESS_DIR/screenshot.mjs" "$GAME_URL" "$ARTI" > "$ARTI/screenshot.log" 2>&1
  else
    log "[game] SERVERS FAILED TO START"
    echo '{"ok":false,"error":"servers did not start"}' > "$ARTI/metrics.json"
    : > "$ARTI/console.log"; : > "$ARTI/server.log"; : > "$ARTI/client.log"
  fi
  stop_game

  # 3. QA — gemini-flash primary, claude fallback (qwen cannot see images)
  log "[qa] verifying against acceptance criteria..."
  QA_PROMPT="$(render_prompt "$PROMPTS_DIR/qa.md" \
    TICKET_FILE "$TICKET_FILE" ARTIFACTS_DIR "$ARTI")"
  if run_gemini "$QA_PROMPT" "$ARTI/qa.txt" && ! gemini_unavailable "$ARTI/qa.txt"; then
    log "[qa] verified by gemini-flash"
  else
    log "[qa] gemini unavailable — falling back to claude for visual QA"
    run_claude "$QA_PROMPT" "$ARTI/qa.txt"
  fi

  # 4. Verdict
  if is_pass "$ARTI/qa.txt"; then
    log "[qa] PASS"
    if ! commit_verified "$LABEL: sub-ticket verified (iter $iter)"; then
      log "=== ABORT $LABEL: could not commit verified progress — escalating ==="
      exit 2
    fi
    log "=== sub-ticket PASSED: $LABEL ==="
    exit 0
  fi

  log "[qa] FAIL — accumulating feedback"
  {
    printf '\n## QA feedback — iteration %d (%s)\n\n' "$iter" "$(date '+%F %T')"
    cat "$ARTI/qa.txt"
    printf '\n'
  } >> "$FEEDBACK"
done

log "=== sub-ticket FAILED after $MAX_ITER iterations: $LABEL — reverting ==="
revert_game_changes
exit 1
