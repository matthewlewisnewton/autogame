#!/usr/bin/env bash
# Inner loop for ONE sub-ticket: qwen implements -> screenshot -> visual QA.
# QA chain (qwen-first policy): qwen self-review (primary, local + free) ->
# cursor-agent/composer (paid, independent reviewer; kicks in if qwen
# produces no verdict) -> agy/Gemini-3.5-Flash (cloud, zero-cost; third
# independent reviewer; gemini-CLI replacement) -> claude (last resort).
# Qwen vision can be enabled as optional failed-QA feedback.
#
#   harness/run_subtask.sh <sub-ticket-dir>
#
# Exit: 0 = passed (committed)   1 = failed after MAX_ITER   2 = tool failure

set -uo pipefail
source "$(dirname "$0")/lib.sh"

SUBDIR="${1:?usage: run_subtask.sh <sub-ticket-dir>}"
SUBDIR="${SUBDIR%/}"
# Absolute-ify the sub-ticket dir so every downstream path (TICKET_FILE,
# FEEDBACK, HANDOFF, ARTI/...) becomes absolute too. Critical for agy: its
# print-mode workspaceDirs is always empty regardless of cwd, and relative
# @file references in prompts sometimes get a "no active workspace"
# non-answer instead of a verdict. Composer and claude resolve relative
# paths fine, but absolute is a harmless upgrade for them too.
SUBDIR_ABS="$(realpath "$SUBDIR" 2>/dev/null || true)"
[ -n "$SUBDIR_ABS" ] && [ -d "$SUBDIR_ABS" ] && SUBDIR="$SUBDIR_ABS"
TICKET_FILE="$SUBDIR/ticket.md"
[ -f "$TICKET_FILE" ] || { log "ERROR: $TICKET_FILE not found"; exit 1; }

FEEDBACK="$SUBDIR/feedback.md"
HANDOFF="$SUBDIR/handoff.md"
# QA routing: a sub-ticket declares `## Verification: visual|code`. Visual
# changes are checked from screenshots; code/non-visual ones from the diff+logs.
QA_MODE="$(grep -ioE 'verification[: ]+[a-z]+' "$TICKET_FILE" 2>/dev/null | grep -ioE 'visual|code' | head -1 | tr 'A-Z' 'a-z')"
[ -z "$QA_MODE" ] && QA_MODE="visual"
TICKET_ALLOWS_HARNESS=0
if grep -qE '(^|[^[:alnum:]_./-])harness/' "$TICKET_FILE" 2>/dev/null; then
  TICKET_ALLOWS_HARNESS=1
fi
LABEL="$(basename "$(dirname "$(dirname "$SUBDIR")")")/$(basename "$SUBDIR")"
: > "$SUBDIR/log.txt"
exec > >(tee -a "$SUBDIR/log.txt") 2>&1
trap 'stop_game' EXIT

start_pipeline_checks() { # start_pipeline_checks <artifacts-dir>; sets global PIPELINE_PID (0 = disabled)
  local artifacts_dir="$1"
  local out="$artifacts_dir/local-checks.log"
  PIPELINE_PID=0
  if [ "$PIPELINE_LOCAL_CHECKS" != "1" ]; then
    return 1
  fi

  log "[pipeline] starting local verification in background..." >&2
  emit_progress_event "pipeline_check_start" "{\"label\":$(json_string "$LABEL"),\"artifacts\":$(json_string "$artifacts_dir"),\"command\":$(json_string "$PIPELINE_CHECK_COMMAND"),\"cwd\":$(json_string "$PIPELINE_CHECK_CWD"),\"timeoutSeconds\":$PIPELINE_CHECK_TIMEOUT}"
  # NOTE: do NOT wrap this in a $(...) at the call site. Command substitution
  # runs the function in a SUBSHELL, so `&` would background a child of *that*
  # subshell — and the parent's later `wait $pid` would fail with "not a child
  # of this shell" (bash can only wait on direct children). We assign PIPELINE_PID
  # in the caller's shell scope here so the background process IS its direct child.
  #
  # Split into server + client projects with independent timeouts so the
  # slow integration tests don't steal budget from fast client unit tests.
  (
    trap 'cleanup_vitest_workers "$PIPELINE_CHECK_CWD"' EXIT
    cd "$PIPELINE_CHECK_CWD" || exit 127
    printf '[pipeline] cwd=%s\n' "$(pwd)"

    printf '[pipeline] running server tests (timeout=%ds)...\n' "$PIPELINE_SERVER_TIMEOUT"
    python3 "$HARNESS_DIR/scripts/run_vitest.py" --timeout "$PIPELINE_SERVER_TIMEOUT" -- \
      run --project server
    server_rc=$?
    if [ $server_rc -ne 0 ]; then
      printf '[pipeline] server tests failed (rc=%d)\n' "$server_rc"
      exit $server_rc
    fi

    printf '[pipeline] running client tests (timeout=%ds)...\n' "$PIPELINE_CLIENT_TIMEOUT"
    python3 "$HARNESS_DIR/scripts/run_vitest.py" --timeout "$PIPELINE_CLIENT_TIMEOUT" -- \
      run --project client
    client_rc=$?
    if [ $client_rc -ne 0 ]; then
      printf '[pipeline] client tests failed (rc=%d)\n' "$client_rc"
      exit $client_rc
    fi

    printf '[pipeline] all tests passed\n'
  ) </dev/null > "$out" 2>&1 &
  PIPELINE_PID=$!
  return 0
}

