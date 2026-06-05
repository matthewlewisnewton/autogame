# 06 — Extract disconnect handler and finish lobby handler extraction

Complete slice 1 of the socket-closure extraction: move `disconnect` into `lobbyHandlers.js` and ensure the `io.on('connection')` block in `index.js` only wires identity, resume-reconnect, `init`, infra handlers (`heartbeat`, `debugScenario`), and a single `registerLobbyHandlers(socket, ctx)` call for all lobby/run gameplay events.

## Acceptance Criteria

- `disconnect` is registered via `lobbyHandlers.js` with the same soft-disconnect / `removeSession` behavior as today.
- After this sub-ticket, every lobby/run `socket.on` from the parent ticket scope lives under `game/server/socketHandlers/lobbyHandlers.js` (browser, lobby-phase, run-phase, disconnect); `index.js` has no leftover inline handlers for those event names.
- `registerLobbyHandlers` is the sole registration path for migrated events; `ctx` documents required identity + helper fields.
- `debugScenario` and `heartbeat` may remain in `index.js` (connection infra, out of LOBBY/run slice).
- Parent acceptance: behavior-preserving refactor; `cd game && pnpm test:quick` (or full `pnpm test` if harness requires) passes.

## Technical Specs

- **Edit:** `game/server/socketHandlers/lobbyHandlers.js` — `registerDisconnect`; final audit that `registerLobbyHandlers` registers all events from sub-tickets 01–05 plus disconnect.
- **Edit:** `game/server/index.js` — remove inline `socket.on('disconnect')` (~1904–1916); pass `softDisconnectPlayerFromLobby`, `lobbies`, `socket.playerId` via `ctx`; keep post-handler resume block (`resumeLobby` / `reconnectPlayerToLobby`), `socket.playerId` assignment, `init` emit, and `broadcastLobbyList()` after registration.
- Optional: trim `ctx` construction into a small `buildLobbyHandlerCtx(...)` helper in `index.js` if it reduces duplication (behavior unchanged).

## Verification: code
