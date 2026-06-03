# Staggered over-time spawning for survive runs

For a `survive` run, spawn `totalSpawns` enemies gradually over the encounter
(rather than all at once) until the full total — including exactly
`minibossCount` minibosses — has entered the dungeon. Reuse the existing
combat-enemy spawner and spawn-position picker. Depends on sub-ticket 01.

## Acceptance Criteria

- When a `survive` run starts, the dungeon does NOT spawn all `totalSpawns`
  enemies up front; the up-front bulk `spawnCombatEnemies` path is skipped (or
  produces no enemies) for `survive` quests.
- A tick-driven spawner adds enemies over time: while
  `objective.spawnedEnemies < totalSpawns`, it spawns the next enemy on a time
  interval and increments `objective.spawnedEnemies` each time, stopping once
  `spawnedEnemies === totalSpawns`.
- Across the full encounter, exactly `minibossCount` of the spawned enemies are
  of the `miniboss` type and the remaining `totalSpawns - minibossCount` are
  regular enemy types.
- Enemy placement uses `pickEnemySpawnPosition(...)` (the same picker used by
  `spawnCombatEnemies`) so spawns land on valid floor / combat rooms.
- The spawner only runs for `survive` runs in the `playing` phase; non-survive
  quests are unaffected, and no spawns occur after the run is no longer
  `playing`.
- Existing server + client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/server/progression.js`:
  - Add a spawner helper (e.g. `updateSurviveSpawns()`) that: returns early
    unless `_gameState.run` is a `playing` `survive` run; throttles on a stored
    timestamp (e.g. `_gameState.run.objective.lastSpawnAt`) using a spawn
    interval; and, while `spawnedEnemies < totalSpawns`, spawns one enemy via
    the existing `spawnEnemy(...)` path positioned by
    `pickEnemySpawnPosition(layout, rng, ...)`. Choose the type so that the
    first/last `minibossCount` spawns are `miniboss` and the rest are regular
    types, then bump `objective.spawnedEnemies`.
  - `spawnEnemies()` (~2873) / `spawnCombatEnemies()` (~2799): for
    `objectiveType === 'survive'`, skip the bulk combat spawn at run open so the
    staggered spawner is the sole source of survive enemies.
  - Export the new spawner function from the module.
- `game/server/index.js`: call the new spawner inside `runGameLoopTick()`
  (~1466) within the `state.gamePhase === 'playing'` block, alongside
  `updateEnemies()`. Add it to the destructured imports from `./progression`.
- Add focused unit tests (e.g. in `game/server/test/server.test.js`) that drive
  the spawner over simulated time and assert the total spawn count and miniboss
  count.

## Verification: code
