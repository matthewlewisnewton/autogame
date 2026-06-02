# Quest, spawns, and in-game wiring for Sunken Canyon

Wire the sunken-canyon stage into quest selection, distribute enemy spawns across
plateau and canyon per the design, place collect/objective targets on the canyon
floor, and add a dev debug shortcut for QA.

## Acceptance Criteria

- A new quest in `game/server/quests.js` uses `layoutProfile: 'sunken-canyon'`
  (e.g. `canyon_descent`) so `getLayoutProfileForQuest` and deploy load this
  layout in-game.
- `applyLayoutForQuest` / deploy places the squad on the **plateau** (`start`
  room); `assignRunSpawnPositions` sets `player.y` from `sampleFloorY` at spawn.
- **Enemy spawns** for `profile === 'sunken-canyon'` (or `layout.band` metadata):
  - At least **1** enemy spawns on the plateau band (`band === 'plateau'`).
  - **Majority** of enemies spawn on the canyon band (`band === 'canyon'`).
  - No enemies spawn on ramp rooms (`band === 'ramp'` / `role === 'connector'`).
  - Placement stays **seeded** (use `mulberry32(layoutSeed + offset)`, not
    `Math.random()` for positions).
- **Objective / exit on canyon floor**: for `collect_items` quests, crystals use
  the canyon (`treasure` / `band === 'canyon'`) room pool first; for
  `defeat_enemies`, the visible treasure marker (canyon `treasure` role from
  sub-ticket 01) marks the exit side — no objective placed on the plateau.
- **Reachability**: unit test confirms a player at plateau spawn can reach the
  canyon treasure room center via walkable AABBs without leaving the layout
  (reuse reachability helper from sub-ticket 01 or server movement smoke).
- **`DEBUG_SCENARIOS`**: add `sunken-canyon` in `game/server/index.js` (same
  pattern as `open-plaza-arena`) that sets the canyon quest, regenerates layout,
  spawns enemies, and re-seats the player on the plateau with correct `player.y`.
- Unit tests in `game/server/test/dungeon.test.js` or
  `game/server/test/server.test.js` cover spawn band counts for a fixed seed.

## Technical Specs

- `game/server/quests.js`: add quest def (name, description, `enemyCount`,
  `layoutProfile: 'sunken-canyon'`, `objectiveType` as appropriate).
- `game/server/progression.js`:
  - Add `isSunkenCanyonLayout(layout)` (`layout.profile === 'sunken-canyon'`).
  - Extend `pickEnemySpawnPosition` (or `spawnCombatEnemies`) to, when sunken
    canyon: force the first spawn (or first two when `enemyCount ≥ 2`) into
    `rooms.filter(r => r.band === 'plateau')`, then sample remaining spawns
    from `band === 'canyon'` with seeded `randomPositionInRoom`.
  - Extend `spawnCrystals` / loot placement so sunken-canyon objectives target
    the canyon room only (never plateau/ramp).
- `game/server/index.js`: add `'sunken-canyon'` to `DEBUG_SCENARIOS` with a
  handler mirroring `open-plaza-arena` (select quest, `applyLayoutForQuest`,
  `spawnEnemies`, reset player to `firstRoomPosition()` + `sampleFloorY`).
- Tests: spawn band assertions for `generateLayout(123, 'sunken-canyon')` with
  `spawnEnemies()` or direct `pickEnemySpawnPosition` calls.

## Verification: code
