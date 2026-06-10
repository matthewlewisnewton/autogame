# Extract run lifecycle and remove module-global _gameState

Move the remaining run/dungeon domain (run state, objectives, rewards, enemy spawn and drops, telepipe suspend/resume, snapshots, deploy readiness) into `runLifecycle.js`, then delete the swappable `_gameState` pattern from `progression.js` and stop swapping progression state in `withLobbyContext`.

## Acceptance Criteria

- New file `game/server/progression/runLifecycle.js` owns run/dungeon functions still in `progression.js`, including at minimum: `createRunState`, `startDungeonRun`, `applyTelepipeReadyHand`, spawn helpers (`spawnEnemy`, `removeDeadEnemies`, `cleanupAfterDamage`, `spawnLoot`, `spawnCrystals`, `spawnEnemies`, `spawnCombatEnemies`, `updateSurviveSpawns`, `updateEncounterTriggers`), objective/reward helpers (`clampObjectiveProgress`, `syncRunObjectiveToEnemies`, `recordEnemyDefeated`, `recordCrystalCollected`, `isRunObjectiveComplete`, `buildRunSummary`, `grantRunRewards`, `buildPlayerRewardSummary`, `previewReturnRewards`, enemy drop helpers), checkpoint/telepipe (`captureCardCheckpoint`, `restoreCardCheckpoint`, `suspendRunToLobby`, `abandonSuspendedRun`, `maybeSuspendRun`, `tryEnterTelepipe`, `checkTelepipeProximity`), terminal/deploy (`checkRunTerminalState`, `resetTransientRunState`, `returnPlayersToLobby`, `giveUpRun`, `checkAllReady`, `assignRunSpawnPositions`, `isPlayerActive`, `hasActivePlayers`), and snapshots (`stateSnapshot`, `hotStateSnapshot`, `buildWorldSnapshot`).
- Every run-lifecycle function that reads lobby data takes `state` as the **first** argument; `runLifecycle.js` has **no** module-level `_gameState`.
- `game/server/progression.js` no longer declares `let _gameState`, `setGameState`, `getGameState`, or `initProgression` state swapping; it becomes a thin barrel re-exporting `./progression/*` modules (persistence, inventory, economy, trades, hand, runLifecycle).
- `game/server/index.js` `withLobbyContext` stops calling `setProgressionGameState`; all progression entry points invoked from index, simulation callbacks, and socket handlers receive `lobby.state` (or `gameState`) explicitly.
- Tests that called `progression.setGameState(state)` are updated to pass `state` into the functions under test instead (or use a small test helper), matching the new explicit-state API.
- `pnpm test:quick` from `game/` passes — full parent-ticket acceptance: no `_gameState` in `progression.js`, state is explicit, modules are split, all tests green.

## Technical Specs

- **Create** `game/server/progression/runLifecycle.js` — move remaining ~1.5k lines of run/spawn/snapshot logic from `progression.js`; factor shared io helpers (`getIoTarget`, `emitLobbyDeploy`, deck-update emits) into `game/server/progression/io.js` or keep minimal callback wiring on a `setProgressionCallbacks({ getIo, broadcastLobbyUpdate, rebuildWallColliders })` initializer that stores **no** game state.
- **Edit** `game/server/progression.js` — delete all moved implementations and the `_gameState` global; re-export submodules; remove `setGameState`/`getGameState` from `module.exports`.
- **Edit** `game/server/index.js` — remove `setProgressionGameState` from `withLobbyContext` and startup; thread `state` through tick handlers (`processPassiveDraws`, `checkRunTerminalState`, `updateEncounterTriggers`, `checkTelepipeProximity`, etc.) and `setSavePlayerCallback` / terminal-check callbacks.
- **Edit** `game/server/simulation.js` callbacks if any still assume progression global state.
- **Edit** `game/server/socketHandlers/*.js` — ensure every progression import passes `lobby.state`.
- **Edit** `game/server/test/**/*.test.js` — replace `progression.setGameState(state)` patterns with explicit `state` arguments on the functions each test exercises.
- Preserve existing socket event payloads and run/checkpoint behavior; this sub-ticket is structural only.

## Verification: code
