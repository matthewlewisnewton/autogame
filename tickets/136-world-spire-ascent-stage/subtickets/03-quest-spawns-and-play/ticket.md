# Quest, spawns, and in-game wiring for Spire Ascent

Wire the spire-ascent stage into quest selection, distribute enemy spawns across
multiple tiers (not only bottom or top), place objectives on the final tier, and
add a dev debug shortcut for QA.

## Acceptance Criteria

- A new quest in `game/server/quests.js` uses `layoutProfile: 'spire-ascent'`
  (e.g. `spire_climb`) so `getLayoutProfileForQuest` and deploy load this layout
  in-game.
- `applyLayoutForQuest` / deploy places the squad on the **bottom** tier (`start`
  room); `assignRunSpawnPositions` sets `player.y` from `sampleFloorY` at spawn.
- **Enemy spawns** for `profile === 'spire-ascent'` (use `layout.rooms` `band`
  metadata):
  - At least **1** enemy on the bottom tier (`tier-0` / lowest `encounterTier`).
  - At least **1** enemy on a **middle** tier when `tierCount ≥ 3`.
  - At least **1** enemy on the **top** tier (`treasure` band neighbour or
    highest tier index).
  - **No** enemies on ramp rooms (`band === 'ramp'` / `role === 'connector'`).
  - Placement stays **seeded** (`mulberry32(layoutSeed + offset)`, not
    `Math.random()` for positions).
- **Objective / exit on final tier**: for `collect_items`, crystals spawn only on
  the top tier room; for `defeat_enemies`, the visible treasure marker (top
  `treasure` role from sub-ticket 01) marks the exit — nothing on the bottom
  tier alone satisfies the run.
- **Reachability**: unit test confirms spawn on bottom tier can reach top-tier
  treasure centre via walkable AABBs through ramps only (reuse helper from
  sub-ticket 01).
- **`DEBUG_SCENARIOS`**: add `spire-ascent` in `game/server/index.js` (same
  pattern as `sunken-canyon-stage`) that loads the spire quest, regenerates
  layout, spawns enemies, and re-seats the player on the bottom tier with
  correct `player.y`.
- Unit tests in `game/server/test/dungeon.test.js` or a dedicated
  `spire_ascent_spawn.test.js` cover per-tier spawn counts for a fixed seed.

## Technical Specs

- `game/server/quests.js`: add quest def (`layoutProfile: 'spire-ascent'`,
  `enemyCount` large enough to hit all tier bands, `objectiveType` as
  appropriate).
- `game/server/progression.js`:
  - Add `isSpireAscentLayout(layout)` (`layout.profile === 'spire-ascent'`).
  - Add `spireAscentRoomsByBand(layout, bandPrefix)` or filter `r.band`.
  - Extend `pickEnemySpawnPosition` / `spawnCombatEnemies`: round-robin or
    indexed slots force spawns onto bottom, middle, and top tier rooms before
    filling remaining count from all non-ramp tiers.
  - Extend `spawnCrystals` so spire-ascent objectives target only the top-tier
    (`treasure`) room.
- `game/server/index.js`: add `'spire-ascent'` / `'spire-ascent-stage'` to
  `DEBUG_SCENARIOS`; handler mirrors `sunken-canyon-stage` (select quest,
  `applyLayoutForQuest`, `spawnEnemies`, reset player to start tier +
  `sampleFloorY`).
- Tests: spawn-band assertions for `generateLayout(123, 'spire-ascent')` with
  `spawnCombatEnemies` or direct spawn-picker calls.

## Verification: code
