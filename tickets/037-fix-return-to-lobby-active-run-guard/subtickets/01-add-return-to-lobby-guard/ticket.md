# Add Guard to returnToLobby Handler

Add a guard in the `returnToLobby` socket handler in `game/server/index.js` that rejects the request while the current run is still active (`gameState.run.status === 'playing'`). Only allow `returnToLobby` when the run has reached a terminal state (`'victory'` or `'failed'`).

## Acceptance Criteria

- The `returnToLobby` handler checks `gameState.run.status` before calling `returnPlayersToLobby()`.
- If `gameState.run` exists and `status === 'playing'`, the handler returns early without mutating `gameState`.
- If the run is terminal (`'victory'` or `'failed'`), the handler proceeds normally to call `returnPlayersToLobby()`.
- If there is no active run (lobby phase), the handler is a no-op or proceeds harmlessly.
- An optional `runError` (or similar) event is emitted to the requesting socket when rejected — not broadcast to other players.

## Technical Specs

- **File**: `game/server/index.js`
- Modify the `socket.on('returnToLobby', ...)` handler (around line 1123).
- Add a guard: check `gameState.run` and `gameState.run.status`. Only call `returnPlayersToLobby()` when `!gameState.run || gameState.run.status !== 'playing'`.
- When rejecting, emit a client-specific error: `socket.emit('runError', { reason: 'Run still in progress' })`.

## Verification: code
