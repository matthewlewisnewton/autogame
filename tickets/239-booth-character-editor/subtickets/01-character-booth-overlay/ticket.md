# Character booth in-hub overlay

Add a dedicated in-hub character-edit screen (separate from the Account overlay)
that reuses the existing cosmetic editor controls and `cosmetic-preview.js` live
3D preview. The overlay can be opened and closed programmatically; booth
interaction wiring lands in sub-ticket 02.

## Acceptance Criteria

- `#character-booth-overlay` exists in the DOM with a close control, a preview
  `<canvas>`, and the full cosmetic editor controls already present in the
  Account overlay's Character section: body color swatches, accent color
  swatches, body shape select (`box`/`cylinder`/`cone`/`capsule`), hat list, and
  all six proportion sliders.
- Opening the overlay syncs controls from the cached account cosmetic
  (`getAccountCosmetic()`), starts `openPreview(canvas, cosmetic)` from
  `cosmetic-preview.js`, and removes the `hidden` class. Closing stops the
  preview via `closePreview()`, hides the overlay, and is idempotent.
- Changing any control updates the booth preview canvas via
  `updatePreview({ ...cosmeticSelection })` (same live-preview behavior as the
  Account overlay).
- **Save character** in the booth calls `patchProfile({ cosmetic })` with the
  current selection; on success it updates `gameState.players[myId].cosmetic`
  from `getAccountCosmetic()` and calls `setGameStateRef(gameState)` so the hub
  avatar picks up the saved cosmetic on the next render tick.
- Save errors surface in a visible `#character-booth-cosmetic-error` line (not
  silent failure).
- A test/debug export `window.openCharacterBooth` / `window.closeCharacterBooth`
  exists so later sub-tickets and tests can drive the overlay without walking to
  the booth anchor.

## Technical Specs

- `game/client/index.html` — add `#character-booth-overlay` (modal pattern
  matching `#account-overlay`): close button, title, preview canvas
  (`#character-booth-preview-canvas`), cosmetic controls mirroring
  `#cosmetic-section` in `#account-overlay`, save button
  (`#character-booth-save-btn`), error line (`#character-booth-cosmetic-error`).
- `game/client/style.css` — style the overlay (semi-opaque backdrop so the hub
  remains visible behind it; reuse existing `settings-section` /
  `cosmetic-swatches` / `cosmetic-proportions` patterns).
- New `game/client/characterBooth.js` — `openCharacterBooth()` /
  `closeCharacterBooth()` lifecycle; wire close button and backdrop click;
  initialize cosmetic controls (swatches, shape select, hat list, proportion
  sliders) against the booth overlay root; reuse the shared `cosmeticSelection`
  state and palette constants (extract small shared helpers from `main.js` into
  e.g. `cosmeticForm.js` if needed so Account and booth overlays do not
  duplicate logic).
- `game/client/main.js` — import and expose `openCharacterBooth` /
  `closeCharacterBooth` on `window`; keep Account overlay behavior unchanged.
- `game/client/cosmetic-preview.js` — no API changes expected; booth passes its
  own canvas element.

## Verification: code
