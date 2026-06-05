# 04 — Extract deck trade handlers and finalize deck module split

Move the card-trade socket handlers from `lobbyHandlers.js` into `deckHandlers.js` and clean up `lobbyHandlers.js` so all deck/shop/trade/inventory handlers live in the deck module. This completes ticket 273.

## Acceptance Criteria

- `offerCardTrade` and `respondCardTrade` are registered only in `deckHandlers.register`; no inline copies remain in `lobbyHandlers.js`.
- Trade flow behavior is unchanged:
  - `offerCardTrade` validates payload, calls `offerCardTrade` progression helper, emits `tradeUpdate` to offerer and `tradeOffer` to target via `findSocketByPlayerId`.
  - `respondCardTrade` handles accept/reject, emits `tradeUpdate` to both parties, emits `cardInventoryUpdate` on accept, and saves both players.
- `lobbyHandlers.js` no longer imports deck-only progression symbols (`validateDeck`, `evolveCard`, `sellCard`, `buyShopCard`, `grindCard`, `offerCardTrade`, `respondCardTrade`, deck inventory helpers, etc.) unless still used by non-deck handlers.
- `lobbyHandlers.js` header comment updated to reflect deck handlers living in `deckHandlers.js`.
- `index.js` is unchanged (registration stays `lobbyHandlers.register` → `deckHandlers.register`).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/socketHandlers/deckHandlers.js`
  - Move handler bodies from `lobbyHandlers.js`:
    - `offerCardTrade` (~L524–567)
    - `respondCardTrade` (~L569–625)
  - Import `offerCardTrade`, `respondCardTrade`, `savePlayerData` from `../progression`.
  - Read from `ctx`: `withLobbyPlayer`, `findSocketByPlayerId`.
- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - Remove trade handler registrations and all deck-only imports/requires.
  - Update module header comment (remove "deck/shop/trade" from this file's scope description).
- Do not move non-deck handlers (`selectQuest`, `unlockHat`, `equipKeyItem`, `useKeyItem`, `medicHeal`, run lifecycle, playing phase, etc.).

## Verification: code
