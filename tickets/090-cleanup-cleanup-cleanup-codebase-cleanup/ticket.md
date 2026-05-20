# Cleanup nits from 089-cleanup-cleanup-codebase-cleanup

> **Staleness note.** This follow-up ticket was written against commit
> `d1e882e` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `089-cleanup-cleanup-codebase-cleanup`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Align updateMinions loot mock with LOOT_SPAWN_CHANCE

The dedicated `spawnLoot` describe block now uses `config.LOOT_SPAWN_CHANCE`, but `updateMinions() > spawns loot for dead enemies and removes them` still hardcodes `Math.random` to `0.1` with a generic comment. If `LOOT_SPAWN_CHANCE` drops below `0.1`, that integration test could fail while unit tests still pass.

### Acceptance Criteria
- `game/server/test/server.test.js` line ~630 uses `config.LOOT_SPAWN_CHANCE - 0.1` (or equivalent) for the spawnLoot-forcing mock.
- Comment references `LOOT_SPAWN_CHANCE`, not a magic number.
- `pnpm test` from `game/` passes.
