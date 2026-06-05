# 03 — Client booth confirm and wire

Wire the character booth Save flow to the paid server socket path from sub-ticket
**02**, and show a confirm dialog before any save that will cost gold. Hat-only
changes skip the confirm and remain free. The Account overlay cosmetic save keeps
using free `patchProfile` — only the in-hub booth uses the charged path.

Depends on sub-ticket **02**.

## Acceptance Criteria

- Character booth Save emits `applyAppearance` (or the event name chosen in 02)
  instead of `patchProfile` when saving from `characterBooth.js`.
- Before a **paid** save (appearance fields differ from the account cosmetic),
  the client shows a confirm dialog stating the gold cost (use
  `appearanceChangeCost` from `GET /api/me` / `APPEARANCE_CHANGE_COST` and
  `formatCurrencyPrice`). User cancel aborts the save with no socket emit.
- Hat-only saves (appearance unchanged, only `hat` differs) proceed without confirm
  and without charging.
- On `appearanceApplied`, update cached cosmetic, sync the booth form, refresh
  local `gameState.players[myId].cosmetic`, and update displayed currency.
- On `appearanceError`, surface the server reason in
  `#character-booth-cosmetic-error` (e.g. insufficient gold).
- Save button or a nearby hint shows the appearance-change price when the booth is
  open (e.g. “Appearance edits: 25 gold” using theme currency label).
- Account overlay (`cosmeticSaveBtnEl` in `main.js`) still calls free
  `patchProfile` — unchanged behavior.
- Update `game/client/test/characterBooth.test.js` to mock the socket path and
  cover confirm-gated paid save vs free hat-only save.

## Technical Specs

- **`game/client/characterBooth.js`** — replace `patchProfile` in
  `saveCharacterBooth()` with socket emit + await success/error events; add
  `appearanceFieldsChanged(accountCosmetic, selection)` helper (mirror server
  field set); call `window.confirm` (or a small in-overlay confirm if already
  used elsewhere) only when a paid edit is pending.
- **`game/client/main.js`** — register `appearanceApplied` / `appearanceError`
  socket listeners that delegate to booth helpers (`showBoothCosmeticError`,
  currency refresh) similar to existing `hatUnlocked` / `hatError` wiring.
- **`game/client/settings.js`** — cache `appearanceChangeCost` from `/api/me` if
  not already available to booth deps.
- **`game/client/index.html`** — optional cost hint element near
  `#character-booth-save-btn` if needed for the price display criterion.
- **`game/client/test/characterBooth.test.js`** — extend mocks for socket emit and
  confirm behavior.

## Verification: code
