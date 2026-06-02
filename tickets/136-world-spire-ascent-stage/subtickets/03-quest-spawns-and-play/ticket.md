# Quest, spawns, and in-game wiring for Spire Ascent

Wire the spire-ascent stage into quest selection, distribute enemy spawns across
tiers (not all on the bottom or top), place objectives on the final tier, and add
a dev debug shortcut for QA. Depends on sub-tickets 01 (layout) and 02 (client
render); server movement should already follow floor Y via existing slope work.

## Acceptance Criteria

- A new quest in `game/server/quests.js` uses `layoutProfile: 'spire-ascent'`
  (e.g. `spire_ascent`) so `getLayoutProfileForQuest` and deploy load this layout
  in-game.
- Deploy / `applyLayoutForQuest` for this quest calls
  `generateLayout(seed, 'spire-ascent')` (no `{ slopes: true }` needed — layout
  is bespoke). Squad spawns on **bottom tier** (`role: 'start'` /
  `tierIndex === 0`); `player.y` is set from `sampleFloorY` at spawn.
- **Enemy spawns** when `layout.profile === 'spire-ascent'` (or via
  `isSpireAscentLayout`):
  - At least **1** enemy on tier 0 (`tierIndex === 0`).
  - At least **1** enemy on a tier with `tierIndex ≥ 1` when `enemyCount ≥ 2`.
  - **No** enemies on ramp rooms (`band === 'ramp'` / `role === 'connector'`).
  - Remaining enemies spread across middle/top combat tiers using **seeded**
    placement (`mulberry32(layoutSeed + offset)`, not unseeded `Math.random()`).
- **Objective on final tier**: for `collect_items`, crystals spawn only in the
  top `treasure` tier room pool; for `defeat_enemies`, the treasure marker
  (top tier from sub-ticket 01) marks the exit — nothing on ramps or bottom
  tier-only objective placement.
- **Reachability**: unit test confirms foot path from bottom-tier spawn to
  top-tier treasure center via walkable AABBs (reuse helper from sub-ticket 01).
- **`DEBUG_SCENARIOS`**: add `spire-ascent-stage` in `game/server/index.js`
  (mirror `sunken-canyon-stage`) that loads `generateLayout(seed,
  'spire-ascent')`, seats the player on the start tier with correct `player.y`,
  and emits `questUpdate` with the layout.
- Unit tests in `game/server/test/spire_ascent_spawn.test.js` (or
  `dungeon.test.js`) assert spawn tier distribution for a fixed seed after
  `spawnEnemies()`.

## Technical Specs

- `game/server/quests.js`: add quest def (`name`, `description`, `enemyCount`,
  `layoutProfile: 'spire-ascent'`, `objectiveType` e.g. `defeat_enemies`).
- `game/server/progression.js`:
  - Add `isSpireAscentLayout(layout)` (`layout.profile === 'spire-ascent'`).
  - Extend `pickEnemySpawnPosition` / `spawnCombatEnemies`: when spire-ascent,
    reserve spawns on `band === 'tier'` filtered by `tierIndex`, never ramps;
    enforce bottom-tier and upper-tier quotas before filling remainder.
  - Extend `spawnCrystals` / loot so objectives target `role === 'treasure'` /
    highest `tierIndex` only.
- `game/server/index.js`:
  - Add `'spire-ascent-stage'` to `DEBUG_SCENARIOS` with handler like
    `sunken-canyon-stage` (layout regen, `start` room position, `sampleFloorY`
    for `player.y`, `questUpdate` emit).
  - Update `QUEST_DEFS` test expectations in `server.test.js` if they assert
    a fixed quest key list.
- Tests: `game/server/test/spire_ascent_spawn.test.js` patterned on
  `sunken_canyon_spawn.test.js` (enemy tier counts, crystal placement band).

## Verification: code
