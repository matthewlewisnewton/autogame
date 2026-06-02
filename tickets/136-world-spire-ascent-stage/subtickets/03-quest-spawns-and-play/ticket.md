# Quest, spawns, and in-game wiring for Spire Ascent

Wire the spire-ascent stage into quest selection, distribute enemy spawns
across multiple tiers (not concentrated on only the bottom or top), place the
objective on the final tier, and add a dev debug shortcut for QA.

## Acceptance Criteria

- A new quest in `game/server/quests.js` uses `layoutProfile: 'spire-ascent'`
  (e.g. `spire_ascent`) so deploy loads this layout in-game.
- `applyLayoutForQuest` / deploy places the squad on the **bottom tier**
  (`role: 'start'`); `assignRunSpawnPositions` sets `player.y` from
  `sampleFloorY` at spawn.
- **Enemy spawns** when `layout.profile === 'spire-ascent'`:
  - At least **one** enemy on the **bottom** tier (`band === 'tier'` and
    `tierIndex === 0`).
  - At least **one** enemy on a **non-bottom, non-ramp** tier (`tierIndex ≥ 1`
    and `tierIndex < max`).
  - At least **one** enemy on the **top** tier (`role === 'treasure'` or max
    `tierIndex`).
  - **No** enemies on ramp rooms (`band === 'ramp'` / `role === 'connector'`).
  - Placement stays **seeded** (`mulberry32(layoutSeed + offset)`).
- **Objective / exit on top tier**: for `defeat_enemies`, the treasure marker
  (top `treasure` tier) marks the exit; for `collect_items`, crystals spawn only
  on the top tier room pool (never bottom tier or ramps).
- **Reachability** unit test: player at bottom-tier spawn can reach top-tier
  treasure center via walkable AABBs (reuse helper from sub-ticket 01).
- **`DEBUG_SCENARIOS`** in `game/server/index.js`: add `spire-ascent` (and/or
  `spire-ascent-stage`) that selects the spire quest, regenerates layout, spawns
  enemies, and re-seats the player on the start tier with correct `player.y`.
- Unit tests in `game/server/test/spire_ascent_spawn.test.js` (or adjacent
  spawn test file) cover tier distribution and determinism for a fixed seed.

## Technical Specs

- `game/server/quests.js`: add quest def (`name`, `description`, `enemyCount`,
  `layoutProfile: 'spire-ascent'`, `objectiveType: 'defeat_enemies'` or
  `collect_items` as appropriate).
- `game/server/progression.js`:
  - Add `isSpireAscentLayout(layout)` (`layout.profile === 'spire-ascent'`).
  - Add `pickSpireAscentEnemySpawn(layout, rng, spawnIndex, enemyCount)` that
    round-robins or buckets spawns across `band === 'tier'` rooms by
    `tierIndex` (reserve slots for bottom, middle, and top tiers when
    `enemyCount` allows).
  - Extend `pickEnemySpawnPosition`, `spawnCrystals`, and `spawnLoot` to branch
    on spire-ascent like sunken-canyon.
- `game/server/index.js`:
  - Add debug scenario handler mirroring `sunken-canyon` (layout load, spawn at
    start tier, `sampleFloorY` for `player.y`, `spawnEnemies`, emit
    `questUpdate`).
  - Register scenario name in `DEBUG_SCENARIOS` list.
- Tests: new `game/server/test/spire_ascent_spawn.test.js` patterned on
  `sunken_canyon_spawn.test.js` (`tierIndex` / `band` helpers instead of
  plateau/canyon).

## Verification: code
