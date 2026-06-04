# 02 — notifyPlayerRemoved helper and prune dead socket handlers

Deduplicate the post-`removePlayerFromLobby` broadcast logic shared by `leaveLobbyForSocket` and `evictDisconnectedPlayers`, then remove socket handlers that have no client emitters (`listKeyItems`, `buyShopCard`) while keeping the underlying `progression.buyShopCard` function and `init.keyItemDefs` delivery.

## Acceptance Criteria

- `notifyPlayerRemoved(lobby, playerId, result)` (name may vary) exists in `game/server/index.js` (or a small `game/server/lobbySocketHelpers.js` if that avoids bloating `index.js`) and encapsulates: `io.to(lobby.id).emit('playerDisconnected', playerId)` plus the `result && !result.deleted` branch that calls `checkRunTerminalState` or `broadcastLobbyUpdate` inside `withLobbyContext`.
- `leaveLobbyForSocket` and `evictDisconnectedPlayers` both call the helper instead of duplicating that block; `broadcastLobbyList()` call sites outside the helper stay where they are today.
- `socket.on('listKeyItems', …)` is removed from the connection handler; grep under `game/client/` confirms no `emit('listKeyItems')`.
- `socket.on('buyShopCard', …)` is removed from the connection handler; grep under `game/client/` confirms no `emit('buyShopCard')`; `buyShopCard` remains exported from `game/server/progression.js` for unit tests.
- Server tests updated: remove or rewrite the `listKeyItems socket handler` block in `game/server/test/key-items.test.js`; remove or rewrite `buyShopCard` integration cases in `game/server/test/integration.test.js` that only exercised the dead socket path (keep `server.test.js` progression unit tests).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/index.js` — add `notifyPlayerRemoved`, refactor `leaveLobbyForSocket` (~L987–1012) and `evictDisconnectedPlayers` (~L961–978); delete `listKeyItems` (~L1170–1178) and `buyShopCard` (~L1605–1621) handlers from the connection closure.
- **Edit:** `game/server/test/key-items.test.js` — drop/adjust `describe('listKeyItems socket handler')` (init already provides defs via `keyItemDefs`).
- **Edit:** `game/server/test/integration.test.js` — remove socket-level `buyShopCard` tests or repoint them if a supported client path exists (there is none today).
- **Do not remove:** `progression.buyShopCard` or shop-offer logic used by other flows.

## Verification: code
