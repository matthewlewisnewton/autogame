# 07 — Scripted telepipe active-enemy-count contract

Multi-wave scripted quests (e.g. Initiate Vault) keep `objective.totalEnemies` at the full authored count for HUD progress, but the telepipe suspend/resume capture compares that total to the live pre-suspend enemy list and fails. Add a separate active/live enemy count on the objective, preserve it through checkpoint capture, and align the harness preservation probe with the new field.

## Acceptance Criteria

- For scripted `defeat_enemies` quests, `run.objective.totalEnemies` remains the full authored scripted total (e.g. 6 for `training_caverns` tier 1) while a new `run.objective.activeEnemyCount` (or equivalent) tracks the current live non-spawner enemy count (e.g. 2 mid-wave).
- `activeEnemyCount` updates when scripted waves spawn or enemies are defeated, and is persisted in `captureRunCheckpoint` / `suspendedRunSummary.objective`.
- After telepipe suspend → resume on a gated `training_caverns` tier 1 run, resumed live enemies match the pre-suspend baseline and `activeEnemyCount` matches the stashed pre-suspend live count; `totalEnemies` stays at the authored total.
- `harness/screenshot.mjs` `assertRunPreserved` compares `activeEnemyCount` (when present) to `originalPreSuspendEnemies.length` instead of `totalEnemies`, so the telepipe capture reports `metrics.json` `"ok": true`.
- `cd game && pnpm test:quick` passes, including telepipe suspend/resume coverage for scripted multi-wave quests.

## Technical Specs

- **Edit:** `game/server/objectives.js` — in `defeat_enemies.createObjective` for scripted quests, set `totalEnemies` from `countAuthoredScriptedEnemies` and initialize `activeEnemyCount` from the live enemy list; extend `onEnemyDefeated` / add a sync helper so `activeEnemyCount` tracks non-`spawnedBy` enemies without overwriting `totalEnemies`.
- **Edit:** `game/server/scriptedEncounters.js` — after wave spawn / `removeDeadEnemies` wave advance, refresh `run.objective.activeEnemyCount` from `gameState.enemies`.
- **Edit:** `game/server/progression.js` — ensure `captureRunCheckpoint`, `buildSuspendedRunSummary`, and `restoreRunCheckpoint` clone `activeEnemyCount`; avoid `syncRunObjectiveToEnemies` clobbering authored `totalEnemies` on scripted runs.
- **Edit:** `game/client/main.js` — include `activeEnemyCount` on `suspendedRunSummary.objective` and harness probe `harnessState` so stash/assert steps can read it.
- **Edit:** `harness/screenshot.mjs` — in `assertRunPreserved`, prefer `objective.activeEnemyCount` over `objective.totalEnemies` when comparing to `originalPreSuspendEnemies.length`.
- **Add/extend tests:** `game/server/test/server.test.js` or `game/server/test/passage_locks.test.js` telepipe suspend/resume case with multi-wave scripted objective totals vs live counts.

## Verification: code
