# 02 — Extract lobby socket handlers

Move lobby-browser and squad-management socket events out of the `io.on('connection')` closure into a dedicated module, following the `register(socket, ctx)` pattern established in sub-ticket 01.

## Acceptance Criteria

- `game/server/socketHandlers/lobbyHandlers.js` exports `register(socket, ctx)` that registers: `listLobbies`, `createLobby`, `joinLobby`, `leaveLobby`, `selectQuest`, and `playerReady`.
- Handler bodies are behavior-preserving moves — same guard order, emitted event names/payloads, and calls to `joinPlayerToLobby`, `joinLobbyWithPhasePolicy`, `leaveLobbyForSocket`, `reconnectPlayerToLobby`, `applyLayoutForQuest`, `checkAllReady`, etc.
- The connection closure in `index.js` builds `ctx` once per socket and calls `lobbyHandlers.register(socket, ctx)` instead of inlining these six handlers.
- `pnpm test` (server suite) passes, especially `game/server/test/lobbies.test.js` and `game/server/test/integration.test.js` lobby flows.

## Technical Specs

- **`game/server/socketHandlers/lobbyHandlers.js`** (new): contain the six handler implementations; receive lobby/session helpers via `ctx` (e.g. `joinPlayerToLobby`, `leaveLobbyForSocket`, `broadcastLobbyList`, `buildSessionFromPlayer`, `lobbies` accessors) rather than re-requireing circular deps from `index.js`.
- **`game/server/index.js`**: import `lobbyHandlers`; remove the six inlined `socket.on(...)` blocks; wire `lobbyHandlers.register(socket, ctx)` inside the connection handler after `ctx` construction.
- **`game/server/socketHandlers/index.js`**: re-export `lobbyHandlers` if present from sub-ticket 01.

## Verification: code
