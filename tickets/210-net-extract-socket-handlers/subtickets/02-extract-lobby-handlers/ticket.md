# 02-extract-lobby-handlers

Move lobby lifecycle socket handlers out of the `io.on('connection')` closure into a dedicated module using the `register(socket, ctx)` pattern established in slice 01.

Handlers cover browsing, creating/joining/leaving lobbies, and socket disconnect cleanup.

## Acceptance Criteria

- [ ] New `game/server/socketHandlers/lobby.js` exports `register(socket, ctx)` registering: `listLobbies`, `createLobby`, `joinLobby`, `leaveLobby`, and `disconnect`
- [ ] Handler bodies are moved verbatim (behavior-preserving); they use `ctx` for identity and helpers instead of closure captures where applicable
- [ ] `registerAllSocketHandlers` in `socketHandlers/index.js` calls `lobby.register(socket, ctx)`
- [ ] The connection handler in `game/server/index.js` no longer contains inline `socket.on(...)` for those five events
- [ ] `pnpm test` from `game/` is green (lobby/integration tests pass)

## Technical Specs

- **New:** `game/server/socketHandlers/lobby.js` — `register(socket, ctx)` with the five handlers; may require extra ctx fields beyond the slice-01 minimum: `lobbies`, `joinPlayerToLobby`, `reconnectPlayerToLobby`, `leaveLobbyForSocket`, `softDisconnectPlayerFromLobby`, `applyLayoutForQuest`, `ensureShopOffer`, `withLobbyContext`, `broadcastLobbyList`
- **Edit:** `game/server/socketHandlers/context.js` — extend `buildSocketContext` to include any lobby-specific helpers passed from index
- **Edit:** `game/server/socketHandlers/index.js` — wire `lobby.register`
- **Edit:** `game/server/index.js` — build ctx, call `registerAllSocketHandlers`; keep session bootstrap (`registerSession`, resume/reconnect, `init` emit) in the connection handler
- **Do not move** run/deck/trade/key-item handlers in this slice

## Verification: code
