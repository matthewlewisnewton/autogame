# Cleanup nits from 093-cleanup-cleanup-cleanup-audit-client-server

> **Staleness note.** This follow-up ticket was written against commit
> `e0c3abe` (2026-05-21). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `093-cleanup-cleanup-cleanup-audit-client-server`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Remove unused `lastCardUse` in main.js

`game/client/main.js` declares `let lastCardUse = null` with a comment about tracking card use before `stateUpdate`, but nothing reads or assigns it after the 093 diff. Dead state adds noise for readers tracing monster authority.

### Acceptance Criteria
- Delete `lastCardUse` (and its comment) unless wired into harness or reconciliation logging.
- `pnpm test` in `game/` still passes.

## Optional server integration test for monster play

Client unit test and visual capture now cover monster happy-path authority. Server integration tests only assert `monster-card` scenario hand composition, not a full `useCard` → minion → `drawReplacementCard` → `stateUpdate` chain.

### Acceptance Criteria
- Add one integration test that applies `monster-card`, emits `useCard` on the monster slot, and asserts hand slot replacement and minion presence via `stateUpdate` without client involvement.
