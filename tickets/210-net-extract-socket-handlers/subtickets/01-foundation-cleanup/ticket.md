# 01 — Socket handler scaffold, dead-code removal, player-leave helper

Introduce `game/server/socketHandlers/` with a shared `buildSocketContext` and the `register(socket, ctx)` pattern. Extract duplicated post-remove lobby broadcast logic into `notifyPlayerRemoved`, remove unused `listKeyItems` and `buyShopCard` socket handlers (no client emitters), and move `disconnect` + `heartbeat` into the first handler module.

## Acceptance Criteria

- `game/server/socketHandlers/context.js` exports `buildSocketContext(socket, session)` returning a `ctx` object with at least: `playerId`, `sessionPlayer`, `accountId`, `username`, `io`, `withLobbyFromSocket`, `withLobbyPlayer`, `broadcastLobbyUpdate`, `findSocketByPlayerId`, `savePlayerData`, and any other helpers the lifecycle handlers need from `index.js`.
- `game/server/socketHandlers/lifecycle.js` exports `register(socket, ctx)` registering `disconnect` and `heartbeat` with behavior identical to the pre-refactor handlers.
- `notifyPlayerRemoved(lobby, playerId, result)` exists (in `index.js` or `socketHandlers/helpers.js`) and replaces the duplicated `playerDisconnected` emit + `checkRunTerminalState` / `broadcastLobbyUpdate` blocks in `leaveLobbyForSocket` and `evictDisconnectedPlayers` (and any other identical copy in those flows).
- `socket.on('listKeyItems', …)` and `socket.on('buyShopCard', …)` are removed from the connection closure; `rg` under `game/client/` still shows no `emit('listKeyItems')` or `emit('buyShopCard')`.
- Tests updated: remove or replace `describe('listKeyItems socket handler')` in `game/server/test/key-items.test.js`; remove or narrow integration tests that only exercised the deleted `buyShopCard` socket path in `game/server/test/integration.test.js` (unit tests for `buyShopCard` in `progression.js` remain).
- `io.on('connection')` calls `buildSocketContext` and `lifecycle.register(socket, ctx)`; remaining handlers may still be inline for now.
- `cd game && pnpm test:quick` passes (server, integration, lobbies, key-items suites).

## Technical Specs

- **New:** `game/server/socketHandlers/context.js` — assemble `ctx` from connection-local identity (`playerId`, `sessionPlayer`, JWT fields) plus module-level helpers imported from `index.js` (pass as arguments to `buildSocketContext` to avoid circular requires, mirroring `cardEffects.setCallbacks`).
- **New:** `game/server/socketHandlers/lifecycle.js` — `register(socket, ctx)` for `disconnect` and `heartbeat`.
- **New (optional):** `game/server/socketHandlers/helpers.js` — `notifyPlayerRemoved` if not kept beside `leaveLobbyForSocket` in `index.js`.
- **Edit:** `game/server/index.js` — wire context + lifecycle register; delete `listKeyItems` / `buyShopCard` handlers; refactor `leaveLobbyForSocket` / `evictDisconnectedPlayers` to call `notifyPlayerRemoved`.
- **Edit:** `game/server/test/key-items.test.js`, `game/server/test/integration.test.js` — align with removed socket events.

## Verification: code
