# Add rare/sparse spawn weights for flying enemies in thematic levels

Wire the two new flying enemy types into thematically appropriate quest spawn
pools with deliberately LOW (rare) weights so fliers stay sparse overall. Depends
on sub-ticket 01 (the server type ids must exist).

## Acceptance Criteria
- `void_seraph` is added to the `enemyPool` of high/airy levels — `spire_ascent` and
  `canyon_descent` in `game/server/quests.js` — each with `weight: 1` (rare relative to the
  pool's grunt/skirmisher weights of 2–3).
- `rime_drifter` is added to the `frost_crossing` `enemyPool` with `weight: 1` (rare relative to
  the existing `grunt`/`glacial_thrower` weights).
- Every flier weight added is strictly the minimum in its pool (no flier weight ≥ any non-flier
  weight in the same pool), keeping fliers sparse.
- No flying type is added to a thematically inappropriate pool (only the three pools above change);
  no other quest's pool gains a flier.
- A vitest test asserts: each named pool contains the expected flier id at `weight: 1`, and that
  the flier weight is the lowest entry in that pool.
- `pnpm test` (server suite) passes.

## Technical Specs
- `game/server/quests.js`: append `{ type: 'void_seraph', weight: 1 }` to the `spire_ascent`
  and `canyon_descent` `enemyPool` arrays, and `{ type: 'rime_drifter', weight: 1 }` to the
  `frost_crossing` `enemyPool` array. Leave `tier2EnemyPool`, scripted encounters, and
  `guaranteedEnemyType` untouched.
- Test under `game/server/test/` (reference `enemy-spawn-pools-wiring.test.js` for how pools are
  read and asserted).

## Verification: code
