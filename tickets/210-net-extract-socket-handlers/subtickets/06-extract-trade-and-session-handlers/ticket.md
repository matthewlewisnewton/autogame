# 06-extract-trade-and-session-handlers

Extract the remaining socket handlers (card trade, heartbeat, debug scenarios) and finish slimming the connection handler to session bootstrap + ctx + `registerAllSocketHandlers` only.

## Acceptance Criteria

- [ ] New `game/server/socketHandlers/trade.js` exports `register(socket, ctx)` registering: `offerCardTrade`, `respondCardTrade`
- [ ] New `game/server/socketHandlers/session.js` exports `register(socket, ctx)` registering: `heartbeat`, `debugScenario`
- [ ] `registerAllSocketHandlers` calls `trade.register` and `session.register` alongside lobby/run/deck/keyItems from prior slices
- [ ] The `io.on('connection')` handler in `game/server/index.js` contains **no** remaining inline `socket.on(...)` registrations — only auth/session setup, `buildSocketContext`, `registerAllSocketHandlers(socket, ctx)`, resume/reconnect logic, `init` emit, and `broadcastLobbyList`
- [ ] Connection closure is substantially smaller than the pre-refactor ~840-line block (handlers live under `game/server/socketHandlers/*`)
- [ ] `pnpm test` from `game/` is green (trade/integration/server tests pass)

## Technical Specs

- **New:** `game/server/socketHandlers/trade.js` — move trade handlers from `index.js` (~L1708–1815); ctx needs `offerCardTrade`, `respondCardTrade`, `findSocketByPlayerId`, `savePlayerData`
- **New:** `game/server/socketHandlers/session.js` — move `heartbeat` and `debugScenario` handlers (~L1817–1838); ctx needs `getLobbyForSocket`, `isDebugScenarioAllowed`, `applyDebugScenario` (or `debugScenarios` module)
- **Edit:** `game/server/socketHandlers/index.js` — register all six domain modules in dependency-safe order
- **Edit:** `game/server/index.js` — remove last inline handlers; connection block delegates entirely to `registerAllSocketHandlers`

## Verification: code
