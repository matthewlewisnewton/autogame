# Quest, spawns, and in-game wiring for Spire Ascent

Wire the spire-ascent stage into quest selection, distribute enemy spawns across
bottom, middle, and top tiers, place the objective on the final tier, and add a
dev debug shortcut for QA.

## Acceptance Criteria

- A new quest in `game/server/quests.js` uses `layoutProfile: 'spire-ascent'`
  (e.g. `spire_ascent`) so `getLayoutProfileForQuest` and deploy load this layout
  in-game.
- Deploy places the squad on the **bottom tier** (`role: 'start'` / `tierIndex:
  0`); `assignRunSpawnPositions` sets `player.y` from `sampleFloorY` at spawn.
- **Enemy spawns** when `layout.profile === 'spire-ascent'`:
  - Not all enemies on the bottom tier (`tierIndex === 0`).
  - Not all enemies on the top tier (highest `tierIndex`).
  - No enemies on ramp rooms (`band === 'ramp'` / `role === 'connector'`).
  - Placement stays **seeded** (`mulberry32(layoutSeed + offset)`, not
    `Math.random()`).
- **Objective on final tier**: for `collect_items`, crystals spawn only on the top
  tier room; for `defeat_enemies`, the treasure marker / exit is the top-tier
  `treasure` room from sub-ticket 01 — never on bottom or ramp rooms.
- **Reachability**: unit test confirms a player at bottom-tier spawn can reach the
  top-tier treasure center via walkable AABBs (reuse helper from sub-ticket 01 or
  dedicated `game/server/test/spire_ascent_spawn.test.js`).
- **`DEBUG_SCENARIOS`**: add `spire-ascent` in `game/server/index.js` (same pattern
  as `sunken-canyon`) that selects the spire quest, regenerates layout, spawns
  enemies, and re-seats the player on the bottom tier with correct `player.y`.
- Unit tests cover spawn tier distribution for a fixed seed (mirror
  `game/server/test/sunken_canyon_spawn.test.js`).

## Technical Specs

- `game/server/quests.js`: add quest def (`name`, `description`, `enemyCount`,
  `layoutProfile: 'spire-ascent'`, `objectiveType` appropriate for testing both
  defeat and/or collect flows — prefer `defeat_enemies` to match canyon_descent).
- `game/server/progression.js`:
  - Add `isSpireAscentLayout(layout)` (`layout.profile === 'spire-ascent'`).
  - Add `spireAscentRoomsByTier(layout, tierIndex)` filtering `band === 'tier'`.
  - Extend `pickEnemySpawnPosition` / `spawnCombatEnemies`: when spire-ascent,
    allocate spawns across tier indices (e.g. force ≥1 on tier 0 and ≥1 on max
    tier when `enemyCount ≥ 2`, fill remainder from middle tiers and lower tiers
    with seeded `randomPositionInRoom`, never ramps).
  - Extend `spawnCrystals` / loot so spire-ascent objectives target only the top
    tier (`role === 'treasure'` / max `tierIndex`).
- `game/server/index.js`:
  - Branch `applyLayoutForQuest` / deploy path for `layoutProfile ===
    'spire-ascent'` (same as sunken-canyon: `generateLayout(seed, 'spire-ascent')`).
  - Add `'spire-ascent'` to `DEBUG_SCENARIOS` handler mirroring sunken-canyon.
- `game/server/test/spire_ascent_spawn.test.js` (new): band/tier assertions for
  `generateLayout` + `spawnEnemies()` with fixed seed, ramp exclusion, objective
  tier placement.

## Verification: code
