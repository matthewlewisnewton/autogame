# 03 — Client booth confirm dialog and paid save wiring

Wire the character booth Save flow to the paid server socket: show a confirm step
with the configured price before charging, route appearance saves through
`applyAppearanceChange`, and keep hat-only saves free via the existing profile
path or the server's free branch.

## Acceptance Criteria

- When the booth selection has appearance-field changes vs the saved account
  cosmetic, clicking Save opens a confirm step that shows the price from
  `APPEARANCE_CHANGE_COST` (use `formatCurrencyPrice` for display). Cancel
  aborts without emitting save/socket traffic.
- When only the hat changed (or nothing changed), Save does **not** show a price
  confirm for appearance; hat-only save proceeds without charging (may still use
  `patchProfile` or the socket free branch — must not deduct gold).
- Paid save emits `applyAppearanceChange` with the booth cosmetic payload; on
  `appearanceChanged` the booth closes or refreshes from account state, updates
  local `gameState.players[myId].cosmetic`, and refreshes displayed currency.
- On `appearanceError` with `insufficient_gold` / affordability reason, the booth
  error line shows a clear message (include required price). Save button re-enables.
- Save button label or adjacent hint reflects cost when appearance fields are dirty
  (e.g. `Save character (25 money)` vs plain `Save character` for hat-only).
- `game/client/test/characterBooth.test.js` covers: confirm shown for appearance
  edit; not shown for hat-only; socket emit on confirm; error surfacing.

## Technical Specs

- `game/client/index.html` — optional lightweight confirm markup inside
  `#character-booth-modal` (e.g. hidden `#character-booth-confirm` block with
  message + Confirm/Cancel buttons). A small in-modal confirm is preferred over
  `window.confirm` for testability.
- `game/client/style.css` — minimal styles for the confirm block if added.
- `game/client/characterBooth.js`:
  - Import `APPEARANCE_CHANGE_COST`, `hasAppearanceFieldChanges`,
    `formatCurrencyPrice`.
  - Compare `selection` to `getAccountCosmetic()` to decide paid vs free path.
  - Replace direct `patchProfile({ cosmetic })` for appearance changes with
    socket `applyAppearanceChange` (inject `getSocket` already in deps).
  - Implement confirm/cancel handlers; disable Save while request is in flight.
- `game/client/main.js`:
  - Register `appearanceChanged` / `appearanceError` socket listeners (near
    existing `hatUnlocked` / `hatError` handlers).
  - Update `player.currency` / HUD on `appearanceChanged`; forward errors to
    `showBoothCosmeticError` when booth is open.
- `game/client/test/characterBooth.test.js` — extend mocks for socket emit and
  confirm DOM; add cases listed in acceptance criteria.

## Verification: code
