# 08 — Fix arena-trials-tier-2 run snapshot in stateUpdate

Round-1 review reported `debug-scenarios.test.js` failing because the `arena-trials-tier-2` debug scenario emits a `stateUpdate` whose `run` is missing/undefined, so `stateUpdate.run.questId` throws. The scenario must finish with a populated `run` matching arena_trials Tier 2 stage-boss deploy semantics before the final `STATE_UPDATE`.

## Acceptance Criteria

- `cd game && pnpm exec vitest run server/test/debug-scenarios.test.js -t "deploys arena_trials Tier 2 stage-boss run"` exits `0`.
- After `debugScenario` `{ name: 'arena-trials-tier-2' }`, the awaited `stateUpdate` includes `run` with:
  - `questId === 'arena_trials'`
  - `questTier === 2`
  - `questName` matching `getQuest('arena_trials', 2).name`
  - `objective.type === 'stage_boss'` and a truthy `encounter.bossEnemyId`
- `stateUpdate.enemies` length is `1 + addCount` for Tier 2; at least one enemy id matches `run.encounter.bossEnemyId`; every enemy has a defined `variant`.
- Lobby `state` mirrors playing deploy: `gamePhase === 'playing'`, `selectedQuestId === 'arena_trials'`, `selectedQuestTier === 2`, rigid open-plaza layout seed from `questLayoutSeed('arena_trials', 2)`.
- `cd game && pnpm test:quick` still passes.

## Technical Specs

- **Edit:** `game/server/debugScenarios.js` — `arena-trials-tier-2` branch (~lines 555–605): after `enterPlayingPhase`, do not leave `state.run` deleted when emitting the final snapshot. Either remove the redundant `delete state.run` before `startDungeonRun()`, or guarantee `startDungeonRun()` (from `progression.js`) assigns `state.run = createRunState()` with arena_trials Tier 2 quest/encounter before `io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot())`.
- **Edit (if context drift):** `game/server/index.js` — ensure `withLobbyContext` wraps the scenario so `progression` `_gameState` and `lobby.state` stay aligned when `startDungeonRun` / `stateSnapshot` run; avoid emitting an intermediate `stateUpdate` without `run` that races the test's first `waitForEvent('stateUpdate')` (emit order: populate `run`, then final `STATE_UPDATE`).
- **Reuse:** `setupArenaTrialsTier2StageBossDebug` pattern (lines 128–161), `createRunState`, `spawnEnemies`, `emitLobbyQuestUpdate`, `stateSnapshot` from `progression.js`.
- **Do not change:** `game/server/test/debug-scenarios.test.js` unless the test's first-`stateUpdate` contract is wrong.
- **Scope:** debug scenario deploy path only; no gameplay balance changes.

## Verification: code
