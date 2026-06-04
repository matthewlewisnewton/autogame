# 04 — Extract deck / shop / progression socket handlers

Move lobby-phase deck, economy, medic, and hat socket handlers into `game/server/socketHandlers/deck.js`. Do not reintroduce the removed `buyShopCard` socket handler (shop purchases use existing client flows / `progression.buyShopCard` only at the unit level).

## Acceptance Criteria

- `game/server/socketHandlers/deck.js` exports `register(socket, ctx)` registering: `deckAddCard`, `deckRemoveCard`, `evolveCard`, `sellCard`, `unlockHat`, `medicHeal`, `grindCard`.
- Handler behavior and emitted event names/payloads are unchanged from the pre-extraction inline versions.
- No inline `socket.on` for those seven events remains in `index.js`.
- `index.js` calls `deck.register(socket, ctx)`.
- `cd game && pnpm test:quick` passes (deck validation, medic, hat unlock, grind/sell tests).

## Technical Specs

- **New:** `game/server/socketHandlers/deck.js` — move handlers from `game/server/index.js` (~lines 1414–1717, excluding trade/key-item blocks).
- **Edit:** `game/server/index.js` — wire `deck.register`; remove moved handlers.
- **Edit:** `game/server/socketHandlers/context.js` — bundle deck/progression helpers (`normalizePlayerInventory`, `validateDeck`, `evolveCard`, `sellCard`, `grindCard`, `healAtMedic`, `unlockHatForPlayer`, `findUserByAccountId`, `DECK_MAX_SIZE`, inventory helpers, etc.).

## Verification: code
