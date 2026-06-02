# Server: Sunken Canyon spawns and objectives

Distribute enemy spawns across the two elevation bands (≥ 1 on the plateau, majority
in the canyon) and ensure run objectives / exit placement target the canyon floor,
reachable on foot from the plateau via the ramps.

## Acceptance Criteria

- `firstRoomPosition()` (or sunken-canyon-specific spawn helper) places players on
  the **plateau** band, clear of walls and ramp lips.
- When deploying quest `sunken_canyon`, `spawnCombatEnemies` places:
  - **≥ 1** enemy with position sampled inside the plateau room (`band: 'plateau'`),
  - **Strict majority** of enemies inside the canyon room (`band: 'canyon'`),
  - **0** enemies on ramp rooms (`band: 'ramp'`).
- For `defeat_enemies` / `collect_items` objectives, the objective anchor (crystal
  cluster or implicit “deepest” goal) lies on the **canyon floor**, not on the
  plateau — reuse treasure-room placement (`role: 'treasure'` on canyon) or an
  explicit `randomRoomPositionByRole(layout, 'treasure', rng)` override for this
  profile.
- Walking from plateau spawn to the objective location via ramps only (no teleport)
  is possible — covered by layout BFS in sub-ticket 01; add a spawn test that
  objective position has finite BFS distance from plateau spawn.
- Dev scenario `sunken-canyon-stage` calls `spawnEnemies()` so band distribution is
  observable in-game without a full squad deploy.
- Unit tests: given a fixed seed, count enemies by `band` at spawn time; assert
  plateau ≥ 1, canyon > total/2, ramps === 0; assert objective/crystal coords fall
  inside canyon AABB.

## Technical Specs

- `game/server/progression.js`:
  - Add `isSunkenCanyonLayout(layout)` (`layout.profile === 'sunken-canyon'`).
  - Branch `spawnCombatEnemies` (or `pickEnemySpawnPosition`) to use
    `layout.stageMeta` / `room.band` for band-aware placement with seeded RNG.
  - Keep default spawn behavior unchanged for other profiles.
- `game/server/dungeon.js` — export `roomsByBand(layout, band)` if helpful.
- `game/server/simulation.js` / crystal spawn helpers — ensure collect-item quests
  on this profile target the treasure/canyon room (not plateau).
- `game/server/index.js` — extend `sunken-canyon-stage` handler to invoke
  `spawnEnemies()` after layout apply (mirror `open-plaza-arena`).
- Tests: `game/server/test/dungeon.test.js` or a focused
  `game/server/test/sunken_canyon_spawn.test.js` importing `spawnCombatEnemies`
  with a mock game state.

## Verification: code
