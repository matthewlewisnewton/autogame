# Extract card trades module (explicit state)

Move player-to-player card trade offer/response logic into its own module with explicit lobby `state` threading, eliminating hidden `_gameState.players` lookups inside trade handlers.

## Acceptance Criteria

- New file `game/server/progression/trades.js` owns `cancelTradesForPlayer`, `offerCardTrade`, and `respondCardTrade`.
- All three functions take lobby `state` as the **first** argument (e.g. `offerCardTrade(state, pendingTrades, …)`).
- `game/server/progression/trades.js` contains **no** module-level `_gameState`; player lookups use `state.players`.
- `game/server/progression.js` re-exports the trades API.
- `game/server/socketHandlers/tradeHandlers.js` passes `lobby.state` on every trade call.
- `pnpm test:quick` from `game/` passes.

## Technical Specs

- **Create** `game/server/progression/trades.js` — move trade functions; import inventory helpers (`getInventoryInstance`, `normalizePlayerInventory`, etc.) and `savePlayerData(state, playerId)` from sibling modules as needed.
- **Edit** `game/server/progression.js` — delete moved implementations; re-export from `./progression/trades`.
- **Edit** `game/server/socketHandlers/tradeHandlers.js` — thread `lobby.state` into all trade function invocations.
- Trade validation should continue to use inventory instance IDs and deck constraints from `inventory.js`; do not change trade rules, only module placement and state passing.

## Verification: code
