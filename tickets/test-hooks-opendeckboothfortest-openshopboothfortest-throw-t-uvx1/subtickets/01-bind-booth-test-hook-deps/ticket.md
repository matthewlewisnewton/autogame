# Bind booth deps on window test hooks

`openDeckBooth` and `openShopBooth` are `boothCommon.openBooth(deps)` closures that require a deps object (`showGameLobby`, `setLobbyTab`, and the booth render fn). `main.js` already builds `deckBoothDeps` and `shopBoothDeps` for listeners and debug openers, but assigns the raw functions to `window.__openDeckBoothForTest` / `window.__openShopBoothForTest`, so calling them with no arguments throws at `boothCommon.js:36`. Bind those deps at exposure time and align the existing vitest to exercise the zero-arg API.

## Acceptance Criteria

- `window.__openDeckBoothForTest()` called with **no arguments** does not throw and shows `#lobby` (removes `.hidden`), clears the lobby-menu dismissed flag, and reveals the deck editor panel (`#deck-editor` not `.hidden`).
- `window.__openShopBoothForTest()` called with **no arguments** does not throw and shows `#lobby`, clears the dismissed flag, and reveals the card shop panel (`#card-shop` not `.hidden`).
- `game/client/test/lobby-menu-dismiss.test.js` exercises the hooks with zero args (not by passing a manual deps object).
- `pnpm test:quick` from `game/` passes.

## Technical Specs

- `game/client/main.js` — replace the raw assignments near the other capture hooks:
  - `window.__openDeckBoothForTest = () => openDeckBooth(deckBoothDeps);`
  - `window.__openShopBoothForTest = () => openShopBooth(shopBoothDeps);`
  - Reuse the existing `deckBoothDeps` / `shopBoothDeps` objects already passed to `registerDeckBoothListener`, `registerShopBoothListener`, and the `createRequestDebug*BoothOpener` helpers (~lines 1212–1227). Do not change `boothCommon.js`, `boothDeck.js`, or `boothShop.js`.
- `game/client/test/lobby-menu-dismiss.test.js` — update the `__openDeckBoothForTest and __openShopBoothForTest show #lobby when wired through main` case to call each hook with no args after `dismissGameLobby()`, and assert lobby visibility plus the respective booth panel visibility (mirror the `dispatchBoothAction` assertions earlier in the same file).

## Verification: code
