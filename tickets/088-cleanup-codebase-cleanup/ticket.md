# Cleanup nits from 019-codebase-cleanup

> **Staleness note.** This follow-up ticket was written against commit
> `c25e434` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `019-codebase-cleanup`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Finish Moving Secondary Tunables Into Config
Some lower-priority literals remain inline after the main cleanup, such as respawn delay, loot lifetime, loot spawn chance, stale-cleanup interval, damage-number duration, and camera projection values. Moving these into the existing config modules would make later balance and polish work easier.

### Acceptance Criteria
- Server runtime tunables that are not data definitions are exported from `game/server/config.js` and imported by `game/server/index.js`.
- Client visual/UI tunables that are reused or likely to change are exported from `game/client/config.js` and imported by their callers.
- Existing tests continue to pass.

## Remove Integration Test Listener Warning
The coverage log includes a `MaxListenersExceededWarning` during socket integration tests. It does not fail the ticket, but cleaning up listener lifecycle or test server reuse would make future test output easier to trust.

### Acceptance Criteria
- Running `pnpm test` from `game/` no longer emits `MaxListenersExceededWarning`.
- Integration tests still cover the existing socket connection and gameplay flows.
