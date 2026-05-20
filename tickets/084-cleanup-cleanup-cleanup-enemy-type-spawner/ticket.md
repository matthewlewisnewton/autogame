# Cleanup nits from 083-cleanup-cleanup-enemy-type-spawner

> **Staleness note.** This follow-up ticket was written against commit
> `4a9bcff` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `083-cleanup-cleanup-enemy-type-spawner`.
None blocked acceptance — clean them up when convenient.

## Apply the `spawnEnemy()` return value in `spawnEnemies()` too

Now that `spawnEnemy()` returns the created enemy, the
`spawnEnemies()` helper in `game/server/index.js` (lines 647-654) still
uses the older `gameState.enemies[gameState.enemies.length - 1]` peek
pattern when assigning `wanderTarget`. This is the same readability nit
that 083 cleaned up in `applyDebugScenario`, and the natural next step
to keep the codebase consistent. Out of scope for ticket 083 (which
explicitly scoped to the `spawner-active` branch), but a clean
follow-up.

### Acceptance Criteria
- `spawnEnemies()` in `game/server/index.js` captures the return value
  of `spawnEnemy(...)` and assigns `wanderTarget` directly on it,
  instead of indexing into `gameState.enemies`.
- All existing server and integration tests still pass.
