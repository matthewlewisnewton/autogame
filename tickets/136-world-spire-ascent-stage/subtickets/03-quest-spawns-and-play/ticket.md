# Quest, spawns, and in-game wiring for Spire Ascent

Wire the spire-ascent stage into quest selection, distribute enemy spawns across
tiers (not clustered on only the bottom or top), place objectives on the final
tier, and add dev debug shortcuts for QA.

## Acceptance Criteria

- A new quest in `game/server/quests.js` uses `layoutProfile: 'spire-ascent'`
  (e.g. `spire_ascent`) so `getLayoutProfileForQuest` and deploy load this layout
  in-game.
- `applyLayoutForQuest` / deploy places the squad on **tier 0** (`start` room);
  `assignRunSpawnPositions` sets `player.y` from `sampleFloorY` at spawn.
- **Enemy spawns** for `profile === 'spire-ascent'`:
  - At least **1** enemy on a **non-top** combat tier (`tierIndex` < N−1).
  - At least **1** enemy on a **non-bottom** tier (`tierIndex` > 0).
  - Not **all** enemies on tier 0 alone, and not **all** on the top tier alone.
  - No enemies on ramp rooms (`band === 'ramp'` / `role === 'connector'`).
  - Placement stays **seeded** (`mulberry32(layoutSeed + offset)`, not unseeded
    `Math.random()` for positions).
- **Objective / exit on top tier**: for `collect_items` quests, crystals spawn only
  on the top tier (`treasure` / highest `tierIndex`); for `defeat_enemies`, the
  treasure marker (top-tier `treasure` role) marks the exit — nothing required on
  lower tiers for completion.
- **Reachability**: unit test confirms a player at tier-0 spawn can reach the
  top-tier treasure room centre via walkable AABBs using ramps only (reuse helper
  from sub-ticket 01).
- **`DEBUG_SCENARIOS`** in `game/server/index.js`:
  - `spire-ascent-stage`: load layout only, re-seat player on tier 0 with correct
    `player.y` (mirror `sunken-canyon-stage`).
  - `spire-ascent`: select the spire quest, deploy layout, `spawnEnemies`, reset
    player to `firstRoomPosition()` + `sampleFloorY` (mirror `sunken-canyon`).
- Unit tests in `game/server/test/spire_ascent_spawn.test.js` (or
  `dungeon.test.js`) cover per-tier spawn counts for a fixed seed.

## Technical Specs

- `game/server/quests.js`: add quest def (name, description, `enemyCount`,
  `layoutProfile: 'spire-ascent'`, `objectiveType` — `defeat_enemies` recommended).
- `game/server/progression.js`:
  - Add `isSpireAscentLayout(layout)` (`layout.profile === 'spire-ascent'`).
  - Add `spireAscentRoomsByTier(layout, tierIndex)` helper filtering
    `band === 'tier' && tierIndex === n`.
  - Extend `pickEnemySpawnPosition` / `spawnCombatEnemies`: when spire-ascent,
    round-robin or bucket spawns across tier indices 1..N−2 (combat tiers) and
    optionally tier 0 / top with caps so both “low” and “high” tiers receive at
    least one enemy; never sample `band === 'ramp'`.
  - Extend `spawnCrystals` / `spawnLoot` so spire-ascent objectives target only
    the top tier room pool.
- `game/server/index.js`: add `'spire-ascent-stage'` and `'spire-ascent'` to
  `DEBUG_SCENARIOS` with handlers mirroring the sunken-canyon scenarios.
- Tests: `game/server/test/spire_ascent_spawn.test.js` modeled on
  `sunken_canyon_spawn.test.js` — band/tier assertions after `spawnEnemies()`.

## Verification: code
