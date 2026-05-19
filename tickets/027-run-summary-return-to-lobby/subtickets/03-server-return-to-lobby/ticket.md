# Server Return to Lobby Handler

Handle the `returnToLobby` client event: reset all transient run state, restore players to the lobby, and allow a second run to start without page refresh.

## Acceptance Criteria
- The server listens for `returnToLobby` socket events
- On receiving `returnToLobby`, the server:
  - Sets `gameState.gamePhase` back to `'lobby'`
  - Clears `gameState.run` (sets to `null` or deletes)
  - Clears all enemies from `gameState.enemies`
  - Clears all minions from `gameState.minions`
  - Clears all loot from `gameState.loot`
  - Sets all connected players to `ready: false`
  - Respawns all players (living or dead) at the first room spawn position
  - Restores all player HP to 100 and sets `dead: false`
  - Preserves each player's `currency` and `inventory` fields
- After resetting, the server emits `stateUpdate` to all connected clients
- After resetting, the server calls `broadcastLobbyUpdate()` so the lobby UI reflects the reset state
- The lobby UI is shown again on the client after the server confirms the return (via `stateUpdate` with `gamePhase === 'lobby'`)
- A second run can start: players can ready up, the server transitions to `playing`, and a new run object is created — all without page refresh

## Technical Specs
- **File**: `game/server/index.js`
- Add `resetTransientRunState()` — clears `gameState.enemies`, `gameState.minions`, `gameState.loot`; does NOT regenerate dungeon layout (layout is session-level)
- Add `returnPlayersToLobby()` — calls `resetTransientRunState()`, sets `gameState.gamePhase = 'lobby'`, deletes `gameState.run`, iterates all players to reset position/HP/readiness, then emits `stateUpdate` and `broadcastLobbyUpdate()`
- Add `socket.on('returnToLobby', ...)` handler inside the connection callback — calls `returnPlayersToLobby()`
- In `returnPlayersToLobby()`, preserve `player.currency` and `player.inventory` (do not reset those)
- Export `resetTransientRunState` and `returnPlayersToLobby` in the module.exports block for test access
- **File**: `game/client/main.js` — in `socket.on('stateUpdate')`, when `gamePhase === 'lobby'`: hide gameplay HUD (`#ui` display none), hide card hand, show lobby (`#lobby` remove `.hidden` class), hide run summary overlay

## Verification: code
