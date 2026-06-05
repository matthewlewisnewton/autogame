# `?booth=deck` debug hook

Add a localhost-only URL query hook so harnesses and QA can open the deck terminal
without walking to the Commerce deck anchor. Depends on `openDeckBooth()` from
sub-ticket 01.

## Acceptance Criteria

- `?booth=deck` in the page URL is read once at load (same host allowlist pattern
  as `debugScenario`: `localhost`, `127.0.0.1`, `::1` only).
- After the player reaches lobby phase via `lobbyJoined` (hub rendered,
  `gamePhase === 'lobby'`), the hook calls `openDeckBooth()` exactly once per page
  load when the param is `deck`.
- On disallowed hostnames or when the param is missing / not `deck`, the hook is a
  no-op (normal booth walk-up + interact still required).
- Existing 2D deck editor behavior is unchanged: `main.test.js` cases for
  `renderDeckEditor()`, lobby tab switching, and ready-button deck validation
  still pass; opening via the hook does not break manual tab clicks.
- `pnpm test` passes, including tests for allowlist gating and one-shot open
  behavior (mock `lobbyJoined` / call the extracted hook function directly).

## Technical Specs

- `game/client/main.js` — parse `booth` from `URLSearchParams`; store
  `debugBooth` + `debugBoothAllowed` flags parallel to `debugScenario`. Invoke
  `openDeckBooth()` from `applyLobbyJoinedData` (lobby-phase branch, after
  `renderHubScene`) and/or a small `requestDebugBoothOpen()` helper guarded by a
  `debugBoothRequested` boolean so reconnects do not re-open repeatedly.
- `game/client/boothDeck.js` — optionally export `shouldOpenDebugBooth(param,
  hostname)` for pure unit tests of gating logic.
- `game/client/test/boothDeck.test.js` (extend) or `game/client/test/boothDeckDebug.test.js`
  — assert gating and that the hook calls `openDeckBooth` once when enabled.
- Expose `window.__openDeckBoothForTest = openDeckBooth` (or re-export) for
  Playwright/smoke scripts if not already exported from 01.
- No server or `index.html` changes required.

## Verification: code
