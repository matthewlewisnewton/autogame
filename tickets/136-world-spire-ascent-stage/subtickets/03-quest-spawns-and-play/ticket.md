# Quest, spawns, and in-game wiring for Spire Ascent

Wire the spire-ascent stage into quest selection, distribute enemy spawns across
tiers (not concentrated on bottom or top only), place the objective on the final
tier, and add a dev debug shortcut for QA.

## Acceptance Criteria

- A new quest in `game/server/quests.js` uses `layoutProfile: 'spire-ascent'`
  (e.g. `spire_ascent`) so `getLayoutProfileForQuest` and deploy load this
  layout in-game.
- `applyLayoutForQuest` / deploy places the squad on **tier 0** (`start` room /
  `tierIndex === 0`); `assignRunSpawnPositions` sets `player.y` from
  `sampleFloorY` at spawn.
- **Enemy spawns** when `layout.profile === 'spire-ascent'`:
  - At least **1** enemy spawns on a **non-top** tier (`band === 'tier'` and
    `tierIndex < topIndex`).
  - At least **1** enemy spawns on a **non-bottom** tier (`tierIndex > 0`).
  - No enemies spawn on ramp rooms (`band === 'ramp'` / `role === 'connector'`).
  - Placement stays **seeded** (`mulberry32(layoutSeed + offset)`, not
    `Math.random()` for positions).
- **Objective on top tier**: for `collect_items`, crystals target the top tier
  (`treasure` / highest `tierIndex`) only; for `defeat_enemies`, the visible
  treasure marker (top-tier `treasure` role) marks the exit — nothing on tier 0.
- **Reachability**: unit test confirms a player at tier-0 spawn can reach the
  top-tier treasure room centre via walkable AABBs without leaving the layout
  (reuse reachability helper from sub-ticket 01).
- **`DEBUG_SCENARIOS`**: add `spire-ascent` in `game/server/index.js` (same
  pattern as `sunken-canyon-stage`) that loads the spire layout, spawns enemies,
  and re-seats the player on tier 0 with correct `player.y`.
- Unit tests in `game/server/test/dungeon.test.js` or a dedicated
  `spire_ascent_spawn.test.js` cover per-tier spawn distribution for a fixed
  seed.

## Technical Specs

- `game/server/quests.js`: add quest def (name, description, `enemyCount` ≥
  3 so distribution is testable, `layoutProfile: 'spire-ascent'`,
  `objectiveType` as appropriate).
- `game/server/progression.js`:
  - Add `isSpireAscentLayout(layout)` (`layout.profile === 'spire-ascent'`).
  - Add `spireAscentRoomsByTier(layout, tierIndex)` helper filtering
    `band === 'tier'`.
  - Extend `pickEnemySpawnPosition` / `spawnCombatEnemies`: when spire-ascent,
    spread spawns across tiers — e.g. first spawn on tier 0 or 1, middle spawns
    on interior tiers, at least one on the highest non-ramp tier below top, none
    on ramps; use seeded `randomPositionInRoom`.
  - Extend `spawnCrystals` so spire-ascent objectives target the top tier
    (`treasure` / max `tierIndex`) only.
- `game/server/index.js`: add `'spire-ascent'` to `DEBUG_SCENARIOS` with a
  handler mirroring `sunken-canyon-stage` (select quest or profile, regenerate
  layout, `spawnEnemies`, reset player to start tier + `sampleFloorY`, emit
  `questUpdate`).
- Tests: spawn tier assertions for `generateLayout(123, 'spire-ascent')` with
  `spawnCombatEnemies()` or direct `pickEnemySpawnPosition` calls; assert
  objective/crystal Z-X positions lie on the top-tier room bounds.

## Verification: code
