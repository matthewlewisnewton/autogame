# Run Summary and Return to Lobby Tests

Add unit and integration tests covering terminal state detection, terminal event emission, return-to-lobby reset, and the ability to start a second run.

## Acceptance Criteria
- Unit test: `checkRunTerminalState()` sets `run.status = 'victory'` and emits `runComplete` when objective `defeatedEnemies` reaches `totalEnemies`
- Unit test: `checkRunTerminalState()` sets `run.status = 'failed'` and emits `runFailed` when all players are dead
- Unit test: `buildRunSummary()` returns an object with `runId`, `status`, `durationMs`, `objective`, `players`, `defeatedEnemies`, `currencyCollected`
- Unit test: terminal event is emitted only once (idempotency — calling `checkRunTerminalState()` twice does not emit a second event)
- Integration test: `runComplete` is emitted after the last enemy is defeated via a weapon card
- Integration test: `runFailed` is emitted when all connected players are dead during a run
- Integration test: `returnToLobby` resets `gamePhase` to `'lobby'`, clears `gameState.run`, empties enemies/minions/loot, and sets all players to `ready: false`
- Integration test: after returning to lobby, players can ready up and start a second run (new `gameState.run` with fresh objective)

## Technical Specs
- **File**: `game/server/test/server.test.js` — add unit tests for `checkRunTerminalState`, `buildRunSummary`, `resetTransientRunState`, `returnPlayersToLobby`
  - Use existing exported helpers: `createGameState`, `resetGameState`, `createRunState`, `startDungeonRun`, `gameState`
  - Mock/spy on `io.emit` to verify terminal events are emitted with correct payload structure
- **File**: `game/server/test/integration.test.js` — add integration tests using `startServer()` with real Socket.IO client connections
  - Follow existing integration test patterns (socket.connect, emit useCard, wait for stateUpdate, socket.disconnect)
  - For the second-run test: ready up → startGame → defeat enemies → returnToLobby → ready up again → verify new `startGame` and new run object

## Verification: code
