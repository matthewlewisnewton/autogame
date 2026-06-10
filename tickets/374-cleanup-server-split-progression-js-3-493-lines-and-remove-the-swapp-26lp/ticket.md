# Cleanup nits from server-split-progression-js-3-493-lines-and-remove-the-swapp-26lp

> **Staleness note.** This follow-up ticket was written against commit
> `a9b7f615` (2026-06-09). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `server-split-progression-js-3-493-lines-and-remove-the-swapp-26lp`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Harden Disconnect Cleanup For Malformed Test Runs
`coverage.log` shows two non-failing `[socket:disconnect] handler error` entries from tests that manually set `state.run = { status: 'playing' }` without an objective. This is test-fixture shaped rather than a normal gameplay crash, but the disconnect path should either tolerate incomplete test run objects or the affected tests should preserve a valid run objective to keep logs clean.
### Acceptance Criteria
- Disconnecting a player during the existing card wind-up tests no longer logs `TypeError: Cannot read properties of undefined (reading 'type')`.
- The fix does not hide real unknown objective types for valid runs that include an objective.

## Consolidate Server Card Definition Overlays
The same server-side `CARD_STAT_OVERLAY` / `CARD_DEFS` construction now appears in multiple progression modules. This is non-blocking, but a shared helper would reduce drift risk when new card stat overlays are added.
### Acceptance Criteria
- Server progression modules that need card definitions import them from a single shared helper or registry.
- Existing card definition behavior and related tests remain unchanged.
