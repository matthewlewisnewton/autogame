# Quest, spawns, and in-game wiring for Spire Ascent

Wire the spire-ascent stage into quest selection, distribute enemies across
multiple tiers (not only bottom or top), place the objective on the final tier,
and add dev debug shortcuts so the stage is playable and QA-able in one run.

## Acceptance Criteria

- A new quest in `game/server/quests.js` uses `layoutProfile: 'spire-ascent'`
  (e.g. `spire_ascent`) so deploy loads this layout in-game.
- `applyLayoutForQuest` / deploy places the squad on the **bottom tier** (`start`
  room); `player.y` is set from `sampleFloorY` at spawn (slope-follow from
  ticket 117 must remain active during the climb).
- **Enemy spawns** when `layout.profile === 'spire-ascent'`:
  - At least **1** enemy on the **bottom** tier (`band === 'tier'`,
    `tierIndex === 0`).
  - At least **1** enemy on a **non-bottom, non-top** tier when `numTiers ≥ 4`;
    when `numTiers === 3`, at least **1** on the middle (`tierIndex === 1`).
  - At least **1** enemy on the **top** tier (`tierIndex === numTiers − 1`).
  - **No** enemies on ramp rooms (`band === 'ramp'` / `role === 'connector'`).
  - Placement is **seeded** (`mulberry32(layoutSeed + offset)`), deterministic
    for a fixed seed.
- **Objective on top tier**: for `defeat_enemies`, the visible treasure marker
  targets the top `treasure` room; for `collect_items`, crystals spawn only in
  the top-tier room pool (never bottom tier or ramps).
- **Foot reachability**: unit test confirms plateau/spawn-tier center can reach
  top-tier treasure center via walkable AABBs (reuse helper from sub-ticket 01
  or movement smoke).
- **`DEBUG_SCENARIOS`** in `game/server/index.js`:
  - `spire-ascent-stage` — layout only, player on bottom tier with correct
    `player.y` (mirror `sunken-canyon-stage`).
  - `spire-ascent` — full quest shortcut: select spire quest, regenerate layout,
    `spawnEnemies()`, re-seat player on bottom tier (mirror `sunken-canyon`).
- **Camera follow**: `updateCameraOrbit` in `game/client/renderer.js` already
  tracks `playerY + CAMERA_HEIGHT`; add or extend a unit test asserting camera
  target Y rises when `playerY` increases (no code change required if test
  passes with existing lerp — fix only if ascent exposes clipping).
- Unit tests in `game/server/test/spire_ascent_spawn.test.js` (or
  `dungeon.test.js`) cover spawn tier distribution for a fixed seed.

## Technical Specs

- `game/server/quests.js`: add quest def (`spire_ascent`, description, enemy
  count, `layoutProfile: 'spire-ascent'`, `objectiveType: 'defeat_enemies'` or
  `collect_items`).
- `game/server/progression.js`:
  - Add `isSpireAscentLayout(layout)` and `spireAscentTiersByIndex(layout)`.
  - Extend `pickEnemySpawnPosition` / `spawnCombatEnemies`: round-robin or
    slot map across `tierIndex` values (skip ramps), guaranteeing bottom,
    middle (when present), and top placements before filling remaining slots.
  - Extend `spawnCrystals` / loot so spire-ascent objectives target top-tier
    rooms only.
- `game/server/index.js`: add `'spire-ascent-stage'` and `'spire-ascent'` to
  `DEBUG_SCENARIOS` with handlers mirroring sunken-canyon patterns.
- `game/client/renderer.js`: only change if camera lerp/clipping fails on high
  Y; prefer a focused unit test over speculative tweaks.
- Tests: `game/server/test/spire_ascent_spawn.test.js` modeled on
  `sunken_canyon_spawn.test.js` (`bandAt`, `tierIndex` helpers).

## Verification: code
