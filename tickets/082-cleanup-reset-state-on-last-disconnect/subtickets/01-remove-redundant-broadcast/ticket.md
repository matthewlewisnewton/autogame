# Remove redundant broadcastLobbyUpdate in disconnect handler

When the last player disconnects, `returnPlayersToLobby()` already calls `broadcastLobbyUpdate()` internally. The trailing `if (gameState.gamePhase === 'lobby') broadcastLobbyUpdate();` fires a second redundant broadcast because `returnPlayersToLobby()` sets `gamePhase` to `'lobby'`. Remove the redundant call.

## Acceptance Criteria
- The disconnect handler in `game/server/index.js` invokes `broadcastLobbyUpdate()` at most once per disconnect event — either via `returnPlayersToLobby()` or via the lobby-phase fallback, but never both.
- The lobby-phase fallback `broadcastLobbyUpdate()` is preserved for the case when a non-last player disconnects during lobby phase.
- All existing integration tests pass.

## Technical Specs
- **File:** `game/server/index.js` — `socket.on('disconnect', ...)` handler (~line 1425)
- Remove the trailing `if (gameState.gamePhase === 'lobby') broadcastLobbyUpdate();` entirely.
  - When the last player disconnects, `returnPlayersToLobby()` sets `gamePhase` to `'lobby'` and already calls `broadcastLobbyUpdate()` internally — the trailing guard would fire a duplicate.
  - When a non-last player disconnects during `playing`, `checkRunTerminalState()` does NOT change `gamePhase` to `'lobby'`, so the trailing guard never fires in that branch.
  - When a non-last player disconnects during `lobby`, no broadcast is needed (the remaining players already have the correct state).
- After the fix, the disconnect handler should contain only the `if / else if` block with no trailing broadcast.

## Verification: code
