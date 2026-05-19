#!/usr/bin/env bash
# Drive the TASKS.md backlog to completion.
#
# Each pass RE-READS TASKS.md and runs the first still-unchecked ticket. The
# backlog never advances past a ticket until it is solved:
#   - an INCOMPLETE ticket is retried (it stays unchecked, so it is re-picked);
#   - a ticket that cannot be solved as one unit is SPLIT by run_ticket.sh into
#     smaller tickets that take its place in TASKS.md — re-reading the file
#     every pass is what flows those (and any other mid-run additions, e.g.
#     nit-cleanup tickets) back into the queue.
# Only a harness/tool failure stops the run.
#
#   harness/run_backlog.sh
#
# Exit: 0 = all tickets complete   2 = harness/tool failure (escalate)

set -uo pipefail
source "$(dirname "$0")/lib.sh"

next_ticket() {  # prints the first unchecked ticket name in TASKS.md, or nothing
  grep -oE '^- \[ \] \[[^]]+\]' TASKS.md | sed -E 's/^- \[ \] \[//; s/\]$//' | head -1
}

COMPLETED=0
while :; do
  name="$(next_ticket)"
  [ -n "$name" ] || break
  log ">>> ticket: $name"
  bash "$HARNESS_DIR/run_ticket.sh" "$name"; rc=$?
  case "$rc" in
    0)
      COMPLETED=$((COMPLETED + 1))
      log ">>> COMPLETE: $name"
      ;;
    2)
      log ">>> HARNESS/TOOL FAILURE on: $name — stopping backlog for escalation"
      log "=== summary: $COMPLETED ticket(s) completed before the tool failure ==="
      exit 2
      ;;
    3)
      log ">>> SPLIT: $name restructured into smaller tickets — re-scanning backlog"
      ;;
    *)
      log ">>> INCOMPLETE: $name — retrying; the backlog will not advance past an unsolved ticket"
      sleep 30
      ;;
  esac
done

log "=== backlog finished — $COMPLETED ticket(s) completed; no unchecked tickets remain ==="
