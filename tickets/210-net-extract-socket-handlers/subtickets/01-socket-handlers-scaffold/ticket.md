# 01 — Socket-handlers scaffold and dead-code cleanup

Introduce the `game/server/socketHandlers/` module layout and shared `register(socket, ctx)` pattern before moving any live handlers. While touching `index.js`, extract a `notifyPlayerRemoved()` helper for the duplicated remove-player + broadcast + post-removal lobby-update blocks, and delete the unused `buyShopCard` and `listKeyItems` socket handlers (no client emitters; keep `progression.buyShopCard` for direct/unit tests).

## Acceptance Criteria

- `game/server/socketHandlers/` exists with at least a shared context module documenting/exporting the `ctx` shape passed to every `register(socket, ctx)`.
- `ctx` bundles per-connection identity (`playerId`, `accountId`, `username`, `sessionPlayer`) plus injected helpers: `withLobbyFromSocket`, `withLobbyPlayer`, `withLobbyContext`, `broadcastLobbyUpdate`, `findSocketByPlayerId`, `savePlayerData`, and any other helpers the first extracted modules will need (pass `io` or thin emit wrappers where handlers currently close over module-level `io`).
- `notifyPlayerRemoved(lobby, playerId)` (or equivalent name) replaces the copy-pasted blocks in `evictDisconnectedPlayers` and `leaveLobbyForSocket` that call `lobbies.removePlayerFromLobby`, emit `playerDisconnected`, and run the playing-phase `checkRunTerminalState` / lobby-phase `broadcastLobbyUpdate` follow-up.
- `socket.on('buyShopCard', …)` and `socket.on('listKeyItems', …)` are removed from the connection closure; grep under `game/client/` still shows no emitters for those events.
- Server test suite stays green: update or remove socket-level tests that targeted the deleted handlers (`game/server/test/key-items.test.js`, `game/server/test/integration.test.js`) while keeping direct `progression.buyShopCard` unit coverage intact.

## Technical Specs

- **`game/server/index.js`**: add `notifyPlayerRemoved()`; remove dead socket handlers; stop importing `buyShopCard` if it becomes unused in this file; shrink no live handlers yet beyond the helper extraction.
- **`game/server/socketHandlers/ctx.js`** (new): export a factory such as `createSocketContext({ socket, playerId, accountId, username, sessionPlayer, …helpers })` returning the frozen `ctx` object consumed by future `register` functions.
- **`game/server/socketHandlers/index.js`** (new, optional): barrel re-export for upcoming handler modules.
- **`game/server/test/key-items.test.js`**: drop or rewrite the `listKeyItems socket handler` describe block (handler no longer exists).
- **`game/server/test/integration.test.js`**: remove or rewrite socket `buyShopCard` integration cases; retain coverage of shop purchase logic via `progression.buyShopCard` if not already covered elsewhere.

## Verification: code
