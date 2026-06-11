# Use Socket.IO rooms for per-lobby quest/lobby broadcasts

`emitQuestPayloadToLobby` and `broadcastLobbyUpdate` iterate `io.sockets.sockets.values()` and filter with `socket.rooms.has(lobby.id)`, which is O(all server sockets) per broadcast. Replace those loops with iteration over `io.sockets.adapter.rooms.get(lobby.id)` so each emit touches only sockets in that lobby room (players already `socket.join(lobby.id)` on join/reconnect).

## Acceptance Criteria

- `emitQuestPayloadToLobby` no longer calls `io.sockets.sockets.values()`; it resolves socket ids from `io.sockets.adapter.rooms.get(lobby.id)` and emits per-account payloads via `io.sockets.sockets.get(socketId)`
- `broadcastLobbyUpdate` lobby branch (`lobby` truthy) uses the same room-based iteration instead of scanning all sockets
- `broadcastLobbyUpdate` no-lobby fallback (when `lobby` is null but `activeState` has players) no longer scans all sockets; it emits only to connected players in `activeState.players` using `findSocketByPlayerId` (from sub-ticket 01)
- Per-socket payload shape is unchanged (`buildQuestUpdatePayload`, `lobbyPlayerList`, `shopOffer`, etc.)
- Existing server tests pass, including `emitQuestPayloadToLobby` / `lobbyUpdate` coverage in `game/server/test/unlock_prereqs.test.js` and broader lobby flows in `game/server/test/server.test.js`

## Technical Specs

- **File:** `game/server/index.js`
  - Add a small helper, e.g. `forEachSocketInLobby(lobbyId, (socket) => { ... })`, that reads `const room = io.sockets.adapter.rooms.get(lobbyId)`, skips if missing, iterates `room` socket ids (skip the room id entry itself if present), resolves each via `io.sockets.sockets.get(id)`, and skips undefined sockets
  - Refactor `emitQuestPayloadToLobby` (~lines 685–696) to use the helper
  - Refactor `broadcastLobbyUpdate` lobby branch (~lines 734–742) to use the helper
  - Refactor the no-lobby fallback branch (~lines 714–721) to loop `Object.keys(activeState.players)` and `findSocketByPlayerId(playerId)` instead of all sockets
- **Dependency:** sub-ticket `01-maintain-player-socket-map` (for efficient no-lobby fallback)

## Verification: code
