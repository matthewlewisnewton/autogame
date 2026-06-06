# Quest tier-1 and debug scenario for fire-cavern

Wire the `fire-cavern` stage into quest selection (tier-1 only) and add debug
shortcuts so QA can deploy straight into the level. Fire-specific enemy types and
band-aware spawn placement are **out of scope** (ticket 296) — use a generic
enemy pool and default `pickEnemySpawnPosition` until 296 lands.

## Acceptance Criteria

- A new quest `ember_descent` in `game/server/quests.js` has tier-1 with
  `layoutProfile: 'fire-cavern'`, `objectiveType: 'defeat_enemies'`, and a
  generic `enemyPool` (e.g. `grunt` / `skirmisher` only — no fire-exclusive types
  yet).
- `getLayoutProfileForQuest('ember_descent')` and
  `getLayoutProfileForQuest('ember_descent', 1)` return `'fire-cavern'`.
- `getQuest('ember_descent', 1).layoutProfile` is `'fire-cavern'`.
- Deploy with `ember_descent` tier-1 calls `generateLayout(seed, 'fire-cavern')`
  via `applyLayoutForQuest` / `getLayoutGenerationOptions` (slopes enabled,
  `layoutMode: 'default'`).
- Deploy places the squad on the **rim** (`role: 'start'`); `player.y` is set
  from `sampleFloorY` at spawn.
- **`DEBUG_SCENARIOS`** (in `game/server/index.js` + handler in
  `game/server/debugScenarios.js`):
  - `fire-cavern-stage` — layout only, seats player on rim with correct
    `player.y` (mirror `sunken-canyon-stage`).
  - `fire-cavern` — selects `ember_descent`, regenerates layout, spawns enemies
    via default pool, seats player on rim (mirror `sunken-canyon`).
- Both scenarios are registered in the `DEBUG_SCENARIOS` set and covered by
  `game/server/test/debug-scenarios.test.js`.
- `listQuestVariants()` / quest catalog tests include `ember_descent` tier-1;
  update `game/server/test/server.test.js` and
  `game/server/test/integration.test.js` quest-id enumerations.
- `game/server/test/quests.test.js` asserts layout profile and generation options
  for `ember_descent` tier-1.

## Technical Specs

- `game/server/quests.js`:
  - Add `ember_descent` quest def (`name`, `description`, `enemyCount`,
    `rewardCurrency`, `layoutProfile: 'fire-cavern'`, tier-1 only for now).
  - No tier-2 entry in this ticket.
- `game/server/index.js`:
  - Add `'fire-cavern'` and `'fire-cavern-stage'` to `DEBUG_SCENARIOS` set.
- `game/server/debugScenarios.js`:
  - Handler branches for `fire-cavern-stage` and `fire-cavern` mirroring
    `sunken-canyon-stage` / `sunken-canyon` (HP/MS refill, layout seed,
    `applyLayoutForQuest` for full deploy, `spawnEnemies`, rim spawn +
    `resolveFloorY(sampleFloorY(...))`, `emitLobbyQuestUpdate`).
- `game/server/progression.js`: **no fire-specific spawn helpers** in this
  ticket — default combat-room / non-start-room placement is sufficient for
  tier-1 QA.
- Tests:
  - Extend `game/server/test/debug-scenarios.test.js` with fire-cavern scenario
    cases (layout profile, rim spawn Y aligned with `sampleFloorY`).
  - Extend `game/server/test/quests.test.js`.
  - Update quest enumeration tests in `server.test.js` and `integration.test.js`.

## Verification: code
