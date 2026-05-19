#!/usr/bin/env bash
# One top-level ticket end to end:
#   qwen decomposes it into sub-tickets
#   -> each sub-ticket runs the qwen+gemini loop (run_subtask.sh)
#   -> claude reviews the whole ticket against its acceptance criteria
# On a failed review, qwen adds remediation sub-tickets and the cycle repeats,
# up to TICKET_MAX_ROUNDS times. The review feedback handed back to qwen is a
# compact, current "open gaps" list (rewritten each round, never piled up) that
# also carries a pointer to the full review it was distilled from.
#
# Every review, once written, is archived and made read-only — and an integrity
# check restores any review file an agent modified in a later round, so the
# record of past reviews can never be rewritten under the loop.
#
# A passing review may also list non-blocking NITS; the harness files those as
# a new low-priority backlog ticket so they get cleaned up without blocking.
#
# If the rounds are exhausted, claude makes a last-resort RESCUE pass and
# implements the remaining fixes itself. If the ticket STILL cannot be
# completed, claude SPLITS it: the working tree is reset to the ticket's
# starting commit and the ticket is carved into smaller, independently-solvable
# top-level tickets that take its place in the backlog (so a ticket too big to
# land in one piece is broken down until the pieces are individually solvable).
#
#   harness/run_ticket.sh <ticket-name>
#
# Exit: 0 = complete   1 = not completed   2 = tool failure   3 = ticket split

set -uo pipefail
source "$(dirname "$0")/lib.sh"

NAME="${1:?usage: run_ticket.sh <ticket-name>}"
TDIR="tickets/$NAME"
TICKET_FILE="$TDIR/ticket.md"
[ -f "$TICKET_FILE" ] || { log "ERROR: $TICKET_FILE not found"; exit 2; }

SUBROOT="$TDIR/subtickets"
REVIEW_FB="$TDIR/review-feedback.md"   # CURRENT compact open-gaps list for qwen
REVIEWS_DIR="$TDIR/.reviews"           # immutable archive of every review
mkdir -p "$SUBROOT"

# Fresh start: clear any read-only review artifacts left by a previous attempt.
chmod -R u+w "$REVIEWS_DIR" "$TDIR"/review-round-* "$TDIR"/rescue "$TDIR"/rescue-review 2>/dev/null || true
rm -rf "$REVIEWS_DIR" "$TDIR"/review-round-* "$TDIR"/rescue "$TDIR"/rescue-review 2>/dev/null || true

: > "$TDIR/log.txt"
exec > >(tee -a "$TDIR/log.txt") 2>&1
trap 'stop_game' EXIT

BASE_REF="$(git rev-parse HEAD)"
log "########## top-level ticket: $NAME (baseline $BASE_REF) ##########"
emit_progress_event "ticket_start" "{\"ticket\":$(json_string "$NAME"),\"ticketFile\":$(json_string "$TICKET_FILE"),\"baseline\":$(json_string "$BASE_REF")}"

# --- helpers --------------------------------------------------------------

# Capture a fresh run of the game into <dir> (server + client + screenshots).
capture_run() {  # capture_run <dir>
  local dir="$1"
  mkdir -p "$dir"
  start_game "$dir"
  if wait_for_game 45; then
    node "$HARNESS_DIR/screenshot.mjs" "$GAME_URL" "$dir" </dev/null > "$dir/screenshot.log" 2>&1
  else
    echo '{"ok":false,"error":"servers did not start"}' > "$dir/metrics.json"
  fi
  stop_game
}

