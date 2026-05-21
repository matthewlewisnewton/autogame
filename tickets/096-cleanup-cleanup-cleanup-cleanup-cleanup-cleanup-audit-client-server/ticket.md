# Cleanup nits from 095-cleanup-cleanup-cleanup-cleanup-cleanup-audit-client-server

> **Staleness note.** This follow-up ticket was written against commit
> `658782f` (2026-05-21). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `095-cleanup-cleanup-cleanup-cleanup-cleanup-audit-client-server`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Consolidate overlapping monster integration tests

`game/server/test/integration.test.js` now has two Monster card tests (`emits useCard, server spawns…` and `uses monster card via useCard…`) that share nearly identical `monster-card` scenario setup. Only the second asserts `stateUpdate.minions` and hand replacement. Merging or extracting a shared helper would cut duplication without losing coverage.

### Acceptance Criteria
- One shared setup helper (or a single test) covers monster spawn, `stateUpdate.minions`, and hand-slot replacement.
- `pnpm run test` in `game/` still passes with no regression in monster assertions.

## Add stateUpdate minion assertion to the simpler monster test

After consolidating setup, the shorter test `emits useCard, server spawns a minion in gameState.minions` still only checks `gameState.minions` on the server object, not the broadcast `stateUpdate` payload. Aligning it with the richer test (or folding into one test) would catch replication gaps in both places.

### Acceptance Criteria
- The refactored monster spawn test (or merged test) awaits `stateUpdate` after `useCard` and asserts `updatedSnapshot.minions` includes the new minion with `ownerId` and `hp: 50`.
