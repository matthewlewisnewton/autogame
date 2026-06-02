# 03 — Live cosmetic preview wiring

Connect the Account overlay controls to the preview viewport so changing body
color, accent, or shape updates `#cosmetic-preview` immediately without saving.
Opening the overlay syncs controls from `getCosmetic()`.

## Acceptance Criteria
- Clicking a body-color swatch or shape button updates selection UI
  (`aria-pressed`) and refreshes `#cosmetic-preview` via
  `applyCosmeticToPreviewElement`.
- Changing `#cosmetic-accent-color` updates the preview on `input` events.
- `openAccountOverlay()` calls `syncCosmeticForm` with `getCosmetic()` then
  applies the preview once (no save required to see current profile).
- No network calls on control change (preview is local only).
- `game/client/test/main.test.js` (or a focused test) verifies
  `openAccountOverlay` + a swatch click changes preview `data-body-shape` or
  inline styles on `#cosmetic-preview`.

## Technical Specs
- `game/client/main.js`:
  - Import `syncCosmeticForm`, `readCosmeticFormState`,
    `applyCosmeticToPreviewElement` from `./cosmetic-form.js`.
  - Cache element refs: `#cosmetic-preview`, `#cosmetic-body-colors`,
    `#cosmetic-accent-color`, `#cosmetic-body-shapes`.
  - In `openAccountOverlay`, after `syncAccountForm()`, run cosmetic sync +
    preview apply.
  - Add delegated or per-control listeners that call
    `applyCosmeticToPreviewElement(previewEl, readCosmeticFormState(accountOverlay))`.
- Do **not** implement Save or `patchProfile` cosmetic persistence here (sub-ticket 04).

## Verification: code
