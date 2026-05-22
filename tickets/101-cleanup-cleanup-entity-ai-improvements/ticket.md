# Cleanup nits from 100-cleanup-entity-ai-improvements

> **Staleness note.** This follow-up ticket was written against commit
> `546f198` (2026-05-22). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `100-cleanup-entity-ai-improvements`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Misnamed wall-slide reached test

The test titled `returns reached: true after wall-slide lands within stopDistance` in `game/server/test/server.test.js` actually asserts `reached` is **not** true for the chosen wall geometry (and never asserts a true wall-slide case). Rename the test to match its behavior, or replace it with a layout that deterministically wall-slides into `stopDistance` and expects `reached: true`.

### Acceptance Criteria
- A `moveEntityToward` test name and assertions agree (either documents the false case or proves `reached: true` after wall-slide within `stopDistance`).
- All `moveEntityToward` tests still pass.
