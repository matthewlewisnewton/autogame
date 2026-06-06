# 02 — Remove checkpoint suspend/resume; telepipe returns to hub

Delete the suspend/resume checkpoint machinery. When all players extract through the telepipe, return the squad to the hub lobby with a cleared dungeon world but **durable** player `hp` and `magicStones`. Redeploy always starts a fresh dungeon layout (no `restoreRunCheckpoint`).

## Acceptance Criteria

- `suspendedCheckpoint` is removed from lobby game state (`game/server/game-state.js`) and no longer appears in `stateSnapshot` / `hotStateSnapshot`.
- `captureRunCheckpoint`, `restoreRunCheckpoint`, `capturePlayerCombatState`, `buildSuspendedRunSummary`, and `abandonSuspendedRun` are removed (or reduced to no-ops with no callers).
- `suspendRunToLobby` / `maybeSuspendRun`: when the last active player extracts, set `gamePhase` to lobby, delete or end the run, call `resetTransientRunState()`, reposition players in the hub — **without** capturing or restoring a checkpoint and **without** resetting `hp` or `magicStones`.
- `checkAllReady` no longer branches on `suspendedCheckpoint`; deploy always takes the fresh-dungeon path (vitals preserved per sub-ticket 01).
- `resetTransientRunState()` continues to clear only world entities (`enemies`, `minions`, `loot`, `areaEffects`, `telepipe`) — never player vitals.
- `ABANDON_RUN` socket handler and `selectQuest` suspended-checkpoint guard in `lobbyHandlers.js` are removed or updated for the no-checkpoint model.
- Existing server tests that assert checkpoint capture/restore are updated to the new hub-return behavior (e.g. telepipe extract → lobby phase, no `suspendedCheckpoint`, redeploy spawns fresh `run.id` while `hp`/`magicStones` unchanged).

## Technical Specs

- **`game/server/progression.js`** — Remove checkpoint functions and `restoreRunCheckpoint` branch in `checkAllReadyInner`; refactor `suspendRunToLobby` to hub-return without snapshot; remove `abandonSuspendedRun`; strip `suspendedRunSummary` from `buildWorldSnapshot` / snapshots; update `clearSuspendedRunData` usages.
- **`game/server/game-state.js`** — Remove `suspendedCheckpoint` from `createLobbyGameState`.
- **`game/server/index.js`** — Drop exports/imports of removed checkpoint APIs.
- **`game/server/socketHandlers/runHandlers.js`** — Remove or repurpose `ABANDON_RUN` handler.
- **`game/server/socketHandlers/lobbyHandlers.js`** — Remove `state.suspendedCheckpoint` quest-change block.
- **`game/server/debugScenarios.js`** — Update any scenario that calls `suspendRunToLobby` expecting a checkpoint.
- **`game/server/test/server.test.js`**, **`game/server/test/integration.test.js`**, **`game/server/test/encounters.test.js`** — Update/remove checkpoint-specific tests.

## Verification: code
