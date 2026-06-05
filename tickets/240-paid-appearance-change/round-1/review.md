## Runtime health

The captured run loads cleanly. `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only Vite connection lines and two 409 resource responses, with no `pageerror` or `[fatal]` entries from game code. The smoke capture reached lobby and gameplay with a canvas, connected socket state, visible HUD, movement, and dodge cooldown probes.

## Acceptance criteria findings

1. Appearance changes deduct gold atomically: partially met, but not robustly. The new `applyAppearance` socket handler charges `APPEARANCE_CHANGE_COST`, saves player currency before updating account cosmetic, rejects insufficient funds, refunds when `updateProfile` returns an error, and leaves charged-but-unchanged state on crash-safety simulation. However, the legacy Account overlay still exposes the same body color, accent color, body shape, and proportions controls via `#cosmetic-save-btn`, and its click handler still calls `patchProfile({ cosmetic })`. The `/api/me/profile` route still accepts `cosmetic` and calls `updateProfile` directly with no currency check or persistence ordering. That is a free appearance-edit exploit outside the paid socket path.

2. Price in config: met. `APPEARANCE_CHANGE_COST` lives in `game/shared/constants.json`, is exported through `game/server/config.js` and `game/client/config.js`, and is returned from `GET /api/me` as `appearanceChangeCost`.

3. Client confirm dialog: met for the booth path. `game/client/characterBooth.js` detects non-hat appearance changes, formats the configured price, prompts with `window.confirm`, and skips the prompt for hat-only changes.

4. Tests including insufficient funds and crash safety: met for the new socket path. `game/server/test/appearance_change_persistence.test.js` covers insufficient funds, currency-before-cosmetic persistence ordering, crash after currency save, refund on profile failure, hat-only free changes, and currency-save failure. `game/client/test/characterBooth.test.js` covers paid confirm, cancel, hat-only no-confirm, and error display. Coverage log reports 83 test files and 1589 tests passed.

## Design and foundation consistency

The charged booth path fits the lobby/economy design: appearance customization is an in-hub account customization flow, while the core multiplayer run loop, rendering, sockets, movement, and HUD continue to work in the captured smoke run. No debug scenario was added or changed for this ticket; the existing `?booth=character` helper is localhost-gated and only opens the booth after normal hub lobby entry.

## Code quality

The socket implementation is reasonably scoped and uses server authority for validation, affordability, persistence, and live cosmetic sync. The blocking issue is integration with pre-existing profile cosmetic mutation: both the client Account UI and the HTTP profile route remain as a second write surface for the same paid fields, bypassing the new charge entirely.

## Remaining gaps

1. Free appearance-edit path still exists through Account profile cosmetic save. The account overlay’s `Save character` button posts `cosmetic` via `patchProfile`, and `PATCH /api/me/profile` persists it through `updateProfile` without charging currency, so players can bypass the paid booth path for body/proportion/color changes.

VERDICT: FAIL
