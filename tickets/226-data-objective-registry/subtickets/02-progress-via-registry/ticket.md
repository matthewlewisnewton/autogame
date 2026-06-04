# 02 — Objective progress hooks via registry

Move run-progress mutations that currently branch on `objective.type` into the objective registry so defeat/collect/survive progress is owned per type, not scattered `if` checks in `progression.js`.

## Acceptance Criteria

- Each `OBJECTIVE_DEFS` entry gains the hooks needed to replace today’s progress logic (suggested names: `clampProgress(run)`, `onEnemyDefeated(run, count)`, `onCrystalCollected(run, count)`, `syncToEnemyCount(run, enemyCount)` — exact names are implementer’s choice but behavior must match).
- `clampObjectiveProgress`, `recordEnemyDefeated`, `recordCrystalCollected`, and `syncRunObjectiveToEnemies` in `progression.js` delegate to `getObjectiveDef(...)` instead of comparing `objective.type` inline.
- Defeat-enemies still syncs `totalEnemies` from live enemy count; collect-items still clamps `collectedItems`; survive still increments `defeatedEnemies` and ignores collect progress; cross-type calls remain no-ops (e.g. `recordEnemyDefeated` on collect_items does not add `defeatedEnemies`).
- `pnpm test:quick` passes, including `recordEnemyDefeated`, `recordCrystalCollected`, clamping, and survive-completion tests in `game/server/test/server.test.js`.

## Technical Specs

- **Change** `game/server/objectives.js` — add per-type progress hooks; default/no-op implementations where a type does not use a hook.
- **Change** `game/server/progression.js` — thin wrappers at L1486–1512 (`clampObjectiveProgress`, `syncRunObjectiveToEnemies`, `recordEnemyDefeated`, `recordCrystalCollected`) that dispatch through the registry.
- Leave spawn pipeline (`spawnCombatEnemies`, `updateSurviveSpawns`, `spawnEnemies`) on `quest.objectiveType` checks until sub-ticket 03.

## Verification: code
