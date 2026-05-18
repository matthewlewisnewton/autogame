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
HANDOFF="$SUBDIR/handoff.md"
# QA routing: a sub-ticket declares `## Verification: visual|code`. Visual
# changes are checked from screenshots; code/non-visual ones from the diff+logs.
QA_MODE="$(grep -ioE 'verification[: ]+[a-z]+' "$TICKET_FILE" 2>/dev/null | grep -ioE 'visual|code' | head -1 | tr 'A-Z' 'a-z')"
[ -z "$QA_MODE" ] && QA_MODE="visual"
LABEL="$(basename "$(dirname "$(dirname "$SUBDIR")")")/$(basename "$SUBDIR")"
: > "$SUBDIR/log.txt"
exec > >(tee -a "$SUBDIR/log.txt") 2>&1
trap 'stop_game' EXIT

log "=== sub-ticket: $LABEL — QA mode: $QA_MODE ==="
coder_toolfail=0

for (( iter=1; iter<=MAX_ITER; iter++ )); do
  log "--- $LABEL : iteration $iter/$MAX_ITER ---"
  ARTI="$SUBDIR/artifacts/iter-$iter"
  mkdir -p "$ARTI"

  # 1. CODER (qwen)
  log "[qwen] implementing..."
  CODER_PROMPT="$(render_prompt "$PROMPTS_DIR/implement.md" \
    TICKET_FILE "$TICKET_FILE" FEEDBACK_FILE "$FEEDBACK" HANDOFF_FILE "$HANDOFF")"
  handoff_before="$(stat -c %Y "$HANDOFF" 2>/dev/null || echo 0)"
  run_qwen "$CODER_PROMPT" "$ARTI/qwen.txt"; coder_rc=$?

  # Guarantee a handoff note exists for the next session. If qwen ran out of
  # context / crashed before writing its own, the harness "moves it over" by
  # synthesizing one from the attempt log — context continuity is the harness's
  # job, not something we rely on qwen's in-session compaction to preserve.
  if [ "$(stat -c %Y "$HANDOFF" 2>/dev/null || echo 0)" = "$handoff_before" ]; then
    log "[handoff] no handoff left by qwen — harness synthesizing one"
    {
      printf '## Harness fallback handoff — attempt %d did not finish cleanly\n\n' "$iter"
      printf 'The previous attempt left no handoff note — it likely ran out of\n'
      printf 'context, timed out, or errored. Inspect the working tree under `game/`\n'
      printf 'for partial changes and continue this sub-ticket from there.\n\n'
      printf 'Tail of the previous attempt log:\n\n```\n'
      tail -n 40 "$ARTI/qwen.txt" 2>/dev/null
      printf '\n```\n'
    } > "$HANDOFF"
  fi

  if [ "$coder_rc" -ne 0 ]; then
    coder_toolfail=$((coder_toolfail + 1))
    log "[tool-failure] qwen coder call failed ($coder_toolfail consecutive)"
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
    node "$HARNESS_DIR/screenshot.mjs" "$GAME_URL" "$ARTI" </dev/null > "$ARTI/screenshot.log" 2>&1
  else
    log "[game] SERVERS FAILED TO START"
    echo '{"ok":false,"error":"servers did not start"}' > "$ARTI/metrics.json"
    : > "$ARTI/console.log"; : > "$ARTI/server.log"; : > "$ARTI/client.log"
  fi
  stop_game

  # 3. QA — routed by the sub-ticket's verification mode.
  #    gemini-flash primary; claude fallback (qwen cannot see images).
  git diff HEAD -- game/ > "$ARTI/changes.diff" 2>/dev/null || : > "$ARTI/changes.diff"
  if [ "$QA_MODE" = "code" ]; then
    log "[qa] code-review QA (non-visual sub-ticket)..."
    QA_PROMPT="$(render_prompt "$PROMPTS_DIR/qa-code.md" \
      TICKET_FILE "$TICKET_FILE" ARTIFACTS_DIR "$ARTI" DIFF_FILE "$ARTI/changes.diff")"
  else
    log "[qa] visual QA (screenshots)..."
    QA_PROMPT="$(render_prompt "$PROMPTS_DIR/qa.md" \
      TICKET_FILE "$TICKET_FILE" ARTIFACTS_DIR "$ARTI")"
  fi
  # QA agent chain: gemini-3-flash (primary) -> cursor-agent/composer-2
  # (fallback) -> claude (last resort). Each tier is accepted only if it
  # produced a real verdict line.
  if run_gemini "$QA_PROMPT" "$ARTI/qa.txt" && has_verdict "$ARTI/qa.txt"; then
    log "[qa] verified by gemini ($QA_MODE)"
  elif run_agent "$QA_PROMPT" "$ARTI/qa.txt" && has_verdict "$ARTI/qa.txt"; then
    log "[qa] verified by cursor-agent/$AGENT_MODEL ($QA_MODE)"
  else
    log "[qa] gemini + agent produced no verdict — last-resort claude"
    if ! run_claude "$QA_PROMPT" "$ARTI/qa.txt"; then
      log "[tool-failure] claude QA unavailable (timeout/empty) after gemini+agent — escalating"
      exit 2
    fi
    if ! has_verdict "$ARTI/qa.txt"; then
      log "[tool-failure] claude QA produced no VERDICT: PASS|FAIL line — escalating"
      exit 2
    fi
    log "[qa] verified by claude ($QA_MODE)"
  fi

  # 4. Verdict
  if is_pass "$ARTI/qa.txt"; then
    log "[qa] PASS — dispatching qwen to commit the verified change"
    head_before="$(git rev-parse HEAD)"
    COMMIT_PROMPT="$(render_prompt "$PROMPTS_DIR/commit.md" \
      TICKET_FILE "$TICKET_FILE" LABEL "$LABEL")"
    run_qwen "$COMMIT_PROMPT" "$ARTI/commit.txt"
    # The harness still GUARANTEES verified progress is committed: if qwen left
    # anything uncommitted, commit the remainder deterministically.
    if [ -n "$(git status --porcelain)" ]; then
      log "[commit] qwen left changes uncommitted — harness committing remainder"
      commit_verified "$LABEL: sub-ticket verified (iter $iter)" || true
    fi
    if [ -n "$(git status --porcelain)" ]; then
      log "=== ABORT $LABEL: could not commit verified progress — escalating ==="
      exit 2
    fi
    if [ "$(git rev-parse HEAD)" != "$head_before" ]; then
      log "[commit] $(git log -1 --format='%h %s')"
    else
      log "[commit] no new changes — verified state already in HEAD"
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
