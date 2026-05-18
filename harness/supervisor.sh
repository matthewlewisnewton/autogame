#!/usr/bin/env bash
# Outermost watchdog for the autogame loop.
#
#   harness/supervisor.sh
#
# Runs the backlog. On a harness/tool failure (exit 2) it asks claude to
# diagnose and repair the harness, then RESTARTS the loop — a fresh process
# that re-sources the now-fixed scripts. This script is deliberately simple and
# has NO LLM in its own control flow, which is what guarantees the restart.
#
# Bounded by MAX_ESCALATIONS; after that it stops and flags for a human.

set -uo pipefail
source "$(dirname "$0")/lib.sh"

MAX_ESCALATIONS="${MAX_ESCALATIONS:-3}"
SUPLOG="$REPO_ROOT/LOOPLOG.txt"
escalations=0

slog() { log "$*" | tee -a "$SUPLOG"; }

slog "######## supervisor started ($(date '+%F %T')) ########"

while :; do
  tags_before="$(git tag -l 'v0.*' | wc -l | tr -d ' ')"
  slog ">>> launching backlog run"
  bash "$HARNESS_DIR/run_backlog.sh"; rc=$?
  tags_after="$(git tag -l 'v0.*' | wc -l | tr -d ' ')"
  slog ">>> backlog run exited rc=$rc (completed tickets: $tags_before -> $tags_after)"

  if [ "$rc" -eq 0 ]; then
    slog "######## supervisor: backlog complete — all tickets done ########"
    exit 0
  fi
  if [ "$rc" -eq 1 ]; then
    slog "######## supervisor: some tickets genuinely incomplete — stopping for human review ########"
    exit 1
  fi

  # rc == 2 (or unexpected) -> harness breakage: escalate to a repair agent.
  escalations=$((escalations + 1))
  if [ "$escalations" -gt "$MAX_ESCALATIONS" ]; then
    slog "######## supervisor: $MAX_ESCALATIONS escalations exhausted — STOPPING, needs a human ########"
    exit 2
  fi
  slog ">>> ESCALATION $escalations/$MAX_ESCALATIONS: asking claude to diagnose & repair the harness"
  DIAG_PROMPT="$(render_prompt "$PROMPTS_DIR/diagnose.md" LOOPLOG "$SUPLOG")"
  run_claude "$DIAG_PROMPT" "$HARNESS_DIR/diagnosis-$escalations.txt"
  slog ">>> diagnosis complete (see harness/diagnosis-$escalations.txt) — restarting loop"
  sleep 5
done
