# 02 — Extract lobby browser socket handlers

Move the lobby-browser `socket.on` handlers (`listKeyItems`, `createLobby`, `joinLobby`, `leaveLobby`) from the `io.on('connection')` closure in `index.js` into `lobbyHandlers.register`. These handlers manage browsing, creating, joining, and leaving lobbies before or between runs.

## Acceptance Criteria

- `listKeyItems`, `createLobby`, `joinLobby`, and `leaveLobby` are registered inside `lobbyHandlers.register` — no inline copies remain in the connection closure.
- Handler bodies are behavior-preserving:
  - `listKeyItems` emits `keyItemsListed` with unlocked key-item defs.
  - `createLobby` rejects when already in a lobby, creates lobby, applies quest layout/shop, joins player.
  - `joinLobby` handles reconnect-to-same-lobby, missing/unknown lobbyId, and delegates to `joinLobbyWithPhasePolicy`.
  - `leaveLobby` rejects when not in a lobby, calls `leaveLobbyForSocket`, re-registers session, emits `lobbyLeft` with lobby summaries.
- All error emits (`lobbyError` reasons) and success payloads match pre-extraction shapes.
- `cd game && pnpm test:quick` passes, including lobby integration tests (`server/test/integration.test.js` lobby scenarios, `server/test/lobbies.test.js`).

## Technical Specs

- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - Add registrations for the four handlers inside `register(socket, ctx)`.
  - Use `ctx.playerId`, `ctx.sessionPlayer`, and injected helpers (`lobbies`, `withLobbyContext`, `applyLayoutForQuest`, `ensureShopOffer`, `joinPlayerToLobby`, `joinLobbyWithPhasePolicy`, `leaveLobbyForSocket`, `buildSessionFromPlayer`, `getUnlockedKeyItems`, etc.).
- **Edit:** `game/server/index.js`
  - Remove inline `socket.on('listKeyItems' …)` (~L1178–1186).
  - Remove inline `socket.on('createLobby' …)` (~L1188–1199).
  - Remove inline `socket.on('joinLobby' …)` (~L1201–1224).
  - Remove inline `socket.on('leaveLobby' …)` (~L1226–1237).
  - Extend `ctx` construction with any newly required helpers.
- Do not move quest, deck, run, or playing-phase handlers in this sub-ticket.

## Verification: code
