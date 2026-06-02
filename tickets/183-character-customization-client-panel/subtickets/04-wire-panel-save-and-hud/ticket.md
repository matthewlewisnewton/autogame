# 04 — Wire panel, save, persistence, and HUD portrait

Connect the Appearance controls to client state, the live preview, and
`PATCH /api/me/profile`. On open, populate pickers from `getCosmetic()`; on
Save, persist and show errors. Reflect the saved look on the Vanguard HUD
portrait so customization is visible while playing (in-run), without changing
world avatar meshes (ticket 182).

## Acceptance Criteria

- Opening the account overlay (`openAccountOverlay`) selects the current shape swatches and colors from `getCosmetic()` and calls `updateCosmeticPreview` with those values.
- Changing any shape or color control updates selected UI state and calls `updateCosmeticPreview` immediately (live preview).
- Clicking `#cosmetic-save-btn` calls `patchProfile({ cosmetic: { bodyColor, accentColor, bodyShape } })` with the draft selection; button disables during the request.
- On success: clears `#cosmetic-error`, leaves overlay open or closes per existing account UX; cached cosmetic matches server response; a full page reload still shows the same choices via `GET /api/me`.
- On failure (`result.error` or HTTP 400): shows message in `#cosmetic-error` and does not update `getCosmetic()`.
- `#character-frame` (Vanguard HUD portrait) reflects saved `bodyColor` / `accentColor` (background/border) and indicates `bodyShape` (e.g. `border-radius` or data attribute) for the local player after login and after a successful save.
- Panel is reachable from the toolbar account button in lobby browser and while in a lobby (toolbar not hidden); no duplicate customization UI in the dungeon HUD card area.
- Tests in `game/client/test/main.test.js` (or dedicated module test): mock `patchProfile` / `getCosmetic`; assert save builds correct payload; assert `syncCosmeticForm` (or equivalent) reads cached cosmetic into controls.

## Technical Specs

- **File**: `game/client/main.js`
  - Import `initCosmeticPreview`, `updateCosmeticPreview` from `./cosmetic-preview.js`.
  - Add `syncCosmeticForm()` mirroring `syncAccountForm()`: read `getCosmetic()`, set selected shape/swatch classes and color inputs, refresh preview.
  - Call `initCosmeticPreview` once (lazy on first `openAccountOverlay`) and `syncCosmeticForm` inside `openAccountOverlay`.
  - Wire click handlers on shape buttons and swatches; custom color inputs update draft state + preview.
  - `#cosmetic-save-btn` handler: compare draft to `getCosmetic()` — no-op if unchanged; else `patchProfile({ cosmetic: draft })`.
  - Add `updateVanguardPortraitCosmetic(cosmetic)` (or inline) called after login (`loadAccountSettings`), after successful cosmetic save, and when `myId` is set — updates `#character-frame` styles from `getCosmetic()`.
- **File**: `game/client/style.css`
  - Optional `[data-body-shape]` rules on `#character-frame` for silhouette hints.
- **File**: `game/client/test/main.test.js`
  - Extend account-overlay DOM fixture with new ids; test save emit and portrait update helper.

## Verification: code
