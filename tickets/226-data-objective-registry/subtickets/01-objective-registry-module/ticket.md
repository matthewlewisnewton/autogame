# 01 — Objective registry module and run creation

Introduce `game/server/objectives.js` with an `OBJECTIVE_DEFS` registry (same pattern as `QUEST_DEFS` in `quests.js`). Each entry is keyed by `objectiveType` and exposes `createObjective(quest, ctx)` plus `isComplete(objective)`. Refactor `createRunState` and `isRunObjectiveComplete` in `progression.js` to delegate to the registry so the three existing objective shapes are no longer built or completed via inline `if (quest.objectiveType === …)` chains.

## Acceptance Criteria

- `game/server/objectives.js` exports `OBJECTIVE_DEFS`, `getObjectiveDef(objectiveType)`, and `isValidObjectiveType(type)`.
- Registry entries exist for `defeat_enemies`, `collect_items`, and `survive`, each implementing `createObjective` and `isComplete` with the same fields and defaults as today (including survive’s `spawnedEnemies`, `lastSpawnAt`, `minibossCount`, `totalEnemies` mirror, and collect’s label text).
- `createRunState()` in `progression.js` looks up `quest.objectiveType` via `getObjectiveDef` and assigns `objective: def.createObjective(quest, { enemyCount: _gameState.enemies.length })` (or equivalent context) instead of three separate literal branches.
- `isRunObjectiveComplete(objective)` delegates to `getObjectiveDef(objective.type).isComplete(objective)` (with a safe fallback or throw for unknown types).
- `pnpm test:quick` passes; existing `createRunState()` and survive-completion tests in `game/server/test/server.test.js` are unchanged in behavior.

## Technical Specs

- **Add** `game/server/objectives.js` — `OBJECTIVE_DEFS` map; mirror structure/comments from `game/server/quests.js`.
- **Change** `game/server/progression.js` — import registry helpers; replace `createRunState` body (L1191–1253) and `isRunObjectiveComplete` (L1514–1522) with registry calls; re-export `isRunObjectiveComplete` unchanged for tests/index.
- **Change** `game/server/index.js` only if a new export is required for tests (prefer keeping registry internal to progression unless tests need direct access).
- Do **not** yet refactor `clampObjectiveProgress`, `recordEnemyDefeated`, `recordCrystalCollected`, or spawn helpers — those stay on type checks until sub-ticket 02/03.

## Verification: code
