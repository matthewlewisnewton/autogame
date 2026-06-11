# Maintain O(1) playerId → socket lookup map

`findSocketByPlayerId` in `game/server/index.js` linearly scans every connected socket on hot paths (trade notifications, simulation callbacks via `setFindSocketCallback`, dual-socket eviction). Add a module-level `Map<playerId, socket>` that is updated on connect, lobby join/reconnect, and disconnect/eviction so lookups are O(1) while preserving existing `excludeSocketId` semantics.

## Acceptance Criteria

- A module-level `playerSockets` (or equivalent) `Map` exists in `index.js` and is cleared in `resetGameState` (and any test reset path that clears sockets)
- `registerPlayerSocket(playerId, socket)` / `unregisterPlayerSocket(playerId, socket)` (or inline equivalents) add on `socket.playerId` assignment and remove on disconnect only when the map entry still points at that socket
- `findSocketByPlayerId(playerId, excludeSocketId)` uses the map first; when `excludeSocketId` excludes the mapped socket but another live socket shares the same `playerId`, behavior matches today (return the other socket or `null`)
- `evictPriorSocketForPlayer` still disconnects the prior socket; map stays consistent after eviction
- Existing `findSocketByPlayerId` tests in `game/server/test/server.test.js` and `game/server/test/dual_socket_race.test.js` pass without behavior change

## Technical Specs

- **File:** `game/server/index.js`
  - Add `const playerSockets = new Map()` near other module-level socket state
  - Add `registerPlayerSocket` / `unregisterPlayerSocket` helpers; call register after `socket.playerId = playerId` in the connection handler (~line 1768) and after reconnect paths that assign a live socket; call unregister from the `disconnect` handler path (`lobbyHandlers.js` delegates to `softDisconnectPlayerFromLobby` / session removal — wire unregister in `index.js` disconnect cleanup or export a helper the handler calls)
  - Rewrite `findSocketByPlayerId` to read from `playerSockets`; keep a narrow fallback only for the dual-socket `excludeSocketId` edge case if needed
  - Clear `playerSockets` inside `resetGameState()`
- **File:** `game/server/socketHandlers/lobbyHandlers.js` (if needed)
  - Invoke socket-map unregister at the start of the `disconnect` handler before lobby/session cleanup
- **Tests:** Update `game/server/test/server.test.js` `findSocketByPlayerId` mocks to register/unregister via exported helpers (or connection flow) instead of only mutating `io.sockets.sockets`

## Verification: code
