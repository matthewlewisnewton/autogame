# 01-scaffold-and-cleanup

Lay the socket-handler extraction foundation: add the `socketHandlers/` module layout and shared context builder, deduplicate player-removal broadcast logic, and remove dead socket events that have no client emitters.

This slice is behavior-preserving except for deleting unused handlers; it does not move live handlers yet.

## Acceptance Criteria

- [ ] `game/server/socketHandlers/` exists with `index.js` exporting `registerAllSocketHandlers(socket, ctx)` (no-op or empty for now) and `context.js` exporting `buildSocketContext(...)` that bundles at minimum: `playerId`, `accountId`, `username`, `sessionPlayer`, `withLobbyFromSocket`, `broadcastLobbyUpdate`, `findSocketByPlayerId`, `savePlayerData`, and `io`
- [ ] `notifyPlayerRemoved(lobby, playerId)` helper exists in `game/server/index.js` (or a small adjacent helper module required by index) and replaces the duplicated remove-and-broadcast blocks in `evictDisconnectedPlayers` and `leaveLobbyForSocket` (save/cancel-trades/remove/`playerDisconnected`/post-removal lobby update)
- [ ] `socket.on('buyShopCard', …)` and `socket.on('listKeyItems', …)` are removed from the connection handler; `rg 'emit\(.buyShopCard|emit\(.listKeyItems' game/client` still returns no matches
- [ ] Dead-handler tests removed or updated: delete the `listKeyItems socket handler` describe block in `game/server/test/key-items.test.js`; delete the two `buyShopCard` integration tests in `game/server/test/integration.test.js` (keep `progression.js` `buyShopCard` unit tests)
- [ ] `pnpm test` from `game/` is green

## Technical Specs

- **New:** `game/server/socketHandlers/context.js` — `buildSocketContext(socket, identity, helpers)` returning the ctx object handlers will receive
- **New:** `game/server/socketHandlers/index.js` — `registerAllSocketHandlers(socket, ctx)` stub; will accumulate `register` calls in later slices
- **Edit:** `game/server/index.js` — add `notifyPlayerRemoved`; refactor `evictDisconnectedPlayers` and `leaveLobbyForSocket` to call it; remove `buyShopCard`/`listKeyItems` handlers and any now-unused imports tied only to those handlers
- **Edit:** `game/server/test/key-items.test.js` — remove `listKeyItems` socket tests
- **Edit:** `game/server/test/integration.test.js` — remove `buyShopCard` socket integration tests
- **Constraint:** New modules must not `require('./index')` (same rule as `cardEffects.js` / `keyItemEffects.js`); pass dependencies via `ctx` or explicit helper args

## Verification: code
