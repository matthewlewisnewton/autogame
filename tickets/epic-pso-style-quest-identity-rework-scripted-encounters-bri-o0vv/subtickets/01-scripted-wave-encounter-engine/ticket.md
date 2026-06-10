# 01 — Scripted wave encounter engine

Add a reusable server-side wave system so quest tiers can declare hand-authored enemy groups per room instead of drawing all hostiles from the weighted `enemyPool` at deploy. Waves spawn at fixed offsets or landmarks, track living wave members on `run.scriptedEncounter`, and advance only when a wave is fully cleared.

## Acceptance Criteria

- New quest-tier field `scriptedEncounters` is parsed from `game/server/quests.js` and exposed on resolved quest objects (document the schema in a JSDoc typedef).
- Schema supports at least: `rooms[]` keyed by `roomIndex` or `landmark`, each with ordered `waves[]` containing `spawns[]` (`type`, optional `count`, optional `offset`/`anchor`).
- Deploying a quest with `scriptedEncounters` skips `spawnCombatEnemies` bulk placement (`skipBulkCombatSpawn` or equivalent hook) and seeds wave 0 of the start room only; later waves do not spawn until the prior wave in that room is defeated.
- `run.scriptedEncounter` tracks per-room `waveIndex`, spawned enemy ids, and `cleared` state; wave advance is deterministic for a given layout seed.
- Defeating all enemies tagged to the active wave increments progress and spawns the next wave in the same room; objective `defeatedEnemies` / `totalEnemies` stay in sync with scripted kills.
- Checkpoint capture/restore (`captureRunCheckpoint` / `restoreRunCheckpoint` in `game/server/progression.js`) preserves `run.scriptedEncounter` and re-links living wave enemy ids.
- `cd game && pnpm test:quick` passes, including new tests in `game/server/test/scripted_encounters.test.js` that deploy a fixture quest and assert wave sequencing without bulk spawns.

## Technical Specs

- **Add:** `game/server/scriptedEncounters.js` — `initScriptedEncounter(run, quest, layout)`, `tickScriptedEncounters(now, gameState, ctx)`, `onScriptedEnemyDefeated(run, enemyId, gameState)`, `isScriptedQuest(quest)`, `getScriptedEncounterDef(quest)`.
- **Edit:** `game/server/objectives.js` — extend `defeat_enemies` (or add `scripted_defeat` alias) with `skipBulkCombatSpawn` when `scriptedEncounters` is present; wire `onEnemyDefeated` to scripted wave handler; set `totalEnemies` from authored spawn counts.
- **Edit:** `game/server/progression.js` — call `initScriptedEncounter` during `startDungeonRun` / `spawnEnemies`; add `updateScriptedEncounters` to the game-loop tick beside `updateSurviveSpawns`; include scripted state in checkpoint payloads.
- **Edit:** `game/server/quests.js` — JSDoc `ScriptedEncounterConfig`; helper `getScriptedEncounterConfig(quest)`; optional debug-fixture tier used only by tests.
- **Edit:** `game/server/index.js` — export/register tick hook if needed for tests.
- **Add:** `game/server/test/scripted_encounters.test.js` — wave 0→1 sequencing, no bulk pool spawns, checkpoint round-trip.
- **Reuse:** `spawnEnemy(x, z, type)` from `progression.js`, `resolveStageBossSpawnPosition` / room landmark lookup patterns from `objectives.js`, positional spawn precedent in `debugScenarios.js`.

## Verification: code
