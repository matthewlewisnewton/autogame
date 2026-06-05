# Wire spawn logic to per-level enemy pools

Replace the hardcoded enemy-type arrays in the bulk combat spawner and the
`survive` wave spawner with weighted draws from the selected quest's
`enemyPool`, so each level spawns only its thematically-appropriate enemies and
level-exclusive types never leak into other levels.

## Acceptance Criteria

- `spawnCombatEnemies` no longer uses the literal
  `['skirmisher','skirmisher','grunt','miniboss','spawner']` array. For each of
  the `quest.enemyCount` enemies it draws a type via
  `pickWeightedEnemyType(getEnemyPool(quest.id), rng)` using the run's seeded
  `rng`, so placement and type selection stay deterministic for a given seed.
- Every enemy spawned by `spawnCombatEnemies` for a given quest has a `type`
  contained in that quest's `enemyPool`.
- The `spawner` type (level-exclusive to `spire_ascent`) never spawns for any
  other quest; conversely a `spire_ascent` run can spawn `spawner`.
- The `survive` objective's `tickSpawns` draws its non-miniboss ("regular")
  spawns from the quest's `enemyPool` (excluding `miniboss`, which is still
  governed by `minibossCount`) instead of the hardcoded `SURVIVE_REGULAR_TYPES`
  array. The miniboss-tail behaviour (final `minibossCount` spawns are
  minibosses) is preserved.
- Existing enemy-spawn / objective tests still pass; quests whose pools have no
  `miniboss` (e.g. `training_caverns`, `crystal_rescue`) never produce a
  `miniboss` from bulk spawning.
- New/updated vitest tests assert: a seeded `spawnCombatEnemies` run for a
  representative quest produces only pool-valid types; `spawner` is absent for a
  non-spire quest and present-possible for `spire_ascent`; and the survive
  regular spawns come from the quest pool.

## Technical Specs

- `game/server/progression.js`:
  - In `spawnCombatEnemies(layout, rng, quest)`, import/require the new
    `getEnemyPool` + `pickWeightedEnemyType` from `./quests` and replace the
    `spawnTypes[i % spawnTypes.length]` selection with a weighted draw from
    `getEnemyPool(quest.id)` using the passed `rng`. Keep the existing
    `enemyCount`, `preferNearest`/`nearbyCount`, `pickEnemySpawnPosition`,
    `tier`/`roomTierAt`, and `randomWanderTarget` behaviour unchanged.
  - Ensure the `survive` path still short-circuits via
    `def?.skipBulkCombatSpawn?.(quest)` (unchanged).
- `game/server/objectives.js`:
  - In the `survive` def, make the regular (non-miniboss) type come from the
    quest's pool. Simplest approach: copy the pool onto the objective in
    `createObjective(quest)` (e.g. `enemyPool: getEnemyPool(quest.id)`), then in
    `tickSpawns` select the regular type via `pickWeightedEnemyType` over the
    pool filtered to exclude `miniboss` (falling back to the existing
    `SURVIVE_REGULAR_TYPES` if the filtered pool is empty). Keep the
    `isMiniboss = index >= total - minibossCount` tail logic.
  - Require `getEnemyPool` / `pickWeightedEnemyType` from `./quests`.
- Add/extend a vitest test (e.g. in the server test suite) that seeds a run for
  a given quest and asserts the spawned enemy `type`s are a subset of the
  quest's pool, plus the `spawner` cross-level exclusion.
- Do NOT modify the pool data/helpers from sub-ticket 01 (depends on them) and
  do NOT touch client code.

## Verification: code
