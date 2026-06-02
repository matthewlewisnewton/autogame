# Spawns, enemies, and objective placement

Wire sunken-canyon room roles and spawn logic so players start on the plateau, most enemies fight in the canyon, at least one threat remains on the plateau, and the run objective sits on the canyon floor reachable only via ramps.

## Acceptance Criteria

- Plateau room has `role: "start"`; treasure/objective room has `role: "treasure"` on the canyon floor (not on the plateau or a ramp).
- Party spawn positions (run start / deploy) land on the plateau floor using `sampleFloorY`, not inside cover or ramp lip.
- Initial enemy spawn pass places ≥ 1 enemy on the plateau band and strictly more than half of quest `enemyCount` in canyon-band rooms when `layout.stage === "sunken-canyon"`.
- Objective markers / exit interaction for defeat-enemies and collect-items quests resolve to a canyon-floor position reachable on foot from plateau spawn through the ramp graph (reuse reachability test pattern).
- A dev/test hook or quest override can select sunken-canyon for manual QA (e.g. `applyLayoutForQuest` passes `stage: "sunken-canyon"` for a named test quest, or `generateLayout` is invoked directly in tests).
- Unit tests cover spawn band, enemy counts by band, and treasure room placement.

## Technical Specs

- **`game/server/dungeon.js`**: sunken-canyon-specific `assignSunkenCanyonRoles(layout)` (or extend `assignRoomRoles`) setting start/treasure/combat roles from `elevationBand` tags.
- **`game/server/progression.js`**: branch in `pickEnemySpawnPosition` / `spawnCombatEnemies` when `layout.stage === "sunken-canyon"` to weight `elevationBand === "canyon"` vs `"plateau"`; ensure plateau gets ≥ 1 spawn in the initial wave.
- **`game/server/index.js`**: optional `applyLayoutForQuest` branch or test-only quest def in **`game/server/quests.js`** with `layoutStage: "sunken-canyon"` plumbed into `generateLayout` options.
- **`game/server/test/dungeon.test.js`** and/or **`game/server/test/server.test.js`**: spawn/enemy distribution tests with a fixed seed.

## Verification: code
