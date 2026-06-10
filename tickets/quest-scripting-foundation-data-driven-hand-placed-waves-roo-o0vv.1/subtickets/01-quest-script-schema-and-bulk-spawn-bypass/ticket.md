# Quest script schema and bulk-spawn bypass

Add optional `script.waves` metadata to quest tier definitions and wire the objective/spawn pipeline so scripted tiers skip weighted bulk combat spawning and derive `defeat_enemies` totals from authored spawn entries instead of `enemyCount`.

## Acceptance Criteria

- `getQuestScript(quest)` (or equivalent) returns normalized `script.waves` when present on a tier def, or `null` when absent.
- `countScriptedEnemies(script)` sums `spawns.length` across all waves for objective totals.
- `defeat_enemies.skipBulkCombatSpawn(quest)` returns `true` when the selected tier has `script.waves`; returns `false` otherwise (including all current production quests).
- `defeat_enemies.createObjective` sets `totalEnemies` from the script spawn count when a script is present, ignoring `quest.enemyCount`.
- Unit tests cover: script present vs absent, multi-wave spawn counting, and that an unscripted quest tier still uses `enemyCount`.

## Technical Specs

- **`game/server/quests.js`**: Extend tier typedef with optional `script: { waves: [...] }` shape (`id`, `room`, `trigger`, `spawns`). Add `getQuestScript(quest)` and `countScriptedEnemies(script)` helpers. Do not add `script` to any production quest yet.
- **`game/server/objectives.js`**: Update `defeat_enemies.skipBulkCombatSpawn(quest)` to consult `getQuestScript`. Update `createObjective` to call `countScriptedEnemies` when a script exists.
- **`game/server/test/quest_script_schema.test.js`** (new): Vitest fixture tier patched into `QUEST_DEFS` (mirror `stage_boss_objective.test.js` pattern); assert bypass and objective totals only — no spawning yet.

## Verification: code
