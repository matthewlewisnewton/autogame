#!/usr/bin/env bash
# Walk every unchecked top-level ticket in TASKS.md, running each to completion.
#
#   harness/run_backlog.sh
#
# Exit: 0 = all complete   1 = some genuinely incomplete   2 = harness/tool failure

set -uo pipefail
source "$(dirname "$0")/lib.sh"

mapfile -t TICKETS < <(grep -oE '^- \[ \] \[[^]]+\]' TASKS.md | sed -E 's/^- \[ \] \[//; s/\]$//')

log "=== backlog run: ${#TICKETS[@]} ticket(s) queued ==="
[ "${#TICKETS[@]}" -eq 0 ] && { log "no unchecked tickets in TASKS.md — nothing to do"; exit 0; }

PASSED=(); FAILED=()
for name in "${TICKETS[@]}"; do
  log ">>> ticket: $name"
  bash "$HARNESS_DIR/run_ticket.sh" "$name"; rc=$?
  case "$rc" in
    0)
      PASSED+=("$name")
      log ">>> COMPLETE: $name"
      ;;
    2)
      log ">>> HARNESS/TOOL FAILURE on: $name — stopping backlog for escalation"
      log "=== summary: completed ${#PASSED[@]} (${PASSED[*]:-none}); aborted on tool failure ==="
      exit 2
      ;;
    *)
      FAILED+=("$name")
      log ">>> INCOMPLETE: $name"
      ;;
  esac
done

log "=== backlog finished — completed: ${#PASSED[@]} (${PASSED[*]:-none}); incomplete: ${#FAILED[@]} (${FAILED[*]:-none}) ==="
[ "${#FAILED[@]}" -eq 0 ]
