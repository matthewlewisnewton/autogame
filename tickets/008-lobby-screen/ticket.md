# Lobby Screen

Show a lobby UI before the 3D scene loads. Players see who is connected and can start the game together.

## Acceptance Criteria
- A lobby div appears on connection (3D canvas is hidden)
- Connected player IDs are listed in the lobby
- A "Ready" button marks the player as ready
- When all players are ready, the lobby hides and the 3D scene initializes

## Technical Specs
- **Files to modify**: `game/client/index.html`, `game/client/main.js`, `game/client/style.css`, `game/server/index.js`
- **Server**: Add `gamePhase: 'lobby'` to gameState. Track `ready` per player. On `playerReady`, set flag. When all ready, emit `startGame` and set `gamePhase: 'playing'`. Emit `lobbyUpdate` with player list on join/leave/ready.
- **Client**: Add `<div id="lobby">` with player list and Ready button. Hide `<canvas>`. On `startGame` event, hide lobby, show canvas, init Three.js scene.
- **Events**: `lobbyUpdate` (server→client), `playerReady` (client→server), `startGame` (server→all)
