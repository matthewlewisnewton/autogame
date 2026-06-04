# 01 — Scaffold socket handler context and lifecycle module

Introduce `game/server/socketHandlers/` with a shared `createSocketHandlerCtx` factory and wire the connection handler to build `ctx` once, then delegate registration. Move the lowest-coupling handlers (`heartbeat`, `debugScenario`, `disconnect`) into the first module to prove the `register(socket, ctx)` pattern before touching lobby or run logic.

## Acceptance Criteria

- `game/server/socketHandlers/ctx.js` exports `createSocketHandlerCtx(...)` bundling per-connection identity (`playerId`, `accountId`, `username`, `sessionPlayer`) plus helpers the handlers need: at minimum `withLobbyFromSocket`, `withLobbyPlayer`, `broadcastLobbyUpdate`, `findSocketByPlayerId`, `savePlayerData`, and `getLobbyForSocket` (add others only when a moved handler needs them).
- `game/server/socketHandlers/lifecycle.js` exports `register(socket, ctx)` registering `heartbeat`, `debugScenario`, and `disconnect` with behavior identical to the current inline handlers in `game/server/index.js`.
- `game/server/socketHandlers/index.js` (or equivalent) exports `registerAll(socket, ctx)` that calls lifecycle registration (other domains added in later sub-tickets).
- The `io.on('connection')` block builds `ctx`, calls `registerAll`, and no longer contains inline `socket.on` for those three events; session bootstrap (`registerSession`, resume/reconnect, `init` emit) stays in `index.js` unchanged.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **New:** `game/server/socketHandlers/ctx.js` — factory reading from closure values already computed in the connection handler (`playerId`, `accountId`, `username`, `sessionPlayer`, `socket`).
- **New:** `game/server/socketHandlers/lifecycle.js` — move handlers from ~L1828–1902 (`debugScenario`, `heartbeat`, `disconnect`); `disconnect` still calls `softDisconnectPlayerFromLobby` / `lobbies.removeSession` via `ctx` or imported index helpers.
- **New:** `game/server/socketHandlers/index.js` — `registerAll` aggregator.
- **Edit:** `game/server/index.js` — `require('./socketHandlers')`, build `ctx` after `sessionPlayer` is created, call `registerAll`; remove the three moved `socket.on` blocks.
- **Constraint:** No circular `require('./index')` from socket handler modules; pass `io`-dependent behavior through `ctx` or existing `debugScenarios` / `cardEffects` callback wiring.

## Verification: code
