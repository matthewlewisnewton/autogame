# Fix Launch Bay ready-up client/server desync on deck rejection

`launchBoothReadyUp()` currently sets `isReady = true` and logs `[launchBooth] ready-up via booth` before the server runs `validateDeck`. When the deck is invalid the server rejects ready (`player.ready = false`) but the client can briefly (or persistently if `LOBBY_UPDATE` is missed) believe it is ready. Stop optimistic ready promotion and only treat the player as ready after the server confirms via `LOBBY_UPDATE`, while still preventing duplicate `playerReady(true)` spam.

## Acceptance Criteria

- Calling `launchBoothReadyUp()` (or `window.__launchReadyUpForTest()`) with an invalid deck: after `DECK_ERROR` and the following `lobbyUpdate`, `window.__AUTOGAME_HARNESS_STATE__().isReady` (or equivalent exposed ready flag) is `false`.
- A second Launch Bay interact before `LOBBY_UPDATE` does not emit a second `playerReady(true)` (idempotency preserved via a pending flag or equivalent).
- When the server accepts ready (`lobbyUpdate` shows `me.ready === true`), local `isReady` becomes `true` and `[launchBooth] ready-up via booth` / `LAUNCH_READY_EVENT` fire only on confirmed success—not on emit alone.
- `game/client/test/launchBooth.test.js` covers the new pending/confirmed-ready helper logic; `game/client/test/main.test.js` covers the socket rejection path (invalid deck → `isReady` stays false).

## Technical Specs

- **`game/client/launchBooth.js`** — Extend `shouldLaunchReadyUp(currentIsReady, launchReadyPending)` (or add a sibling helper) so ready-up is blocked when `isReady` is true **or** a launch ready request is already in flight.
- **`game/client/main.js`** — In `launchBoothReadyUp()`:
  - Remove unconditional `isReady = true` before server ack.
  - Track `launchReadyPending` (module-level boolean): set on emit, clear on `DECK_ERROR` or when `LOBBY_UPDATE` sets `isReady` from `me.ready`.
  - Move `console.log('[launchBooth] ready-up via booth')` and `LAUNCH_READY_EVENT` dispatch to the success path (e.g. when `LOBBY_UPDATE` transitions local `isReady` to `true` after a pending launch ready).
- **`game/client/socketHandlers/lobbyHandlers.js`** — In `DECK_ERROR` handler: set `ctx.isReady = false` and clear launch-ready pending. Ensure `LOBBY_UPDATE` handler (~line 304) continues syncing `ctx.isReady = me.ready` and clears pending when `me.ready` is known.
- **`game/client/test/launchBooth.test.js`** — Unit tests for updated `shouldLaunchReadyUp` / pending behavior.
- **`game/client/test/main.test.js`** — Integration-style test: `__launchReadyUpForTest()` then `deckError` + `lobbyUpdate` with `ready: false` leaves `isReady` false and does not leave pending set.

## Verification: code
