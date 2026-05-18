# Lobby System

Create a lobby screen that players see before entering a level. Show a list of connected players and a "Start Game" button that all players must agree on before the 3D level loads.

## Acceptance Criteria
- A lobby UI appears on connection (before the 3D scene)
- Connected player names/IDs are listed
- A "Start Game" button transitions all players into the 3D level

## Technical Specs
- **Files to modify**: `game/client/main.js`, `game/client/index.html`, `game/server/index.js`
- **Client**: Add a `<div id="lobby">` with a player list and Start button. Hide the Three.js canvas initially. On `startGame` event, hide lobby and init/show the 3D scene.
- **Server**: Add a `lobby` state. New connections join the lobby. Track `ready` status per player. Emit `lobbyUpdate` with player list. When all players emit `ready`, broadcast `startGame`.
- **Socket events**: `lobbyUpdate` (server→client), `playerReady` (client→server), `startGame` (server→all)
