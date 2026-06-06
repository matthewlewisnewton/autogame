# Cleanup nits from 287-persist-player-health-and-stones-no-telepipe-reset

> **Staleness note.** This follow-up ticket was written against commit
> `1cc2ca8e` (2026-06-06). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `287-persist-player-health-and-stones-no-telepipe-reset`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Refresh Stale Telepipe Checkpoint Documentation
Several docs and older QA scripts still describe `suspendedCheckpoint`, `captureRunCheckpoint()`, `restoreRunCheckpoint()`, and checkpoint log lines even though this ticket replaced that model with an in-memory paused run plus durable player HP/MS. This is confusing for future tickets that read docs before code.
### Acceptance Criteria
- `game/docs/design.md`, `game/docs/gameplay-review.md`, `game/docs/telepipe-tier2-context.md`, and stale Telepipe QA script comments/log checklist text describe the current in-memory pause/resume model and no longer refer to removed checkpoint APIs as live behavior.

## Clean Up Retired Abandon Run Artifacts
The UI and server handler for abandoning a suspended checkpoint were removed, but dead references remain such as `ABANDON_RUN` in shared events and `#abandon-run-btn` CSS. Removing or clearly marking these legacy leftovers will reduce false search hits.
### Acceptance Criteria
- Unused abandon-run shared event entries, CSS selectors, and any dead client references are removed or documented as intentionally legacy, with tests updated if needed.

## Stabilize Full-Suite Persistence Save Coverage
Round-3 `coverage.log` showed one full-suite failure in `server/test/persistence_save_triggers.test.js`, although the same spec passed in a focused rerun with the ticket-critical server tests. This looks like suite-order or timing flake and is worth isolating.
### Acceptance Criteria
- The full coverage command passes consistently, or the persistence-save batching test is adjusted so it is deterministic while still proving movement saves are batched once per tick.
