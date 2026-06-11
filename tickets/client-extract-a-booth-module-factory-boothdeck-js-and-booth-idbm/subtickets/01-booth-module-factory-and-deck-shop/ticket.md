# Add booth module factory and refactor deck/shop booths

Extract the duplicated lobby-tab booth pattern from `boothDeck.js` and `boothShop.js` into a shared `createBoothModule` factory. Both booth files become thin wrappers that instantiate the factory and re-export the same public API names (`openDeckBooth`, `registerDeckBoothListener`, etc.) so `main.js` and all existing tests keep working unchanged.

## Acceptance Criteria

- `game/client/boothCommon.js` exports `createBoothModule({ boothId, tab, renderDepKey })` that implements the shared logic currently duplicated in deck/shop: localhost-only `shouldOpenDebug`, one-shot `createRequestDebugOpener`, `openBooth` (`showGameLobby` → `setLobbyTab(tab)` → `renderDepKey()`), `isBoothAction` (matches `detail.action` or `detail.boothId`), and `registerBoothListener` with a per-module `listenerRegistered` guard.
- `boothDeck.js` and `boothShop.js` are thin instantiations of the factory (no duplicated implementation bodies); each file stays under ~25 lines.
- All public export names and signatures from `boothDeck.js` / `boothShop.js` are unchanged (`shouldOpenDebugBooth`, `createRequestDebugBoothOpener`, `openDeckBooth`, `registerDeckBoothListener`, and the shop equivalents).
- `main.js` imports are unchanged; no edits required unless an import path must point at a moved symbol.
- `pnpm test` passes, including `boothDeck.test.js`, `boothShop.test.js`, `boothDeckDebug.test.js`, `boothShopDebug.test.js`, and `lobby-menu-dismiss.test.js`.

## Technical Specs

**New file: `game/client/boothCommon.js`**

- Export `DEBUG_BOOTH_ALLOWED_HOSTS` constant (`['localhost', '127.0.0.1', '::1']`).
- Export `createBoothModule({ boothId, tab, renderDepKey })` returning an object with:
  - `shouldOpenDebug(param, hostname)` — `param === boothId && DEBUG_BOOTH_ALLOWED_HOSTS.includes(hostname)`.
  - `createRequestDebugOpener({ param, hostname, openFn, deps })` — one-shot opener gated by `shouldOpenDebug`.
  - `openBooth(deps)` — calls `deps.showGameLobby()`, `deps.setLobbyTab(tab)`, then `deps[renderDepKey]()`.
  - `isBoothAction(detail)` — `detail.action === boothId || detail.boothId === boothId`.
  - `registerBoothListener(deps)` — subscribes once to `BOOTH_ACTION_EVENT` from `boothPrompt.js`, calls `openBooth` when `isBoothAction` matches.
- Each `createBoothModule` call gets its own closure-scoped `listenerRegistered` flag (deck and shop listeners must remain independent).

**Refactor: `game/client/boothDeck.js`**

- `createBoothModule({ boothId: 'deck', tab: 'deck', renderDepKey: 'renderDeckEditor' })`.
- Re-export with existing names; `createRequestDebugBoothOpener` must still accept `{ param, hostname, openDeckBooth, deps }` (adapt the `openDeckBooth` key to the factory's `openFn` internally).

**Refactor: `game/client/boothShop.js`**

- Same pattern with `boothId: 'shop'`, `tab: 'shop'`, `renderDepKey: 'renderCardShop'`, and shop-prefixed export names.

**New file (optional but recommended): `game/client/test/boothCommon.test.js`**

- Unit-test factory behavior for a mock booth config: `shouldOpenDebug` gating, `openBooth` call order, `isBoothAction` matching, one-shot debug opener, and `registerBoothListener` ignoring non-matching booth ids.

**Do not change:** `launchBooth.js`, `questBooth.js`, or booth-specific integration tests beyond ensuring they still pass.

## Verification: code
