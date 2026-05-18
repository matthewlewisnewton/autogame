#!/usr/bin/env bash
# One top-level ticket end to end:
#   qwen decomposes it into sub-tickets
#   -> each sub-ticket runs the qwen+gemini loop (run_subtask.sh)
#   -> claude reviews the whole ticket against its acceptance criteria
# On a failed review, qwen adds remediation sub-tickets and the cycle repeats.
#
#   harness/run_ticket.sh <ticket-name>
#
# Exit: 0 = complete (committed + tagged)   1 = not completed   2 = tool failure

set -uo pipefail
source "$(dirname "$0")/lib.sh"

NAME="${1:?usage: run_ticket.sh <ticket-name>}"
TDIR="tickets/$NAME"
TICKET_FILE="$TDIR/ticket.md"
[ -f "$TICKET_FILE" ] || { log "ERROR: $TICKET_FILE not found"; exit 1; }

SUBROOT="$TDIR/subtickets"
REVIEW_FB="$TDIR/review-feedback.md"
mkdir -p "$SUBROOT"
: > "$TDIR/log.txt"
exec > >(tee -a "$TDIR/log.txt") 2>&1
trap 'stop_game' EXIT

BASE_REF="$(git rev-parse HEAD)"
log "########## top-level ticket: $NAME (baseline $BASE_REF) ##########"

for (( round=1; round<=TICKET_MAX_ROUNDS; round++ )); do
  log "========== $NAME : round $round/$TICKET_MAX_ROUNDS =========="

  # --- 1. DECOMPOSE (qwen) ---
  if [ "$round" -eq 1 ]; then
    REMEDIATION="This is the first decomposition of this ticket."
  else
    REMEDIATION="REMEDIATION ROUND. Existing sub-tickets are done but the top-level review found gaps. Read the review feedback at $REVIEW_FB and add ONLY new sub-tickets that close those gaps."
  fi
  log "[qwen] decomposing into sub-tickets..."
  DECOMP_PROMPT="$(render_prompt "$PROMPTS_DIR/decompose.md" \
    TICKET_FILE "$TICKET_FILE" SUBTICKETS_DIR "$SUBROOT" REMEDIATION "$REMEDIATION")"
  run_qwen "$DECOMP_PROMPT" "$TDIR/decompose-round-$round.txt"

  # Fallback: if no sub-tickets exist, treat the ticket itself as one.
  if ! ls -d "$SUBROOT"/*/ >/dev/null 2>&1; then
    log "[decompose] no sub-tickets produced — using the ticket as a single sub-task"
    mkdir -p "$SUBROOT/01-main"
    cp "$TICKET_FILE" "$SUBROOT/01-main/ticket.md"
  fi

  # --- 2. RUN SUB-TICKETS (skip ones already marked passed) ---
  SUBS_OK=1
  for sub in $(ls -d "$SUBROOT"/*/ 2>/dev/null | sort -V); do
    sub="${sub%/}"
    if [ -f "$sub/.passed" ]; then
      log "[sub] $(basename "$sub") already passed — skipping"
      continue
    fi
    bash "$HARNESS_DIR/run_subtask.sh" "$sub"; src=$?
    case "$src" in
      0)
        touch "$sub/.passed"
        log "[sub] $(basename "$sub") PASSED"
        ;;
      2)
        log "[harness] $(basename "$sub") hit a tool failure — aborting ticket for escalation"
        exit 2
        ;;
      *)
        log "[sub] $(basename "$sub") FAILED"
        SUBS_OK=0
        {
          printf '\n## Sub-ticket failed: %s (round %d)\n\n' "$(basename "$sub")" "$round"
          printf 'Did not pass QA after %d iterations — likely mis-scoped or too large. Consider re-scoping it into smaller sub-tickets.\n' "$MAX_ITER"
        } >> "$REVIEW_FB"
        ;;
    esac
  done

  if [ "$SUBS_OK" -ne 1 ]; then
    log "[round $round] some sub-tickets failed — re-decomposing next round"
    continue
  fi

  # --- 3. CLAUDE REVIEW of the whole top-level ticket ---
  log "[review] all sub-tickets passed — running claude review"
  RDIR="$TDIR/review-round-$round"
  mkdir -p "$RDIR"
  start_game "$RDIR"
  if wait_for_game 45; then
    node "$HARNESS_DIR/screenshot.mjs" "$GAME_URL" "$RDIR" </dev/null > "$RDIR/screenshot.log" 2>&1
  else
    echo '{"ok":false,"error":"servers did not start"}' > "$RDIR/metrics.json"
  fi
  stop_game

  git diff "$BASE_REF"..HEAD > "$RDIR/ticket.diff"
  REVIEW_OUT="$RDIR/review.md"
  REVIEW_PROMPT="$(render_prompt "$PROMPTS_DIR/review.md" \
    TICKET_FILE "$TICKET_FILE" ARTIFACTS_DIR "$RDIR" \
    DIFF_FILE "$RDIR/ticket.diff" REVIEW_OUT "$REVIEW_OUT")"
  log "[claude] reviewing..."
  if ! run_claude "$REVIEW_PROMPT" "$RDIR/claude.txt"; then
    log "[tool-failure] claude reviewer unavailable — escalating"
    exit 2
  fi

  if is_pass "$REVIEW_OUT"; then
    TAG="$(next_version_tag)"
    log "[review] PASS — finalizing as $TAG"
    sed -i "s/^- \[ \] \[$NAME\]/- [x] [$NAME]/" TASKS.md
    {
      printf '\n## %s — %s  (%s)\n\n' "$TAG" "$(head -1 "$TICKET_FILE" | sed 's/^# *//')" "$(date '+%F %T')"
      grep -v '^VERDICT:' "$REVIEW_OUT" | tail -20
    } >> LOGBOOK.md
    if ! commit_verified "$NAME: top-level ticket complete ($TAG)"; then
      log "=== ABORT: could not commit completed ticket — escalating ==="
      exit 2
    fi
    git tag "$TAG"
    log "########## $NAME COMPLETE — tagged $TAG ##########"
    exit 0
  fi

  log "[review] FAIL — recording feedback for remediation"
  {
    printf '\n## Top-level review feedback — round %d (%s)\n\n' "$round" "$(date '+%F %T')"
    cat "$REVIEW_OUT" 2>/dev/null || echo "(claude produced no review file)"
    printf '\n'
  } >> "$REVIEW_FB"
done

log "########## $NAME NOT COMPLETED after $TICKET_MAX_ROUNDS rounds ##########"
exit 1
