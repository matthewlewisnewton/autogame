# Reset to Lobby When Last Player Disconnects

Add a zero-player guard in the disconnect handler (`game/server/index.js`). After removing the disconnected player and their minions, if `Object.keys(gameState.players).length === 0`, call `returnPlayersToLobby()` to reset `gamePhase` to `'lobby'` and clear all transient run state (enemies, loot, run object).

This applies regardless of whether the run was actively playing or already terminal — if nobody is left to view the results, the session should reset.

## Acceptance Criteria

- After the last player disconnects during an active run (`gamePhase === 'playing'`), `gameState.gamePhase` is `'lobby'`.
- `gameState.run` is deleted (or undefined) after the last player disconnects.
- `gameState.enemies`, `gameState.minions`, and `gameState.loot` are all empty arrays after the last player disconnects.
- The existing `broadcastLobbyUpdate()` path for lobby-phase disconnects is untouched (no regression).
- When at least one player remains connected, the disconnect handler does **not** reset the run.

## Technical Specs

- **File:** `game/server/index.js`
- Inside the `socket.on('disconnect', ...)` callback, after `delete gameState.players[socket.id]` and the minion filter, insert a check:
  - If `Object.keys(gameState.players).length === 0`, call `returnPlayersToLobby()`.
  - This check should replace (or sit alongside) the existing `if (gameState.gamePhase === 'playing') { checkRunTerminalState(); }` — when zero players remain, `checkRunTerminalState()` can never satisfy its conditions, so short-circuit to `returnPlayersToLobby()` instead.
- Do **not** change `returnPlayersToLobby()` itself — it already does the right thing (clears enemies/minions/loot, resets phase, deletes run, broadcasts state).
- Keep the existing `if (gameState.gamePhase === 'lobby') { broadcastLobbyUpdate(); }` branch for the lobby-phase disconnect path.

## Verification: code
