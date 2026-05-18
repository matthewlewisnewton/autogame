# 02 — Server-Side Lobby State & Events

Add lobby-phase tracking to the server. The server tracks a `gamePhase` (`'lobby'` or `'playing'`), maintains a `ready` flag per player, and emits the events needed for the client lobby to function.

## Acceptance Criteria
- `gameState` gains a `gamePhase` field, initialized to `'lobby'`
- Each player in `gameState.players` gains a `ready: false` field on connect
- On receiving `playerReady` from a socket, the server sets that player's `ready` to `true` and broadcasts a `lobbyUpdate` event with the current player list (id + ready status)
- When **all** connected players have `ready: true`, the server sets `gamePhase` to `'playing'` and emits `startGame` to all clients
- On player disconnect, if `gamePhase` is `'lobby'`, the server emits `lobbyUpdate` with the remaining players; if the disconnected player was the only one, no `startGame` is emitted
- `lobbyUpdate` is also emitted on new player connect (so the joining player and all existing players see the updated list)
- `stateUpdate` payloads include `gamePhase` so the client can read it

## Technical Specs
- **`game/server/index.js`** — Add `gamePhase: 'lobby'` to `gameState`. Add `ready: false` to each player on connect. Handle `socket.on('playerReady')` to flip the flag and check-all-ready. On `disconnect`, clean up and re-broadcast `lobbyUpdate` if still in lobby. On connect, emit `lobbyUpdate` to all sockets with `{ players: [{ id, ready }, ...], gamePhase }`. When all ready, emit `startGame` (empty payload) and set `gamePhase: 'playing'`. Include `gamePhase` in `stateUpdate` emissions.

## Verification: code
