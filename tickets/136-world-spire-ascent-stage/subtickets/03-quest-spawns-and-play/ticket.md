# Quest, spawns, and in-game wiring for Spire Ascent

Wire the spire-ascent stage into quest selection, distribute enemy spawns across
multiple tiers per the design, place the objective on the top tier, and add dev
debug shortcuts for QA.

## Acceptance Criteria

- A new quest in `game/server/quests.js` uses `layoutProfile: 'spire-ascent'`
  (e.g. `spire_ascent`) so `getLayoutProfileForQuest` and deploy load this layout
  in-game.
- `applyLayoutForQuest` / deploy places the squad on the **bottom tier**
  (`role: 'start'`, `tierIndex: 0`); `assignRunSpawnPositions` sets `player.y`
  from `sampleFloorY` at spawn.
- **Enemy spawns** for `profile === 'spire-ascent'`:
  - At least **1** enemy spawns on the bottom tier (`band === 'tier'` &&
    `tierIndex === 0`).
  - At least **1** enemy spawns on a non-bottom tier.
  - At least **1** enemy spawns on a non-top tier (when `enemyCount ≥ 3` and
    `numTiers ≥ 3`; otherwise distribute as evenly as possible across available
    middle/bottom tiers so spawns are not all on one tier).
  - **No** enemies spawn on ramp rooms (`band === 'ramp'` / `role ===
    'connector'`).
  - Placement stays **seeded** (`mulberry32(layoutSeed + offset)`, not
    `Math.random()` for positions).
- **Objective / exit on top tier**: for `defeat_enemies`, the visible treasure
  marker (top tier `role: 'treasure'`) marks the exit; for `collect_items`,
  crystals spawn only on the top tier room pool. Nothing places objectives on
  ramps or the bottom tier alone.
- **Reachability**: unit test confirms a player at bottom-tier spawn can reach
  the top-tier treasure room center via walkable AABBs climbing ramps only
  (reuse helper from sub-ticket 01).
- **`DEBUG_SCENARIOS`**: add `spire-ascent` and `spire-ascent-stage` in
  `game/server/index.js` (mirror `sunken-canyon` / `sunken-canyon-stage`):
  - `spire-ascent`: select the spire quest, apply layout, spawn enemies, seat
    player on bottom tier with correct `player.y`.
  - `spire-ascent-stage`: layout-only shortcut for render/collision QA (no
    enemy spawn).
- Unit tests in `game/server/test/spire_ascent_spawn.test.js` (or
  `dungeon.test.js`) cover spawn tier distribution for a fixed seed.

## Technical Specs

- `game/server/quests.js`: add quest def (name, description, `enemyCount` ≥ 6,
  `layoutProfile: 'spire-ascent'`, `objectiveType: 'defeat_enemies'` or
  equivalent).
- `game/server/progression.js`:
  - Add `isSpireAscentLayout(layout)` (`layout.profile === 'spire-ascent'`).
  - Add `spireAscentRoomsByTier(layout, tierIndex)` filtering `band === 'tier'`.
  - Extend `pickEnemySpawnPosition` with `pickSpireAscentEnemySpawn`: round-robin
    or quota-based assignment across tier rooms (reserve bottom-tier slot(s),
    spread remainder across middle and upper tiers; never sample `band ===
    'ramp'`).
  - Extend `spawnCrystals` / `spawnLoot` so spire-ascent objectives target the
    top tier (`role: 'treasure'` / max `tierIndex`) only.
- `game/server/index.js`:
  - Add `'spire-ascent'` and `'spire-ascent-stage'` to `DEBUG_SCENARIOS`.
  - Handlers mirror sunken-canyon patterns: regenerate layout, rebuild colliders,
    set player to start room + `sampleFloorY`, emit `questUpdate`; full scenario
    also calls `spawnEnemies()`.
- `game/server/test/spire_ascent_spawn.test.js`: new file patterned on
  `sunken_canyon_spawn.test.js` — band/tier counts, no ramp spawns,
  determinism, objective room tier for collect quests if applicable.
- `game/server/test/integration.test.js` or `server.test.js`: assert new quest
  appears in `listQuests()` output (one-liner smoke).

## Verification: code
