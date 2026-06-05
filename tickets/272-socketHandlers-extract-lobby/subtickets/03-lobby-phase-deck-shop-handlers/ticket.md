# 03 — Extract lobby-phase deck and shop handlers

Move all `withLobbyPlayer(..., { requirePhase: 'lobby' })` deck, shop, grind, evolution, and hat handlers from `index.js` into `lobbyHandlers.js`. Handler bodies stay behavior-identical (validation, emits, `savePlayerData` ordering for `unlockHat`).

## Acceptance Criteria

- These events are registered only through `lobbyHandlers.js`: `deckAddCard`, `deckRemoveCard`, `sellCard`, `buyShopCard`, `grindCard`, `evolveCard`, `unlockHat`.
- Each uses `ctx.withLobbyPlayer(socket, { requirePhase: 'lobby' }, …)` with the same inner logic as today (including hat unlock currency-then-account ordering and refund paths).
- No duplicate `socket.on` for the above events remains in `index.js`.
- `cd game && pnpm test:quick` passes (deck, grind, evolution, hat-related tests under `game/server/test/`).

## Technical Specs

- **Edit:** `game/server/socketHandlers/lobbyHandlers.js` — one `register*` per event (or grouped register function); wire in `registerLobbyHandlers`.
- **Edit:** `game/server/index.js` — extend `ctx` with progression/deck helpers used by these handlers: `normalizePlayerInventory`, `validateDeck`, `getInventoryInstance`, `findAvailableInventoryInstance`, `canAddCardInstanceToDeck`, `cardIdForDeckEntry`, `CARD_DEFS`, `DECK_MAX_SIZE`, `sellCard`, `buyShopCard`, `grindCard`, `evolveCard`, `unlockHatForPlayer`, `unlockHatForAccount`, `findUserByAccountId`, `backfillUnlockedHats`, `savePlayerData`, `ensureShopOffer` (if referenced), etc.
- Source lines to move: current `index.js` handlers ~1434–1691 (`deckAddCard` through `unlockHat`).

## Verification: code
