# Shop booth opens the card shop (buy + sell)

Wire the hub **shop** booth so a successful `boothAction` shows the existing 2D card
shop (`#card-shop` / Card Shop tab) and restores working buy/sell against the current
lobby `shopOffer`. Reuse `setLobbyTab`, `showGameLobby`, and `renderCardShop`; do not
duplicate shop rendering logic.

## Acceptance Criteria

- A `window` listener on `booth:action` (`BOOTH_ACTION_EVENT` from `boothPrompt.js`)
  handles payloads where `action === 'shop'` (or `boothId === 'shop'`) and calls a
  single exported `openShopBooth()` helper.
- After `openShopBooth()`: `#lobby` is visible (not `hidden`), `activeLobbyTab` is
  `'shop'`, `#card-shop` is visible, and other lobby tab panels (`#deck-editor`,
  `#photon-forge`, etc.) stay hidden.
- `renderCardShop()` runs so currency, the current `gameState.shopOffer`, and the sell
  list populate from current client state (same path as today’s shop tab click).
- **Buy:** clicking `#buy-shop-card-btn` when the offer is affordable emits
  `buyShopCard` on the socket; the server handler in `deckHandlers.js` calls
  `buyShopCard(player, state.shopOffer)` and responds with `cardInventoryUpdate` on
  success or `deckError` on failure (insufficient gold, no offer, etc.).
- **Sell:** with a mocked socket, clicking a rendered `.sell-card-btn` in the shop
  sell list still emits `sellCard` with `{ instanceId, cardId }` (unchanged behavior;
  only the open path is new).
- Clicking `#lobby-tab-shop` still opens the shop tab and does not break booth-open
  behavior (2D tab path preserved).
- `pnpm test` passes, including a new `game/client/test/boothShop.test.js`.

## Technical Specs

- **New** `game/client/boothShop.js` — export `openShopBooth({ render })` that calls
  injected `showGameLobby`, `setLobbyTab('shop')`, and `renderCardShop`. Export
  `registerShopBoothListener(deps)` that attaches the `booth:action` listener once.
- `game/client/main.js` — import `registerShopBoothListener` and call it during
  client bootstrap (alongside `registerDeckBoothListener`). Pass real lobby helpers.
  Wire `#buy-shop-card-btn` click to `socket.emit('buyShopCard')` when connected and
  `gameState.shopOffer` is present (one-time listener or guarded re-bind; mirror
  sell-button pattern in `renderCardShop` / bottom-of-file tab listeners).
- `game/server/socketHandlers/deckHandlers.js` — re-register `socket.on('buyShopCard')`
  inside `withLobbyPlayer(..., { requirePhase: 'lobby' })`: read `state.shopOffer`
  (via `ensureShopOffer` if needed), call progression `buyShopCard`, emit
  `cardInventoryUpdate` on success (inventory, ownedCards, currency, selectedDeck) or
  `deckError` on failure; call `savePlayerData` and refresh/rotate offer per existing
  lobby shop flow if other handlers do so after purchase.
- Import `buyShopCard` and `ensureShopOffer` from `../progression` in `deckHandlers.js`.
- **New** `game/client/test/boothShop.test.js` — jsdom/vitest: dispatch
  `CustomEvent('booth:action', { detail: { boothId: 'shop', action: 'shop' } })` and
  assert shop tab + `#card-shop` visibility; stub socket and assert `buyShopCard` and
  `sellCard` emits after booth open; assert non-shop booth actions are ignored.
- No changes to hub layout or `boothInteract` server routing (`shop` anchor already
  exists in `lobbyHandlers.js`).

## Verification: code
