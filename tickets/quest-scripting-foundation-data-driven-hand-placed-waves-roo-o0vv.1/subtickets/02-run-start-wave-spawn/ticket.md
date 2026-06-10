# Run-start wave spawn engine

Introduce a quest-script runtime that initializes per-run wave state and spawns `trigger: 'run_start'` waves at hand-authored `(x, z)` positions via the existing `spawnEnemy(x, z, type)` path (same as `debugScenarios.js`), with no random pool draws.

## Acceptance Criteria

- Deploying a scripted `defeat_enemies` tier creates `run.waveScript` with one entry per wave (`id`, `trigger`, `status`: `pending` | `spawned` | `cleared`, `spawnedEnemyIds`).
- On run start, every `run_start` wave spawns exactly its `spawns` entries at the given coordinates and types; enemy count matches the script and positions match within floating-point tolerance.
- `spawnCombatEnemies` produces zero enemies for scripted tiers (no weighted pool spawns).
- Waves with other triggers (`enter_room`, `waveCleared`) remain `pending` and spawn nothing at deploy.
- Unit test deploys a two-wave fixture (one `run_start`, one `enter_room`) and asserts only the `run_start` enemies exist immediately after deploy.

## Technical Specs

- **`game/server/questScript.js`** (new): `initQuestScript(run, quest, layout)`, `fireRunStartWaves(gameState, ctx)`, `spawnWaveEntries(wave, ctx)` using `ctx.spawnEnemy(x, z, type, …)` with `roomTierAt` for tier tagging. Track spawned enemy ids on the wave entry.
- **`game/server/progression.js`**: After `createRunState()` in `startDungeonRun()`, call `initQuestScript` when `getQuestScript(quest)` is non-null, then fire run-start waves via `buildObjectiveSpawnCtx()`. Export `initQuestScript` / `fireRunStartWaves` for tests.
- **`game/server/objectives.js`**: Optionally add `spawnQuestEntities` no-op guard so scripted tiers do not double-spawn via other hooks.
- **`game/server/test/quest_script_run_start.test.js`** (new): Patch `QUEST_DEFS` fixture with `script.waves`; call `spawnEnemies()` + `startDungeonRun()`; assert enemy positions/types and `run.waveScript` statuses.

## Verification: code
