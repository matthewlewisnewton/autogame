# Thread explicit lobby state through run-teardown handlers

Migrate the "leave the run" handlers `returnPlayersToLobby`, `giveUpRun`, and
`abandonSuspendedRun` in `progression.js` so their own direct reads of the
module-level `_gameState` use an explicit `state` argument, and pass the lobby
state from their socket handlers. Behaviour must be identical.

## Acceptance Criteria

- `returnPlayersToLobby`, `giveUpRun`, and `abandonSuspendedRun` accept an
  explicit game-state argument and use it for **every direct `_gameState`
  reference in their own bodies** (the `requires lobby context` guards, the
  `_gameState.players` / `_gameState.run` / `_gameState.layout` /
  `_gameState.suspendedCheckpoint` reads, `setGamePhase(_gameState, …)`,
  `delete _gameState.run`, `sampleFloorY(_gameState.layout, …)`, etc.).
- The argument is a **trailing optional parameter defaulting to the module
  global** (e.g. `state = _gameState`), so existing callers and unit tests that
  call them with no argument keep working unchanged.
- The three socket handlers pass the explicit lobby `state` in scope:
  `returnToLobby` → `returnPlayersToLobby(state)`, `giveUp` → `giveUpRun(state)`,
  `abandonRun` → `abandonSuspendedRun(state)`.
- Sub-helpers invoked inside these functions (e.g. `clearSuspendedRunData`,
  `resetTransientRunState`, `refreshShopOffer`, `revivePlayerInLobby`,
  `firstRoomPosition`, `stateSnapshot`, `savePlayerData`, `getIoTarget`,
  `_broadcastLobbyUpdate`) may keep being called with no state arg — they still
  operate on the context-swapped global, so behaviour is unchanged. Only the
  direct `_gameState` references in the three target function bodies are
  rewritten to use the `state` parameter.
- `cd game && pnpm test:quick` passes; no behavioural diffs (especially the
  return-to-lobby, give-up, and abandon-suspended-run integration tests).

## Technical Specs

- `game/server/progression.js`:
  - `returnPlayersToLobby()` (~L2817): add trailing `state = _gameState`;
    rewrite the `if (!_gameState || !_gameState._lobbyId)` guard and all direct
    `_gameState` reads in the body to `state`.
  - `giveUpRun()` (~L2871): add trailing `state = _gameState`; rewrite the guard
    and all direct `_gameState` reads in the body to `state`.
  - `abandonSuspendedRun()` (~L2662): add trailing `state = _gameState`; rewrite
    `_gameState.suspendedCheckpoint`, `delete _gameState.run`,
    `setGamePhase(_gameState, …)`, the `_gameState.players` loop, and
    `sampleFloorY(_gameState.layout, …)` to use `state`.
- `game/server/index.js`:
  - `returnToLobby` handler (~L1372-1381): `returnPlayersToLobby(state)`.
  - `giveUp` handler (~L1385-1392): `giveUpRun(state)`.
  - `abandonRun` handler (~L1405-1411): `abandonSuspendedRun(state)`.
- Do NOT thread state through the called sub-helpers in this pass — that is
  deliberately deferred to keep the change focused and the diff reviewable.

## Verification: code