# Run claude's holistic review of the whole ticket. Sets global REVIEW_OUT,
# writes a compact open-gaps file to <dir>/gaps.md and a nits file to
# <dir>/nits.md. Escalates on tool failure.
review_ticket() {  # review_ticket <dir>
  local dir="$1" prompt
  git diff "$BASE_REF"..HEAD > "$dir/ticket.diff"
  REVIEW_OUT="$dir/review.md"
  prompt="$(render_prompt "$PROMPTS_DIR/review.md" \
    TICKET_FILE "$TICKET_FILE" ARTIFACTS_DIR "$dir" \
    BASE_REF "$BASE_REF" REVIEW_OUT "$REVIEW_OUT" \
    GAPS_OUT "$dir/gaps.md" NITS_OUT "$dir/nits.md")"
  log "[claude] reviewing..."
  if ! run_claude "$prompt" "$dir/claude.txt"; then
    log "[tool-failure] claude reviewer unavailable — escalating"
    exit 2
  fi
}

# Archive a finished review and lock it (and its working dir) read-only so no
# later agent round can rewrite the record of what a past review found.
protect_review() {  # protect_review <label> <working_dir>
  local label="$1" dir="$2" f
  local arc="$REVIEWS_DIR/$label"
  mkdir -p "$arc"
  for f in review.md gaps.md nits.md; do
    [ -f "$dir/$f" ] && cp "$dir/$f" "$arc/$f"
  done
  chmod -R a-w "$arc" "$dir" 2>/dev/null || true
}

