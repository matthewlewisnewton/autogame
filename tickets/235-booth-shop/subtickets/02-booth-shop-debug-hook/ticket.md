# `?booth=shop` debug hook

Add a localhost-only URL query hook so harnesses and QA can open the card shop without
walking to the Commerce shop anchor. Depends on `openShopBooth()` from sub-ticket 01.

## Acceptance Criteria

- `?booth=shop` in the page URL is read once at load (same host allowlist pattern as
  `debugScenario` / `?booth=deck`: `localhost`, `127.0.0.1`, `::1` only).
- After the player reaches lobby phase via `lobbyJoined` (hub rendered,
  `gamePhase === 'lobby'`), the hook calls `openShopBooth()` exactly once per page load
  when the param is `shop`.
- On disallowed hostnames or when the param is missing / not `shop`, the hook is a
  no-op (normal booth walk-up + interact still required).
- Existing 2D shop behavior is unchanged: `main.test.js` shop tab switching and sell
  rendering tests still pass; opening via the hook does not break manual `#lobby-tab-shop`
  clicks or booth walk-up interact.
- `pnpm test` passes, including tests for allowlist gating and one-shot open behavior
  (mock `lobbyJoined` / call the extracted hook function directly).

## Technical Specs

- `game/client/boothShop.js` — export `shouldOpenDebugShopBooth(param, hostname)` and
  `createRequestDebugShopBoothOpener({ param, hostname, openShopBooth, deps })` mirroring
  `boothDeck.js` (`shouldOpenDebugBooth` / `createRequestDebugBoothOpener`); gate on
  `param === 'shop'`.
- `game/client/main.js` — reuse the existing `debugBooth` query param parsed at load;
  instantiate `requestDebugShopBoothOpen` alongside `requestDebugBoothOpen` (deck) and
  invoke it from the hub lobby join path (e.g. `applyLobbyJoinedData` after
  `renderHubScene`) with a separate one-shot flag so `?booth=deck` and `?booth=shop`
  do not double-fire incorrectly.
- `game/client/test/boothShopDebug.test.js` (or extend `boothShop.test.js`) — assert
  gating (`shouldOpenDebugShopBooth('shop', 'localhost')` true; `'deck'` / wrong host
  false) and that the hook calls `openShopBooth` once when enabled.
- Expose `window.__requestDebugShopBoothOpenForTest` for harness/tests.
- `launchBooth.js` `getBoothDebugHook('?booth=shop')` already returns `'shop'`; no
  change required unless tests need a shared constant.
- No server or `index.html` changes required.

## Verification: code
