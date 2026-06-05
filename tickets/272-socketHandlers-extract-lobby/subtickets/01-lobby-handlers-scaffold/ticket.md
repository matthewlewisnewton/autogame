# 01 — Lobby handlers module scaffold and ctx wiring

Create `game/server/socketHandlers/lobbyHandlers.js` with a `register(socket, ctx)` entry point and wire it from the `io.on('connection')` handler in `index.js`. The `ctx` object bundles per-connection identity (`playerId`, `accountId`, `username`, `sessionPlayer`) plus injected helpers so handler bodies can move out of the closure without circular `require('./index')` imports. Move `listLobbies` as the first handler to prove the pattern.

## Acceptance Criteria

- `game/server/socketHandlers/lobbyHandlers.js` exists and exports `register(socket, ctx)`.
- `ctx` includes at minimum: `playerId`, `accountId`, `username`, `sessionPlayer`, and any helpers `listLobbies` needs (e.g. `lobbies`, `socket`).
- In `game/server/index.js`, after session registration (~L1170–1172), the connection handler calls `lobbyHandlers.register(socket, ctx)` instead of inline `socket.on('listLobbies', …)`.
- The `listLobbies` handler body is identical in behavior: emits `lobbyListUpdate` with `lobbies.listLobbySummaries()`.
- Connection preamble (session setup, resume/reconnect, `socket.playerId` assignment, `init` emit) remains in `index.js` — not moved in this sub-ticket.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **New file:** `game/server/socketHandlers/lobbyHandlers.js`
  - Export `function register(socket, ctx) { … }`.
  - Register `listLobbies` inside `register`; read `ctx.playerId` / `ctx.lobbies` (or equivalent) from the passed context.
- **Edit:** `game/server/index.js`
  - `const lobbyHandlers = require('./socketHandlers/lobbyHandlers');` near other requires.
  - Build `ctx` after `buildSessionFromPlayer` / `lobbies.registerSession` (~L1170–1172).
  - Replace inline `socket.on('listLobbies', …)` (~L1174–1176) with `lobbyHandlers.register(socket, ctx)`.
  - Pass helpers on `ctx` that moved handlers will need in later sub-tickets (`withLobbyFromSocket`, `withLobbyPlayer`, `joinPlayerToLobby`, `leaveLobbyForSocket`, `joinLobbyWithPhasePolicy`, `reconnectPlayerToLobby`, `io`, `lobbies`, etc.) — wire the ones needed now; extend in later sub-tickets.
- Follow the setter-injection / callback pattern used by `cardEffects.js` and `simulation.js` to avoid `lobbyHandlers.js` requiring `index.js`.
- Do not move any handler other than `listLobbies` in this sub-ticket.

## Verification: code
