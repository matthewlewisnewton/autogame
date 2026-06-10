# Extract economy and shop module (explicit state)

Move shop offers, medic healing, card buy/sell, grind/evolve, and related card-economy helpers into a module that always receives lobby `state` explicitly instead of defaulting to `_gameState`.

## Acceptance Criteria

- New file `game/server/progression/economy.js` owns shop and card-economy logic: `pickShopOffer`, `isValidShopOffer`, `refreshShopOffer`, `ensureShopOffer`, `healAtMedic`, `revivePlayerInLobby`, `buyShopCard`, `getCardSellValue`, `getCardBuyValue`, `canSellCardInstance`, `sellCard`, `getGrindCost`, `getGrindStatScale`, `getStatMultiplier`, `scaledGrindStat`, `applyWyrmMinionBreathStats`, `grindCard`, `evolveCard`, `unlockHatForPlayer`, `chargeAppearanceChangeForPlayer`, and shared economy constants (`CARD_SELL_VALUES`, `EVOLUTION_TRANSFORMS`, `EVOLUTION_GRIND_REQUIRED`, grind stat scales, `migrateCardId`).
- Lobby-scoped functions take `state` as the **first** parameter with **no** `state = _gameState` default.
- `game/server/progression/economy.js` contains **no** module-level `_gameState`.
- `game/server/progression.js` re-exports the economy API.
- Call sites updated to pass `state`: `game/server/index.js` (`ensureShopOffer` at startup and in handlers), `game/server/socketHandlers/lobbyHandlers.js`, and any other direct callers of `refreshShopOffer`, `healAtMedic`, `buyShopCard`, or `sellCard`.
- `pnpm test:quick` from `game/` passes.

## Technical Specs

- **Create** `game/server/progression/economy.js` — move shop/economy functions and their constants; import inventory helpers from `./inventory` and persistence `savePlayerData(state, playerId)` where saves occur after purchases/sales/grinds.
- **Edit** `game/server/progression.js` — delete moved code; re-export from `./progression/economy`; remove `state = _gameState` defaults from the re-export wrappers (thin pass-through only).
- **Edit** `game/server/socketHandlers/lobbyHandlers.js` — pass `lobby.state` into economy functions invoked inside or outside `withLobbyContext`.
- **Edit** `game/server/index.js` — pass explicit `gameState` to `ensureShopOffer` at startup.
- `getIoTarget` / socket emits triggered by economy actions may remain delegated through callbacks wired in `progression.js` until sub-ticket 06.

## Verification: code
