# Cleanup nits from 081-cleanup-enemy-type-spawner

> **Staleness note.** This follow-up ticket was written against commit
> `5291ebb` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `081-cleanup-enemy-type-spawner`.
None blocked acceptance — clean them up when convenient.

## Have `spawnEnemy()` return the spawned enemy

The `spawner-active` debug scenario calls `spawnEnemy()` and then
reaches back into `gameState.enemies[gameState.enemies.length - 1]` to
grab the just-spawned enemy so it can backdate `lastSpawnTime`. Having
`spawnEnemy()` return the enemy it just pushed would let callers write
`const spawner = spawnEnemy(...)` directly. Minor ergonomic cleanup —
the only existing post-spawn mutation today is this one scenario, but
future callers will appreciate not needing the `enemies.length - 1`
peek.

### Acceptance Criteria
- `spawnEnemy()` in `game/server/index.js` returns the enemy object it
  pushes onto `gameState.enemies`.
- The `spawner-active` branch in `applyDebugScenario` uses the return
  value directly instead of indexing into `gameState.enemies`.
- All existing server and integration tests still pass.
