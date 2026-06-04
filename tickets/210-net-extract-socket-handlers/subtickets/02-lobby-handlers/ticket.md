# 02 — Extract lobby socket handlers

Move lobby browser/join/leave socket handlers into `game/server/socketHandlers/lobby.js` using the `register(socket, ctx)` pattern from sub-ticket 01. The connection closure only adds one `lobby.register(socket, ctx)` call for these events.

## Acceptance Criteria

- `game/server/socketHandlers/lobby.js` exports `register(socket, ctx)` registering: `listLobbies`, `createLobby`, `joinLobby`, `leaveLobby`.
- Handler bodies are behavior-preserving moves (same emits, guards, and calls to `joinPlayerToLobby`, `joinLobbyWithPhasePolicy`, `leaveLobbyForSocket`, `withLobbyContext`, `ensureShopOffer`, etc.) — no rule changes.
- No inline `socket.on` for those four events remains inside `io.on('connection')` in `index.js`.
- `io.on('connection')` invokes `lobby.register(socket, ctx)` after lifecycle registration.
- `cd game && pnpm test:quick` passes; lobby-focused tests (`game/server/test/integration.test.js` lobby flows, `pnpm test:smoke:lobby-dropin` if touched) still green.

## Technical Specs

- **New:** `game/server/socketHandlers/lobby.js` — cut/paste the four handlers from `game/server/index.js` (~lines 1160–1223) into `register`, closing over `ctx.playerId`, `ctx.sessionPlayer`, and lobby helpers (`joinPlayerToLobby`, `reconnectPlayerToLobby`, `joinLobbyWithPhasePolicy`, `leaveLobbyForSocket`, `lobbies`, `applyLayoutForQuest`, `ensureShopOffer`, `withLobbyContext`, `broadcastLobbyList`, etc.) via `ctx` or explicit parameters passed from `buildSocketContext`.
- **Edit:** `game/server/index.js` — remove the four inline handlers; `require('./socketHandlers/lobby').register(socket, ctx)`.
- **Edit:** `game/server/socketHandlers/context.js` — extend `ctx` with any lobby-only helpers not already bundled.

## Verification: code
