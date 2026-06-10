# Cleanup nits from server-quest-objective-crystals-despawn-after-loot-lifetime-19vg

> **Staleness note.** This follow-up ticket was written against commit
> `cdaaa9d0` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `server-quest-objective-crystals-despawn-after-loot-lifetime-19vg`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Regression test duplicates filter predicate locally

`crystal_lifetime.test.js` copies the filter expression into a local `filterExpiredLoot()` helper rather than importing or invoking the game-loop path. If someone edits `index.js` without updating the test mirror, the regression could silently stop catching drift.

### Acceptance Criteria
- `crystal_lifetime.test.js` exercises loot expiry through a shared export or a minimal game-loop harness call, not a duplicated one-liner
- A deliberate change to only one of the two copies causes the test suite to fail

## spawnCrystals tests do not assert questCritical flag

Existing spawn tests (`arena_spawn_cover`, `sunken_canyon_spawn`, `integration.test.js` crystal_rescue cases) verify crystal count and positions but never check `questCritical: true` on spawned loot entries.

### Acceptance Criteria
- At least one `spawnCrystals` test asserts every spawned crystal has `questCritical === true`
- Test fails if `questCritical` is removed from `spawnCrystals()` without updating the lifetime filter
