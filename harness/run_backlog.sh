#!/usr/bin/env bash
# Walk every unchecked top-level ticket in TASKS.md, running each to completion.
#
# The backlog NEVER advances past a ticket until that ticket is actually
# complete: later tickets can depend on its behaviour, so building on top of an
# unsolved one is unsafe. An incomplete ticket is retried — a fresh
# run_ticket.sh invocation, each of which is itself 10 remediation rounds + a
# claude rescue — until it passes. Only a harness/tool failure stops the run.
#
#   harness/run_backlog.sh
#
# Exit: 0 = all tickets complete   2 = harness/tool failure (escalate)

set -uo pipefail
source "$(dirname "$0")/lib.sh"

mapfile -t TICKETS < <(grep -oE '^- \[ \] \[[^]]+\]' TASKS.md | sed -E 's/^- \[ \] \[//; s/\]$//')

log "=== backlog run: ${#TICKETS[@]} ticket(s) queued ==="
[ "${#TICKETS[@]}" -eq 0 ] && { log "no unchecked tickets in TASKS.md — nothing to do"; exit 0; }

PASSED=()
for name in "${TICKETS[@]}"; do
  # Retry until solved — a failed ticket is never skipped.
  attempt=1
  while :; do
    log ">>> ticket: $name (attempt $attempt)"
    bash "$HARNESS_DIR/run_ticket.sh" "$name"; rc=$?
    case "$rc" in
      0)
        PASSED+=("$name")
        log ">>> COMPLETE: $name (attempt $attempt)"
        break
        ;;
      2)
        log ">>> HARNESS/TOOL FAILURE on: $name — stopping backlog for escalation"
        log "=== summary: completed ${#PASSED[@]} (${PASSED[*]:-none}); aborted on tool failure ==="
        exit 2
        ;;
      *)
        log ">>> INCOMPLETE: $name — attempt $attempt did not solve it; retrying. The backlog will not advance past an unsolved ticket."
        attempt=$((attempt + 1))
        sleep 30
        ;;
    esac
  done
done

log "=== backlog finished — all ${#PASSED[@]} ticket(s) complete: ${PASSED[*]:-none} ==="
