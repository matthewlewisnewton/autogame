# 05 — Extract trade, key-item, debug handlers; slim connection closure

Finish the extraction by moving the remaining socket handlers and reducing `io.on('connection')` to session setup, `buildSocketContext`, sequential `register` calls, reconnect/`init` emit, and `broadcastLobbyList`.

## Acceptance Criteria

- `game/server/socketHandlers/trade.js` exports `register(socket, ctx)` for `offerCardTrade` and `respondCardTrade`.
- `game/server/socketHandlers/keyItem.js` exports `register(socket, ctx)` for `equipKeyItem` and `useKeyItem` (the latter still delegates to `keyItemEffects.handleUseKeyItem`).
- `game/server/socketHandlers/debug.js` exports `register(socket, ctx)` for `debugScenario` (still uses `applyDebugScenario` / `isDebugScenarioAllowed`).
- The `io.on('connection')` block in `index.js` contains no remaining `socket.on('…')` handler bodies except connection bootstrap (identity, `registerSession`, resume/reconnect, `init` emit, `broadcastLobbyList`).
- All handler modules are registered from connection in a clear order (lifecycle → lobby → run → deck → trade → keyItem → debug).
- `index.js` connection-related section is substantially smaller than pre-ticket (~840 lines of handlers removed to modules).
- `cd game && pnpm test:quick` passes; `game/server/test/key-items.test.js` and trade-related integration tests pass.

## Technical Specs

- **New:** `game/server/socketHandlers/trade.js` — move `offerCardTrade` / `respondCardTrade` (~lines 1719–1820).
- **New:** `game/server/socketHandlers/keyItem.js` — move `equipKeyItem` / `useKeyItem` (~lines 1472–1500).
- **New:** `game/server/socketHandlers/debug.js` — move `debugScenario` (~lines 1822–1831).
- **Edit:** `game/server/index.js` — final connection slim-down; require and call all `register` functions.
- **Edit:** `game/server/socketHandlers/context.js` — final `ctx` fields for trade (`offerCardTrade`, `respondCardTrade`, `findSocketByPlayerId`) and key items (`getKeyItemDef`, `keyItemEffects`).

## Verification: code
