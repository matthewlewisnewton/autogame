# 03 — Extract lobby browser and squad-prep socket handlers

Move lobby-listing, lobby membership, quest selection, and ready-state handlers into `socketHandlers/lobby.js`, keeping join/leave/reconnect behavior identical to today.

## Acceptance Criteria

- `game/server/socketHandlers/lobby.js` exports `register(socket, ctx)` registering: `listLobbies`, `createLobby`, `joinLobby`, `leaveLobby`, `selectQuest`, `playerReady`.
- Handler bodies are moved verbatim (same emits, guards, and helper calls: `joinPlayerToLobby`, `joinLobbyWithPhasePolicy`, `leaveLobbyForSocket`, `withLobbyPlayer`, `checkAllReady`, `applyLayoutForQuest`, etc.) with dependencies supplied via `ctx` or direct requires of `lobbies` / quest helpers — not via `require('./index')`.
- `registerAll` in `socketHandlers/index.js` calls lobby `register`.
- No inline `socket.on` for those six events remains in `game/server/index.js`.
- `cd game && pnpm test:quick` passes; lobby integration and drop-in smoke paths remain green.

## Technical Specs

- **New:** `game/server/socketHandlers/lobby.js` — move handlers from ~L1166–1229 and ~L1305–1356.
- **Edit:** `game/server/socketHandlers/ctx.js` — extend `ctx` with lobby join helpers the handlers need (`joinPlayerToLobby`, `leaveLobbyForSocket`, `reconnectPlayerToLobby`, `joinLobbyWithPhasePolicy`, `buildSessionFromPlayer`, `lobbies` accessors, `io`, `stateSnapshot`, quest/layout helpers as needed).
- **Edit:** `game/server/socketHandlers/index.js` — register lobby module.
- **Edit:** `game/server/index.js` — remove the six moved handler blocks from the connection closure.

## Verification: code
