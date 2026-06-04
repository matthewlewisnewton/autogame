# 04-extract-deck-handlers

Extract lobby-phase deck and inventory progression handlers into `socketHandlers/deck.js`.

Covers deck editing, card evolution/grinding/selling, and hat unlocks (`buyShopCard` was removed in slice 01).

## Acceptance Criteria

- [ ] New `game/server/socketHandlers/deck.js` exports `register(socket, ctx)` registering: `deckAddCard`, `deckRemoveCard`, `evolveCard`, `sellCard`, `grindCard`, `unlockHat`
- [ ] Handler logic matches pre-extraction behavior (same emits, validation, and `savePlayerData` calls)
- [ ] `registerAllSocketHandlers` calls `deck.register(socket, ctx)`
- [ ] No inline `socket.on(...)` for those six events remain in `game/server/index.js`
- [ ] `pnpm test` from `game/` is green (deck/progression/hat tests pass)

## Technical Specs

- **New:** `game/server/socketHandlers/deck.js` — move handler bodies from `index.js` (~L1374–1652); receive via ctx or direct requires: `CARD_DEFS`, `DECK_MAX_SIZE`, inventory helpers (`getInventoryInstance`, `findAvailableInventoryInstance`, `canAddCardInstanceToDeck`, `cardIdForDeckEntry`, `normalizePlayerInventory`), progression fns (`evolveCard`, `sellCard`, `grindCard`, `unlockHatForPlayer`), auth helpers (`findUserByAccountId`, `backfillUnlockedHats`, `unlockHatForAccount`)
- **Edit:** `game/server/socketHandlers/index.js` — wire `deck.register`
- **Edit:** `game/server/index.js` — remove extracted inline handlers

## Verification: code
