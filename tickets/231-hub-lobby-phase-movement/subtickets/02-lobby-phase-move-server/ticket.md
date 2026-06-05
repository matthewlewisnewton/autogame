# Accept and simulate lobby-phase movement (server)

Allow the existing `move` socket event and per-tick movement integration while
`gamePhase === 'lobby'`, using the same validation as in-run moves (finite payload,
monotonic sequence, magnitude clamp). Thread the lobby `state` explicitly through
`applyPlayerMovement` — do not introduce new bare `_gameState` reads in the changed
movement paths.

## Acceptance Criteria

- `socket.on('move')` accepts input when `isLobbyPhase(state)` (still rejects when the
  player is missing, dead, extracted, or disconnected).
- Validation parity with playing phase: reject non-object payloads, non-finite
  `dx`/`dz`/`rotation`, invalid or stale `sequence`, and normalize vectors with
  magnitude > 1.
- `applyPlayerMovement(state = _gameState)` uses the `state` parameter for every
  direct `_gameState` reference in its body (`players`, `layout`, phase guard).
- Phase guard allows lobby **or** playing: skip only when neither phase applies.
- Lobby-phase movement uses hub wall colliders / `walkableAABBs` / `dungeonBounds`
  already on `state` (from sub-ticket 01) — positions stay inside hub geometry.
- `runGameLoopTick` calls `applyPlayerMovement(state)` during lobby phase (before or
  alongside the playing-phase block) and runs `flushDirtyPlayerSaves()` for lobby ticks.
- Playing-phase combat/enemy/minion updates remain gated on `isPlayingPhase(state)`.
- New tests in `game/server/test/lobbyPhaseMovement.test.js` (or `integration.test.js`):
  - lobby-phase `move` updates player position after a tick;
  - invalid payload / stale sequence rejected in lobby;
  - attempted move toward hub exterior leaves player inside `walkableAABBs`.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/server/simulation.js`:
  - Change signature to `applyPlayerMovement(state = _gameState)`.
  - Replace `if (!_gameState || !isPlayingPhase(_gameState)) return` with a guard on
    the `state` argument allowing `isLobbyPhase(state) || isPlayingPhase(state)`.
  - Rewrite body reads (`_gameState.players`, `_gameState.layout`, etc.) to `state.*`.
  - Import `isLobbyPhase` from `./lobbies.js` alongside `isPlayingPhase`.
- `game/server/index.js`:
  - `move` handler (~L1297): remove `if (!isPlayingPhase(state)) return`; keep
    per-player guards; optionally split `if (!isLobbyPhase(state) && !isPlayingPhase(state)) return`.
  - `runGameLoopTick` (~L1072): add lobby branch that calls
    `applyPlayerMovement(state)` and `flushDirtyPlayerSaves()`.
- `game/server/test/lobbyPhaseMovement.test.js`:
  - Use existing test helpers (`createLobby`, `connectClient`, `withLobbyContext`,
    `testGameState`, `sleep`) to stay in lobby without debug deploy.
  - Assert hub-bounds using `computeWalkableAABBs` / `isInsideDungeon` on hub layout.

## Verification: code