# Integrity check: confirm no archived review file was edited since it was
# written. Any tampering (e.g. by a later qwen round) is logged and the file is
# restored from the protected archive. Call after each qwen round.
verify_reviews() {
  [ -d "$REVIEWS_DIR" ] || return 0
  local arc label f
  for arc in "$REVIEWS_DIR"/*/; do
    [ -d "$arc" ] || continue
    label="$(basename "$arc")"
    for f in review.md gaps.md nits.md; do
      [ -f "$arc/$f" ] || continue
      if [ -f "$TDIR/$label/$f" ] && ! cmp -s "$arc/$f" "$TDIR/$label/$f"; then
        log "[integrity] $label/$f was modified after it was written — restoring from the protected archive"
        chmod u+w "$TDIR/$label/$f" 2>/dev/null || true
        cp "$arc/$f" "$TDIR/$label/$f"
        chmod a-w "$TDIR/$label/$f" 2>/dev/null || true
      fi
    done
  done
}

# Append a pointer to the full review so the coder can drill in past the
# compact summary if it needs the per-criterion findings and rationale.
append_review_pointer() {  # append_review_pointer <review_file>
  chmod u+w "$REVIEW_FB" 2>/dev/null || true
  printf '\n---\nThis is a compact summary distilled from the full review of the\nprevious round. For per-criterion findings and the reasoning behind each\ngap, read the full review at: %s\n(That file is read-only — do not edit it.)\n' "$1" >> "$REVIEW_FB"
}

# Overwrite the compact open-gaps file (it is rewritten every round). It MUST
# stay writable across rounds: seeding it with `cp` from a protect_review'd,
# read-only review file would otherwise create it read-only (mode 444) and make
# every later round's write fail — so always clear the mode before writing.
put_review_fb() {  # put_review_fb   (new content on stdin)
  chmod u+w "$REVIEW_FB" 2>/dev/null || true
  cat > "$REVIEW_FB"
}

# File the reviewer's non-blocking nits as a new low-priority backlog ticket so
# they get cleaned up later without blocking the ticket that is passing now.
# The generated ticket carries a staleness note pinning the commit it was
# written against — by the time the loop reaches it the code may have moved on.
ingest_nits() {  # ingest_nits <nits_file>
  local nf="$1" num slug sha
  [ -s "$nf" ] || return 0
  num="$(ls -d tickets/*/ 2>/dev/null | sed -nE 's#^tickets/([0-9]{3})-.*#\1#p' | sort -n | tail -1)"
  [ -n "$num" ] || num=000
  num="$(printf '%03d' "$(( 10#$num + 1 ))")"
  slug="$num-cleanup-${NAME#[0-9][0-9][0-9]-}"
  sha="$(git rev-parse --short HEAD)"
  mkdir -p "tickets/$slug"
  {
    printf '# Cleanup nits from %s\n\n' "$NAME"
    printf '> **Staleness note.** This follow-up ticket was written against commit\n'
    printf '> `%s` (%s). The codebase may have moved on since it was filed —\n' "$sha" "$(date '+%F')"
    printf '> before acting, re-check every file path and code reference below\n'
    printf '> against the CURRENT code, and skip any nit that is already resolved.\n\n'
    printf 'Minor, non-blocking nits the reviewer noted while passing `%s`.\n' "$NAME"
    printf 'None blocked acceptance — clean them up when convenient.\n\n'
    cat "$nf"
  } > "tickets/$slug/ticket.md"
  if grep -q '^## Backlog — Housekeeping' TASKS.md; then
    sed -i "/^## Backlog — Housekeeping/a - [ ] [$slug](tickets/$slug/)" TASKS.md
  else
    printf -- '- [ ] [%s](tickets/%s/)\n' "$slug" "$slug" >> TASKS.md
  fi
  log "[nits] filed backlog ticket $slug (written against $sha) from the reviewer's notes"
}

# Tag + record a completed ticket. 0 = done, 1 = review passed but game does
# not actually run (caller must not treat the ticket as complete).
finalize() {  # finalize <artifacts_dir> <review_file>
  local adir="$1" rfile="$2" tag retry_dir
  if ! game_smoke_ok "$adir"; then
    retry_dir="$TDIR/finalize-confirm-smoke-$(date +%s)"
    if confirm_game_broken "$adir" "$retry_dir"; then
      log "[finalize] review reported PASS but confirmed game health failed — NOT completing"
      return 1
    fi
    log "[finalize] review PASS accepted after confirmation smoke cleared a transient health failure"
  fi
  tag="$(next_version_tag)"
  log "[review] PASS — finalizing as $tag"
  sed -i "s/^- \[ \] \[$NAME\]/- [x] [$NAME]/" TASKS.md
  {
    printf '\n## %s — %s  (%s)\n\n' "$tag" "$(head -1 "$TICKET_FILE" | sed 's/^# *//')" "$(date '+%F %T')"
    grep -v '^VERDICT:' "$rfile" | tail -20
  } >> LOGBOOK.md
  ingest_nits "$adir/nits.md"
  if ! commit_verified "$NAME: top-level ticket complete ($tag)"; then
    log "=== ABORT: could not commit completed ticket — escalating ==="
    exit 2
  fi
  git tag "$tag"
  log "########## $NAME COMPLETE — tagged $tag ##########"
  return 0
}

# The ticket could not be solved as one unit (all remediation rounds + a claude
# rescue failed). Have claude carve it into smaller, independently-solvable
# top-level tickets that replace it in the backlog. The working tree is reset
# to BASE_REF first, so each child is implemented fresh from the ticket's clean
# starting point. Returns 0 if a split (>=2 tickets) was filed, else 1.
split_ticket() {
  local sout="$TDIR/split.md" prompt tmpd chunk title slug num nm
  local names=() childblock=""
  prompt="$(render_prompt "$PROMPTS_DIR/split.md" \
    TICKET_FILE "$TICKET_FILE" REVIEW_FB "$REVIEW_FB" \
    BASE_REF "$BASE_REF" ROUNDS "$TICKET_MAX_ROUNDS" SPLIT_OUT "$sout")"
  : > "$sout"
  log "[split] claude restructuring $NAME into smaller tickets..."
  if ! run_claude "$prompt" "$TDIR/split-claude.txt"; then
    log "[tool-failure] claude split pass unavailable — escalating"
    exit 2
  fi
  if [ ! -s "$sout" ]; then
    log "[split] claude produced no split plan"
    return 1
  fi
  # Discard the failed attempt's game/ changes — forward-only and game/-scoped:
  # HEAD never moves backward, so harness/, TASKS.md and history stay intact.
  # (git rm + checkout makes game/ exactly match BASE_REF: removes files the
  # attempt added, restores ones it changed or deleted.)
  git rm -r --quiet --ignore-unmatch game/ >/dev/null 2>&1 || true
  git checkout "$BASE_REF" -- game/ 2>/dev/null || true
  git clean -fdq game/ 2>/dev/null || true
  chmod -R u+w "$REVIEWS_DIR" "$TDIR"/review-round-* "$TDIR"/rescue "$TDIR"/rescue-review 2>/dev/null || true
  rm -rf "$SUBROOT" "$REVIEW_FB" "$REVIEWS_DIR" "$TDIR"/review-round-* "$TDIR"/rescue "$TDIR"/rescue-review 2>/dev/null || true
  # Carve the split file (tickets separated by ===NEXT TICKET===) into chunks.
  tmpd="$(mktemp -d)"
  awk -v d="$tmpd" 'BEGIN{n=1} /^===NEXT TICKET===[[:space:]]*$/{n++; next} {print > (d "/" sprintf("%03d", n))}' "$sout"
  for chunk in "$tmpd"/*; do
    [ -s "$chunk" ] || continue
    title="$(grep -m1 '^#\+ ' "$chunk" | sed 's/^#\+[[:space:]]*//')"
    [ -n "$title" ] || continue
    slug="$(printf '%s' "$title" | tr 'A-Z' 'a-z' | tr -cs 'a-z0-9' '-' | sed 's/^-*//; s/-*$//' | cut -c1-40 | sed 's/-*$//')"
    [ -n "$slug" ] || continue
    num="$(ls -d tickets/*/ 2>/dev/null | sed -nE 's#^tickets/([0-9]{3})-.*#\1#p' | sort -n | tail -1)"
    [ -n "$num" ] || num=000
    num="$(printf '%03d' "$(( 10#$num + 1 ))")"
    mkdir -p "tickets/$num-$slug"
    cp "$chunk" "tickets/$num-$slug/ticket.md"
    names+=("$num-$slug")
    childblock+="- [ ] [$num-$slug](tickets/$num-$slug/)"$'\n'
  done
  rm -rf "$tmpd"
  if [ "${#names[@]}" -lt 2 ]; then
    log "[split] claude did not produce 2+ usable tickets — no split filed"
    for nm in ${names[@]+"${names[@]}"}; do rm -rf "tickets/$nm"; done
    return 1
  fi
  # Replace the parent's backlog line in TASKS.md with the child tickets.
  awk -v parent="$NAME" -v children="$childblock" '
    index($0, "- [ ] [" parent "]") == 1 { printf "%s", children; next }
    { print }
  ' TASKS.md > "$TDIR/.tasks.tmp" && mv "$TDIR/.tasks.tmp" TASKS.md
  git add TASKS.md
  for nm in "${names[@]}"; do git add "tickets/$nm"; done
  git commit -q -m "harness: split $NAME into ${#names[@]} smaller tickets

$NAME could not be completed in $TICKET_MAX_ROUNDS remediation rounds
plus a claude rescue. Restructured into independently-solvable tickets,
which replace it in the backlog:
$(printf -- '  - %s\n' "${names[@]}")
autogame" || log "[split] warning: commit of the split failed"
  log "[split] $NAME -> ${names[*]}"
  emit_progress_event "ticket_split" "{\"ticket\":$(json_string "$NAME"),\"into\":$(json_string "${names[*]}")}"
  return 0
}

# --- remediation rounds ---------------------------------------------------

for (( round=1; round<=TICKET_MAX_ROUNDS; round++ )); do
  log "========== $NAME : round $round/$TICKET_MAX_ROUNDS =========="
  emit_progress_event "ticket_round_start" "{\"ticket\":$(json_string "$NAME"),\"round\":$round,\"maxRounds\":$TICKET_MAX_ROUNDS}"

  # --- 1. DECOMPOSE (qwen) ---
  if [ "$round" -eq 1 ]; then
    REMEDIATION="This is the first decomposition of this ticket."
  else
    REMEDIATION="REMEDIATION ROUND $round. Sub-ticket folders with a .passed marker are already done — never modify them. The file $REVIEW_FB holds the CURRENT open gaps; it is rewritten every round, so it fully supersedes anything from earlier rounds. It ends with a pointer to the full review — open that read-only file if the compact summary is not detailed enough, but never edit it or any earlier review. Read the gaps and add ONLY new sub-tickets that close those specific gaps."
  fi
  log "[qwen] decomposing into sub-tickets..."
  emit_progress_event "decompose_start" "{\"ticket\":$(json_string "$NAME"),\"round\":$round}"
  DECOMP_PROMPT="$(render_prompt "$PROMPTS_DIR/decompose.md" \
    TICKET_FILE "$TICKET_FILE" SUBTICKETS_DIR "$SUBROOT" REMEDIATION "$REMEDIATION")"
  run_qwen "$DECOMP_PROMPT" "$TDIR/decompose-round-$round.txt"; decomp_rc=$?
  verify_reviews

  # No sub-tickets produced — decide WHY before falling back.
  #  - decomp_rc == 0: qwen ran fine and simply chose not to split. A legitimate
  #    "this ticket is small enough to do directly" — fall back to the whole
  #    ticket as a single sub-task.
  #  - decomp_rc != 0: the decompose call itself FAILED (timeout/crash/empty
  #    output). That is a tool failure, NOT that decision. Running the monolith
  #    then just burns all MAX_ITER sub-task iterations on a too-big task — so
  #    re-attempt the decomposition on the next round instead.
  if ! ls -d "$SUBROOT"/*/ >/dev/null 2>&1; then
    if [ "$decomp_rc" -ne 0 ]; then
      log "[decompose] decomposition call FAILED (rc=$decomp_rc) — not a 'ticket is atomic' decision; re-decomposing next round"
      continue
    fi
    log "[decompose] no sub-tickets produced — using the ticket as a single sub-task"
    mkdir -p "$SUBROOT/01-main"
    cp "$TICKET_FILE" "$SUBROOT/01-main/ticket.md"
  fi

  # --- 2. RUN SUB-TICKETS (skip ones already marked passed) ---
  SUBS_OK=1
  FAILED_SUBS=()
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
        emit_progress_event "subtask_marked_passed" "{\"ticket\":$(json_string "$NAME"),\"subtask\":$(json_string "$(basename "$sub")")}"
        ;;
      2)
        log "[harness] $(basename "$sub") hit a tool failure — aborting ticket for escalation"
        exit 2
        ;;
      *)
        log "[sub] $(basename "$sub") FAILED"
        emit_progress_event "subtask_marked_failed" "{\"ticket\":$(json_string "$NAME"),\"subtask\":$(json_string "$(basename "$sub")")}"
        SUBS_OK=0
        FAILED_SUBS+=("$(basename "$sub")")
        ;;
    esac
  done
  verify_reviews

  if [ "$SUBS_OK" -ne 1 ]; then
    # Compact, current feedback — overwrites, never piles up across rounds.
    {
      printf '# Open gaps — after round %d (%s)\n\n' "$round" "$(date '+%F %T')"
      printf 'These sub-tickets did not pass QA after %d iterations. They are likely mis-scoped or too large — re-scope each into smaller, correctly-classified sub-tickets:\n\n' "$MAX_ITER"
      printf -- '- %s\n' "${FAILED_SUBS[@]}"
    } | put_review_fb
    log "[round $round] some sub-tickets failed — re-decomposing next round"
    continue
  fi

  # --- 3. CLAUDE REVIEW of the whole top-level ticket ---
  log "[review] all sub-tickets passed — running claude review"
  emit_progress_event "review_start" "{\"ticket\":$(json_string "$NAME"),\"round\":$round}"
  RDIR="$TDIR/review-round-$round"
  capture_run "$RDIR"
  review_ticket "$RDIR"
  protect_review "review-round-$round" "$RDIR"   # archive + lock read-only

  if is_pass "$REVIEW_OUT"; then
    emit_progress_event "review_verdict" "{\"ticket\":$(json_string "$NAME"),\"round\":$round,\"verdict\":\"PASS\",\"review\":$(json_string "$REVIEW_OUT")}"
    if finalize "$RDIR" "$REVIEW_OUT"; then
      emit_progress_event "ticket_complete" "{\"ticket\":$(json_string "$NAME"),\"round\":$round}"
      exit 0
    fi
    # review said PASS but the game is not runnable — force another round.
    smoke_reason="$(game_smoke_reason "$RDIR")"
    {
      printf '# Open gaps — after round %d (%s)\n\n' "$round" "$(date '+%F %T')"
      printf 'The review reported PASS, but two smoke captures show the game does not start or load cleanly.\n'
      printf 'Initial smoke reason: %s\n' "${smoke_reason:-unknown}"
      printf 'Inspect server.log, console.log, metrics.json, and the confirmation smoke under %s/finalize-confirm-smoke-*.\n' "$TDIR"
    } | put_review_fb
    append_review_pointer "$REVIEW_OUT"
    log "[round $round] review PASS but game not runnable — re-decomposing next round"
    continue
  fi

  # FAIL — hand qwen the compact open-gaps list claude wrote (overwrite).
  log "[review] FAIL — recording compacted feedback for remediation"
  emit_progress_event "review_verdict" "{\"ticket\":$(json_string "$NAME"),\"round\":$round,\"verdict\":\"FAIL\",\"review\":$(json_string "$REVIEW_OUT")}"
  if [ -s "$RDIR/gaps.md" ]; then
    put_review_fb < "$RDIR/gaps.md"
  else
    # Fallback: claude did not produce the compact file — trim the full review.
    {
      printf '# Open gaps — after round %d (%s)\n\n' "$round" "$(date '+%F %T')"
      grep -v '^VERDICT:' "$REVIEW_OUT" 2>/dev/null | tail -40
    } | put_review_fb
  fi
  append_review_pointer "$REVIEW_OUT"
done

# --- 4. CLAUDE RESCUE — last resort: claude implements the fixes itself ----
log "########## $NAME — $TICKET_MAX_ROUNDS rounds exhausted; starting claude rescue ##########"
emit_progress_event "rescue_start" "{\"ticket\":$(json_string "$NAME"),\"maxRounds\":$TICKET_MAX_ROUNDS}"
RES="$TDIR/rescue"
mkdir -p "$RES"
git diff "$BASE_REF"..HEAD > "$RES/ticket.diff"
RESCUE_PROMPT="$(render_prompt "$PROMPTS_DIR/rescue.md" \
  TICKET_FILE "$TICKET_FILE" REVIEW_FB "$REVIEW_FB" \
  BASE_REF "$BASE_REF" ROUNDS "$TICKET_MAX_ROUNDS")"
log "[rescue] claude implementing the remaining fixes directly..."
if ! run_claude "$RESCUE_PROMPT" "$RES/rescue.txt"; then
  log "[tool-failure] claude rescue unavailable — escalating"
  exit 2
fi
commit_verified "$NAME: claude rescue implementation pass" || true
verify_reviews

# Re-review the rescued ticket.
RDIR="$TDIR/rescue-review"
capture_run "$RDIR"
review_ticket "$RDIR"
protect_review "rescue-review" "$RDIR"
if is_pass "$REVIEW_OUT" && finalize "$RDIR" "$REVIEW_OUT"; then
  exit 0
fi

# --- 5. SPLIT — the ticket could not be solved as one unit; claude carves it
#        into smaller, independently-solvable tickets that replace it. ---
log "[split] $NAME unsolved after $TICKET_MAX_ROUNDS rounds + claude rescue — restructuring"
emit_progress_event "split_start" "{\"ticket\":$(json_string "$NAME")}"
if split_ticket; then
  log "########## $NAME SPLIT — smaller tickets queued; backlog will pick them up ##########"
  exit 3
fi
log "########## $NAME could not be split — left open for a fresh attempt ##########"
exit 1
