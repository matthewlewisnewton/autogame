# Client tests: dismiss stays dismissed and hub presence intact

Add focused unit coverage for the lobby-menu dismiss guard and confirm remote squadmate avatars still reconcile while the menu is hidden.

## Acceptance Criteria

- New vitest coverage (in `game/client/test/lobby-menu-dismiss.test.js` or a dedicated `main.test.js` describe block) proves:
  - Hub lobby join starts with `#lobby` hidden / `lobbyMenuDismissed === true`.
  - Calling `dismissGameLobby()` then firing a lobby-phase `STATE_UPDATE` via `window.__triggerSocketEvent` leaves `#lobby` hidden.
  - `HUB_PRESENCE_UPDATE` / `applyHubPresence` while dismissed does not call `showGameLobby()` or remove `.hidden` from `#lobby`.
  - Deck or shop booth open (`window.__openDeckBoothForTest` / `window.__openShopBoothForTest` or `dispatchBoothAction`) shows `#lobby` and clears the dismissed flag.
- Existing `game/client/test/hub-presence-avatars.test.js` still passes (remote player mesh built after hub presence merge during lobby phase).
- `pnpm test:quick` (or `pnpm test` from `game/`) passes with the new tests.

## Technical Specs

- `game/client/test/lobby-menu-dismiss.test.js` (preferred new file): mirror DOM fixture setup from `questBooth.test.js` / `hub-presence-avatars.test.js`; import `main.js`, drive `__setGameState`, `__triggerSocketEvent`, booth helpers, and assert on `#lobby.classList`, `__getLobbyMenuDismissed()`, and `__AUTOGAME_HARNESS_STATE()`.
- `game/client/main.js`: export any missing test hooks needed by the suite (e.g. `__getLobbyMenuDismissed`, trigger helper for `HUB_PRESENCE_UPDATE` if not already reachable).
- Update `game/client/scripts/test-hub-lobby-visible.mjs` expectations if it still assumes `#lobby` visible on join (lobby should start hidden; canvas and booth prompt remain the assertions).

## Verification: code
