# Retire the 2D deck & shop tab menus

Remove the old 2D `Loadout Bay` (deck) and `Card Shop` (shop) tab buttons from the
lobby tab bar so the deck terminal and shop are reachable **only** via their hub
booths. The deck-editor and card-shop panels themselves stay (they are the
screens the booths reveal); only the redundant 2D menu entry points are removed.

## Acceptance Criteria

- The `#lobby-tab-deck` ("Loadout Bay") and `#lobby-tab-shop` ("Card Shop")
  buttons no longer exist in `game/client/index.html`.
- The deck booth still opens the deck editor (`#deck-editor`) and `deckAddCard`/
  remove still work from it; the `?booth=deck` debug hook still opens it.
- The shop booth still opens the card shop (`#card-shop`) and buy/sell still
  work from it; the `?booth=shop` debug hook still opens it.
- The remaining lobby tabs (forge / economy / medic / keyitems) still function,
  and the lobby shows a valid default panel (not the removed deck/shop tab) when
  no booth has been opened.
- The `#lobby-browser` (lobby-finder) menu is unchanged.
- Tests green (`pnpm test` server + client).

## Technical Specs

- `game/client/index.html`: delete the `<button id="lobby-tab-deck">` and
  `<button id="lobby-tab-shop">` elements from `#lobby-tabs`. Leave the
  `#deck-editor` and `#card-shop` panel `<div>`s in place — booths reveal them.
- `game/client/main.js`: remove the click-listener wiring and any
  `lobby-tab-deck`/`lobby-tab-shop` button references; update `setLobbyTab` and
  the initial `activeLobbyTab` (currently `'deck'`) so a still-present tab is the
  default and `setLobbyTab('deck'|'shop')` still toggles the panel `<div>`
  visibility (the booth openers call `setLobbyTab`). Keep `renderDeckEditor` and
  `renderCardShop`.
- `game/client/boothDeck.js`, `game/client/boothShop.js`: keep `openDeckBooth`/
  `openShopBooth` working without the tab buttons (they reveal the panel via
  `showGameLobby` + `setLobbyTab`).
- Update affected tests: `game/client/test/boothDeck.test.js`,
  `boothShop.test.js`, `boothDeckDebug.test.js`, `boothShopDebug.test.js`,
  `main.test.js` — adjust DOM fixtures/assertions that reference the removed
  buttons.

## Verification: code
