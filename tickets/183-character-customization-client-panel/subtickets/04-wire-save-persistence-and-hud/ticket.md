# 04 — Save, persistence, HUD portrait & in-run local cosmetic

Wire **Save appearance** to `PATCH /api/me/profile`, show validation errors,
refresh the Vanguard HUD portrait from the saved cosmetic, and keep the local
player's runtime `cosmetic` in sync when already connected.

## Acceptance Criteria
- `#cosmetic-save-btn` calls `patchProfile({ cosmetic: buildCosmeticPatchPayload(...) })`.
  - On success: clears `#cosmetic-error`, updates preview + HUD portrait from
    `getCosmetic()`, closes overlay optional (closing is OK if username save
    already does — at minimum stay open with success state is fine).
  - On failure: shows server `error` text in `#cosmetic-error` and does not
    update cache.
- After save + full page reload, opening Account shows the persisted colors/shape
  (proves `loadAccountSettings` round-trip).
- `updateVanguardPortrait()` (or a sibling `updateVanguardPortraitCosmetic()`)
  applies `getCosmetic()` to `#character-frame` / `#character-portrait` (border
  or fill using `bodyColor`, accent trim, `data-body-shape` for CSS shape).
- When `gameState.players[myId]` exists after save, its `cosmetic` matches
  `getCosmetic()` so ticket 182 can render without another profile fetch.
- Save with no changes is a no-op (no PATCH) or succeeds without error.
- Tests cover: successful PATCH payload shape, error display, HUD attribute
  update after save (JSDOM or main.test.js pattern).

## Technical Specs
- `game/client/main.js`:
  - `#cosmetic-save-btn` click handler; compare to `getCosmetic()` to skip noop.
  - Call `updateVanguardPortraitCosmetic()` from save success and existing
    `updateVanguardPortrait()` path after login/`loadAccountSettings`.
  - After successful save, if `myId` and `gameState?.players?.[myId]`, assign
    `gameState.players[myId].cosmetic = { ...getCosmetic() }`.
- `game/client/cosmetic-form.js`:
  - Add `applyCosmeticToCharacterFrame(frameEl, portraitEl, cosmetic)` for HUD
    (reuse preview styling rules where sensible).
- `game/client/style.css`:
  - `#character-frame[data-body-shape="…"]` / `#character-portrait` rules for
    box/cylinder/cone/capsule silhouettes using `bodyColor` and `accentColor`.
- `game/client/test/cosmetic-form.test.js` or `main.test.js`: save handler and
  HUD helper tests.

## Verification: code