finish_pipeline_checks() { # finish_pipeline_checks <pid> <artifacts-dir>; returns the local-check rc
  local pid="${1:-}" artifacts_dir="$2" rc reason
  PIPELINE_RC=0
  PIPELINE_REASON="not_started"
  if [ -z "$pid" ] || [ "$pid" = "0" ]; then
    return 0
  fi

  log "[pipeline] waiting for local verification..."
  if wait "$pid"; then
    rc=0
    reason="ok"
    log "[pipeline] local verification passed"
  else
    rc=$?
    reason="$(cli_failure_reason "$rc" "$artifacts_dir/local-checks.log")"
    log "[pipeline] local verification finished non-zero (rc=$rc, reason=$reason)"
  fi
  PIPELINE_RC="$rc"
  PIPELINE_REASON="$reason"
  cleanup_vitest_workers "$PIPELINE_CHECK_CWD"
  printf '{"rc":%s,"reason":%s}\n' "$rc" "$(json_string "$reason")" > "$artifacts_dir/local-checks.status.json"
  emit_progress_event "pipeline_check_finish" "{\"label\":$(json_string "$LABEL"),\"artifacts\":$(json_string "$artifacts_dir"),\"outfile\":$(json_string "$artifacts_dir/local-checks.log"),\"rc\":$rc,\"reason\":$(json_string "$reason")}"
  return "$rc"
}

append_local_check_feedback() { # append_local_check_feedback <iter> <artifacts-dir> <rc> <reason>
  local iter="$1" artifacts_dir="$2" rc="$3" reason="$4"
  {
    printf '\n## Local checks failed — iteration %d (%s)\n\n' "$iter" "$(date '+%F %T')"
    printf 'The harness skipped model QA because deterministic local verification failed.\n'
    printf 'Local checks are a hard gate: fix this before the next QA attempt can pass.\n\n'
    printf -- '- Status: `%s/local-checks.status.json` (`rc=%s`, `reason=%s`)\n' "$artifacts_dir" "$rc" "$reason"
    printf -- '- Log: `%s/local-checks.log`\n\n' "$artifacts_dir"
    printf 'Tail of `local-checks.log`:\n\n```\n'
    if [ -s "$artifacts_dir/local-checks.log" ]; then
      tail -n 80 "$artifacts_dir/local-checks.log" 2>/dev/null
    else
      printf '[local-checks.log missing or empty]\n'
    fi
    printf '\n```\n'
  } >> "$FEEDBACK"
}

log "=== sub-ticket: $LABEL — QA mode: $QA_MODE ==="
emit_progress_event "subtask_start" "{\"label\":$(json_string "$LABEL"),\"ticketFile\":$(json_string "$TICKET_FILE"),\"qaMode\":$(json_string "$QA_MODE")}"
coder_toolfail=0

