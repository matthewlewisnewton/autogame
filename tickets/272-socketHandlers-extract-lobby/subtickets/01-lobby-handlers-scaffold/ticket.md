# 01 — Lobby handlers module scaffold and list handlers

Introduce `game/server/socketHandlers/lobbyHandlers.js` with a `registerLobbyHandlers(socket, ctx)` entry point and per-event `register*(socket, ctx)` functions. Wire it from the `io.on('connection')` block in `index.js`, passing a `ctx` object that bundles connection identity (`playerId`, `accountId`, `username`, `sessionPlayer`) and index-local helpers the handlers need (`io`, `lobbies`, `withLobbyFromSocket`, `withLobbyPlayer`, etc.). Move only the stateless list handlers in this pass to prove the pattern.

## Acceptance Criteria

- `game/server/socketHandlers/lobbyHandlers.js` exists and exports `registerLobbyHandlers(socket, ctx)`.
- `index.js` builds `ctx` after the connection preamble (saved data / `buildSessionFromPlayer` / `lobbies.registerSession`) and calls `registerLobbyHandlers(socket, ctx)` instead of inline `socket.on` for the migrated events.
- `listLobbies` and `listKeyItems` handler bodies live in the new module; event names and emit payloads unchanged (`lobbyListUpdate`, `keyItemsListed`).
- No circular `require('./index')` from `lobbyHandlers.js` (follow the `cardEffects.js` / `setCallbacks` pattern if a handler needs an index-only helper).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **New:** `game/server/socketHandlers/lobbyHandlers.js` — `registerLobbyHandlers`, `registerListLobbies`, `registerListKeyItems`; document expected `ctx` fields in a short header comment.
- **Edit:** `game/server/index.js` — inside `io.on('connection')` (~1163+), construct `ctx` with at minimum: `playerId`, `accountId`, `username`, `sessionPlayer`, `socket`, `io`, `lobbies`, and any helpers later sub-tickets will need (stub or pass through from index closures).
- **Remove from index.js:** inline `socket.on('listLobbies')` and `socket.on('listKeyItems')` (~1180–1192).
- **Do not migrate** `createLobby`, `joinLobby`, `leaveLobby`, run handlers, or `disconnect` in this sub-ticket.

## Verification: code
