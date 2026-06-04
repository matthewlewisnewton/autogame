# 03 — Quest spawn and tick behavior via registry

Route dungeon spawn decisions that today key off `quest.objectiveType` / `objective.type` through the objective registry so survive staggered spawning and collect-item crystal placement are encapsulated per objective type.

## Acceptance Criteria

- Registry entries expose spawn/tick hooks that subsume current behavior (suggested: `skipBulkCombatSpawn(quest)`, `preferNearestEnemySpawns(quest)`, `spawnQuestEntities(layout, rng, quest, gameState)`, `tickSpawns(now, gameState)` — survive implements tick spawns; defeat/collect use no-ops where appropriate).
- `spawnCombatEnemies`, `spawnEnemies`, and `updateSurviveSpawns` in `progression.js` call registry hooks instead of `quest.objectiveType === 'survive'|'collect_items'` (L2754–2758, L2889–2894, L2796–2797).
- Survive runs still skip up-front bulk combat spawn, still stagger spawns with `SURVIVE_SPAWN_INTERVAL_MS`, still honor `minibossCount` on final spawns, and still initialize `lastSpawnAt` only when spawning (defensive `Number.isFinite` reads remain inside the survive entry, not in generic callers).
- Collect-items runs still spawn crystals via `spawnCrystals` and still prefer nearest enemy spawns for the first two enemies.
- `pnpm test:quick` passes, including `updateSurviveSpawns()` and crystal-rescue integration expectations in `game/server/test/server.test.js` and `game/server/test/integration.test.js`.

## Technical Specs

- **Change** `game/server/objectives.js` — spawn/tick hooks; survive entry may import or receive helpers from `progression.js` (e.g. `spawnEnemy`, `pickEnemySpawnPosition`) via dependency injection or shared imports to avoid duplication.
- **Change** `game/server/progression.js` — `spawnCombatEnemies` (L2750+), `spawnEnemies` (L2883+), `updateSurviveSpawns` (L2792+); keep `SURVIVE_SPAWN_INTERVAL_MS` / `SURVIVE_REGULAR_TYPES` colocated with survive logic (objectives module or progression, but only referenced from survive registry entry).
- No client changes required for this sub-ticket.

## Verification: code
