# Guarantee Glacial Thrower spawns in Frost Crossing

The ice level's signature foe is currently only a weighted random pool entry, so
Frost Crossing can spawn zero Glacial Throwers. Guarantee at least one
`glacial_thrower` appears in every Frost Crossing combat spawn set, then draw the
remaining enemies from the weighted pool as before.

## Acceptance Criteria

- Every Frost Crossing (`frost_crossing`, tier 1) combat run spawns **at least
  one** `glacial_thrower` enemy, for all layout seeds.
- The remaining (non-guaranteed) enemies are still drawn from the weighted pool,
  so other pool types (`grunt`, `skirmisher`) can still appear.
- The guarantee is **level-scoped**: quests whose pool does not declare a
  guaranteed/signature enemy (e.g. `training_caverns`, `ember_descent`) are
  unaffected and spawn exactly as before (no forced type).
- Type selection remains deterministic for a given seed (same `rng` threading).
- A server test in `game/server/test/ice_enemy.test.js` asserts that across
  several representative seeds, the Frost Crossing combat spawn set always
  contains a `glacial_thrower`, and that a non-ice quest's spawn set is not
  forced to contain it.

## Technical Specs

- `game/server/quests.js`: Add a quest-level declaration on `frost_crossing`
  (e.g. a `guaranteedEnemyType: 'glacial_thrower'` field, or equivalent) marking
  the signature foe that must always appear. Do not change other quests' pools.
  Export any new accessor if needed (mirror the `getEnemyPool` style).
- `game/server/progression.js`: In `spawnCombatEnemies(layout, rng, quest)`
  (around line 2471), if the quest declares a guaranteed enemy type, force the
  first spawned enemy to that type and draw the remaining `enemyCount - 1`
  enemies from the weighted pool via `pickWeightedEnemyType` as today. Keep
  `rng`/position threading identical so determinism holds; guard so quests
  without a guaranteed type are unchanged.
- `game/server/test/ice_enemy.test.js`: Add the spawn-guarantee test described
  in the acceptance criteria (drive `spawnCombatEnemies` / the same code path
  used by existing tests in that file, across a handful of seeds).

## Verification: code