for (( iter=1; iter<=MAX_ITER; iter++ )); do
  log "--- $LABEL : iteration $iter/$MAX_ITER ---"
  ARTI="$SUBDIR/artifacts/iter-$iter"
  game_running=0
  game_live=0
  pipeline_pid=0
  mkdir -p "$ARTI"
  emit_progress_event "iteration_start" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"maxIterations\":$MAX_ITER,\"artifacts\":$(json_string "$ARTI")}"

  # 1. CODER — qwen by default, or cursor-agent/$IMPL_MODEL when set (see lib.sh).
  #    Outfile stays qwen.txt so existing log/progress consumers keep working;
  #    run_impl tags _run_cli with impl/<model> for telemetry that needs the
  #    real model name.
  if [ -n "$IMPL_MODEL" ]; then
    log "[impl] implementing via cursor-agent/$IMPL_MODEL..."
  else
    log "[qwen] implementing..."
  fi
  CODER_PROMPT="$(render_prompt "$PROMPTS_DIR/implement.md" \
    TICKET_FILE "$TICKET_FILE" FEEDBACK_FILE "$FEEDBACK" HANDOFF_FILE "$HANDOFF")"
  handoff_before="$(stat -c %Y "$HANDOFF" 2>/dev/null || echo 0)"
  run_impl "$CODER_PROMPT" "$ARTI/qwen.txt"; coder_rc=$?

  # Guarantee a handoff note exists for the next session. If qwen ran out of
  # context / crashed before writing its own, the harness "moves it over" by
  # synthesizing one from the attempt log — context continuity is the harness's
  # job, not something we rely on qwen's in-session compaction to preserve.
  if [ "$(stat -c %Y "$HANDOFF" 2>/dev/null || echo 0)" = "$handoff_before" ]; then
    log "[handoff] no handoff left by qwen — harness synthesizing one"
    coder_reason="$(cli_failure_reason "$coder_rc" "$ARTI/qwen.txt")"
    {
      printf '## Harness fallback handoff — attempt %d did not finish cleanly\n\n' "$iter"
      printf 'The previous attempt left no handoff note. Harness classification: `%s`.\n' "$coder_reason"
      printf 'Inspect the working tree under `game/` for partial changes and continue\n'
      printf 'this sub-ticket from there.\n\n'
      printf 'Tail of the previous attempt log:\n\n```\n'
      if cli_output_is_only_error "$ARTI/qwen.txt"; then
        printf '[model/tool error only — no useful implementation handoff was produced]\n'
      else
        tail -n 40 "$ARTI/qwen.txt" 2>/dev/null
      fi
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

  PIPELINE_PID=0
  start_pipeline_checks "$ARTI" || :
  pipeline_pid="$PIPELINE_PID"

  # 2. Start game + capture screenshots
  log "[game] starting servers..."
  start_game "$ARTI"
  game_running=1
  if wait_for_game 45; then
    game_live=1
    log "[playwright] capturing screenshots..."
    node "$HARNESS_DIR/screenshot.mjs" "$GAME_URL" "$ARTI" </dev/null > "$ARTI/screenshot.log" 2>&1
    emit_progress_event "capture_complete" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"artifacts\":$(json_string "$ARTI"),\"status\":\"captured\"}"
  else
    log "[game] SERVERS FAILED TO START"
    echo '{"ok":false,"error":"servers did not start"}' > "$ARTI/metrics.json"
    : > "$ARTI/console.log"; : > "$ARTI/server.log"; : > "$ARTI/client.log"
    emit_progress_event "capture_complete" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"artifacts\":$(json_string "$ARTI"),\"status\":\"servers_failed\"}"
  fi
  if [ "$game_live" -ne 1 ] || [ "$QA_MODE" != "visual" ] || [ "$QWEN_VISION_FEEDBACK" != "1" ]; then
    stop_game
    game_running=0
  fi

  # 3. QA — routed by the sub-ticket's verification mode.
  #    cursor-agent/composer -> agy/Gemini-3.5-Flash -> qwen self-review -> claude.
  #    agy replaces the retired gemini CLI as the second independent reviewer
  #    (cloud + zero-cost). qwen self-review keeps the loop moving when both
  #    cloud tiers are out — same model as the writer, so accepted only as a
  #    third-tier fallback.
  if [ "$TICKET_ALLOWS_HARNESS" = "1" ]; then
    git diff HEAD -- . ':!tickets' > "$ARTI/changes.diff" 2>/dev/null || : > "$ARTI/changes.diff"
  else
    git diff HEAD -- game/ > "$ARTI/changes.diff" 2>/dev/null || : > "$ARTI/changes.diff"
  fi
  finish_pipeline_checks "$pipeline_pid" "$ARTI"
  pipeline_rc=$?
  if [ "$pipeline_rc" -ne 0 ]; then
    log "[pipeline] local verification failed — skipping QA and feeding the failure back to qwen"
    emit_progress_event "qa_verdict" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"verdict\":\"FAIL\",\"reason\":\"local_checks_failed\",\"qaFile\":$(json_string "$ARTI/local-checks.status.json")}"
    if [ "$game_running" -eq 1 ]; then
      stop_game
      game_running=0
    fi
    append_local_check_feedback "$iter" "$ARTI" "$PIPELINE_RC" "$PIPELINE_REASON"
    continue
  fi
  if [ "$QA_MODE" = "code" ]; then
    log "[qa] code-review QA (non-visual sub-ticket)..."
    QA_PROMPT="$(render_prompt "$PROMPTS_DIR/qa-code.md" \
      TICKET_FILE "$TICKET_FILE" ARTIFACTS_DIR "$ARTI")"
  else
    log "[qa] visual QA (screenshots)..."
    QA_PROMPT="$(render_prompt "$PROMPTS_DIR/qa.md" \
      TICKET_FILE "$TICKET_FILE" ARTIFACTS_DIR "$ARTI")"
  fi
  # QA agent chain — qwen-first policy:
  #   1. qwen self-review (local, free — primary gate for sub-tickets).
  #      Same model that wrote the code, so it can inherit the writer's blind
  #      spots; accepted as primary because (a) qwen is invoked in a fresh
  #      session here with the qa-* prompt, not the implement prompt, (b) sub-
  #      ticket scope is narrow so a reviewer-mindset pass on a small diff is
  #      a meaningful gate, and (c) the top-level review (run by a paid agent
  #      with broader context) catches integration issues qwen would miss.
  #   2. cursor-agent/composer-2.5-fast (paid, independent reviewer — kicks
  #      in only when qwen produces no verdict, e.g. crash / timeout / blank).
  #   3. agy / Gemini 3.5 Flash (High) (cloud, zero-cost — third independent
  #      reviewer; replaces the retired gemini CLI).
  #   4. claude (last resort, most expensive).
  # Each tier is accepted only if it produced a real verdict line.
  #
  # OVERRIDE: when QA_MODEL is set (see lib.sh), a cursor-agent reviewer is
  # tried FIRST and the qwen-first chain becomes the fallback ladder behind it.
  if [ -n "$QA_MODEL" ] && run_agent_model "$QA_MODEL" "$QA_PROMPT" "$ARTI/qa.txt" && has_verdict "$ARTI/qa.txt"; then
    log "[qa] verified by cursor-agent/$QA_MODEL ($QA_MODE) — QA_MODEL primary"
    emit_progress_event "qa_verified" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"agent\":$(json_string "cursor-agent/$QA_MODEL"),\"mode\":$(json_string "$QA_MODE")}"
  elif run_qwen "$QA_PROMPT" "$ARTI/qa.txt" && has_verdict "$ARTI/qa.txt"; then
    log "[qa] verified by qwen self-review ($QA_MODE)"
    emit_progress_event "qa_verified" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"agent\":\"qwen-self\",\"mode\":$(json_string "$QA_MODE")}"
  elif run_agent "$QA_PROMPT" "$ARTI/qa.txt" && has_verdict "$ARTI/qa.txt"; then
    log "[qa] verified by cursor-agent/$AGENT_MODEL ($QA_MODE) — qwen unavailable"
    emit_progress_event "qa_verified" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"agent\":$(json_string "cursor-agent/$AGENT_MODEL"),\"mode\":$(json_string "$QA_MODE")}"
  elif run_agy "$QA_PROMPT" "$ARTI/qa.txt" && has_verdict "$ARTI/qa.txt"; then
    log "[qa] verified by agy/$AGY_MODEL_LABEL ($QA_MODE) — qwen + cursor-agent unavailable"
    emit_progress_event "qa_verified" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"agent\":$(json_string "agy/$AGY_MODEL_LABEL"),\"mode\":$(json_string "$QA_MODE")}"
  else
    log "[qa] qwen + cursor-agent + agy produced no verdict — last-resort claude"
    if ! run_claude "$QA_PROMPT" "$ARTI/qa.txt"; then
      log "[tool-failure] claude QA unavailable (timeout/empty) after qwen+agent+agy — escalating"
      exit 2
    fi
    if ! has_verdict "$ARTI/qa.txt"; then
      log "[tool-failure] claude QA produced no VERDICT: PASS|FAIL line — escalating"
      exit 2
    fi
    log "[qa] verified by claude ($QA_MODE)"
    emit_progress_event "qa_verified" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"agent\":\"claude\",\"mode\":$(json_string "$QA_MODE")}"
  fi

  # 4. Verdict
  if is_pass "$ARTI/qa.txt"; then
    log "[qa] PASS — dispatching qwen to commit the verified change"
    emit_progress_event "qa_verdict" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"verdict\":\"PASS\",\"qaFile\":$(json_string "$ARTI/qa.txt")}"
    if [ "$game_running" -eq 1 ]; then
      stop_game
      game_running=0
    fi
    head_before="$(git rev-parse HEAD)"
    COMMIT_PROMPT="$(render_prompt "$PROMPTS_DIR/commit.md" \
      TICKET_FILE "$TICKET_FILE" LABEL "$LABEL")"
    run_qwen "$COMMIT_PROMPT" "$ARTI/commit.txt"
    # The harness still GUARANTEES verified progress is committed: if qwen left
    # anything uncommitted, commit the remainder deterministically.
    #
    # Scope the dirtiness check to everything EXCEPT harness/ — same scope
    # commit_verified now uses. The whole repo can legitimately carry
    # uncommitted harness/ edits (e.g. a fix left in place by a repair agent),
    # so a bare `git status --porcelain` would still report dirty after a
    # successful commit and trigger a false "could not commit verified
    # progress" escalation. commit_verified's own return code is the hard gate:
    # it stages the loop's files, commits, and asserts HEAD advanced.
    if [ "$TICKET_ALLOWS_HARNESS" = "1" ]; then
      dirty_scope="$(git status --porcelain -- . ':!tickets')"
    else
      dirty_scope="$(git status --porcelain -- . ':!harness')"
    fi
    if [ -n "$dirty_scope" ]; then
      log "[commit] qwen left changes uncommitted — harness committing remainder"
      if ! COMMIT_INCLUDE_HARNESS="$TICKET_ALLOWS_HARNESS" commit_verified "$LABEL: sub-ticket verified (iter $iter)"; then
        log "=== ABORT $LABEL: could not commit verified progress — escalating ==="
        exit 2
      fi
    fi
    if [ "$(git rev-parse HEAD)" != "$head_before" ]; then
      log "[commit] $(git log -1 --format='%h %s')"
    else
      log "[commit] no new changes — verified state already in HEAD"
    fi
    log "=== sub-ticket PASSED: $LABEL ==="
    emit_progress_event "subtask_passed" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter}"
    exit 0
  fi

  log "[qa] FAIL — accumulating feedback"
  emit_progress_event "qa_verdict" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"verdict\":\"FAIL\",\"qaFile\":$(json_string "$ARTI/qa.txt")}"
  if [ "$QA_MODE" = "visual" ] && [ "$QWEN_VISION_FEEDBACK" = "1" ]; then
    log "[qwen-vision] enriching failed visual QA feedback..."
    QWEN_VISION_PROMPT="$(render_prompt "$PROMPTS_DIR/qwen-vision-feedback.md" \
      TICKET_FILE "$TICKET_FILE" ARTIFACTS_DIR "$ARTI" QA_FILE "$ARTI/qa.txt" GAME_URL "$GAME_URL")"
    if run_qwen_vision "$QWEN_VISION_PROMPT" "$ARTI/qwen-vision.txt" "$ARTI"; then
      log "[qwen-vision] feedback captured"
      emit_progress_event "qwen_visual_feedback" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"status\":\"captured\",\"outfile\":$(json_string "$ARTI/qwen-vision.txt")}"
    else
      log "[qwen-vision] unavailable — continuing with original QA feedback"
      emit_progress_event "qwen_visual_feedback" "{\"label\":$(json_string "$LABEL"),\"iteration\":$iter,\"status\":\"tool_failure\",\"outfile\":$(json_string "$ARTI/qwen-vision.txt")}"
    fi
  fi
  if [ "$game_running" -eq 1 ]; then
    stop_game
    game_running=0
  fi
  {
    printf '\n## QA feedback — iteration %d (%s)\n\n' "$iter" "$(date '+%F %T')"
    filter_agent_feedback_noise "$ARTI/qa.txt"
    printf '\n'
    if [ -s "$ARTI/qwen-vision.txt" ]; then
      printf '\n## Qwen visual feedback — iteration %d\n\n' "$iter"
      filter_agent_feedback_noise "$ARTI/qwen-vision.txt"
      printf '\n'
    fi
  } >> "$FEEDBACK"
done

log "=== sub-ticket FAILED after $MAX_ITER iterations: $LABEL — reverting ==="
emit_progress_event "subtask_failed" "{\"label\":$(json_string "$LABEL"),\"maxIterations\":$MAX_ITER}"
revert_game_changes
exit 1
