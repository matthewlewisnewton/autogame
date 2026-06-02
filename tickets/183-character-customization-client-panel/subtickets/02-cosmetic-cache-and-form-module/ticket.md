# 02 — Cosmetic profile cache & form helper module

Load and cache the account `cosmetic` from `GET /api/me`, extend `patchProfile`
to round-trip cosmetic updates, and add a testable `cosmetic-form.js` module
that reads/writes the panel controls and drives the preview element styles.

## Acceptance Criteria
- `loadAccountSettings` stores `data.cosmetic` (with server defaults when
  absent) in a client cache; `getCosmetic()` returns the current
  `{ bodyColor, accentColor, bodyShape, hat }` object.
- `patchProfile` accepts `{ cosmetic: partial }`, sends it on
  `PATCH /api/me/profile`, and on success updates `cachedProfile.cosmetic` from
  the response body.
- `game/client/cosmetic-form.js` exports (names may vary slightly but behavior
  must match):
  - `BODY_SHAPES`, `DEFAULT_COSMETIC`, `BODY_COLOR_PALETTE` (preset swatch hex
    list, aligned with server defaults).
  - `syncCosmeticForm(root, cosmetic)` — sets swatch/shape `aria-pressed` and
    accent `<input type="color">` value from a cosmetic object.
  - `readCosmeticFormState(root)` — returns `{ bodyColor, accentColor,
    bodyShape }` from current control values.
  - `buildCosmeticPatchPayload(root)` — same fields for PATCH body.
  - `applyCosmeticToPreviewElement(previewEl, cosmetic)` — sets
    `data-body-shape`, background/accent styles on `#cosmetic-preview` (and is
    safe if `previewEl` is null).
- Unit tests in `game/client/test/cosmetic-form.test.js` cover sync, read,
  patch payload build, and preview style application for each shape.

## Technical Specs
- `game/client/settings.js`:
  - Extend `cachedProfile` type to include `cosmetic`.
  - In `loadAccountSettings`, assign `cosmetic` from `data.cosmetic` or
    `DEFAULT_COSMETIC`.
  - In `patchProfile`, merge returned `cosmetic` into cache; return it on
    success.
  - Export `getCosmetic()` and `DEFAULT_COSMETIC` (re-export from cosmetic-form
    or duplicate once — prefer single source in `cosmetic-form.js`).
- `game/client/cosmetic-form.js` (new): pure DOM helpers; import
  `DEFAULT_COSMETIC` values matching `game/server/cosmetic.js`
  (`#4f9dde`, `#f2c94c`, `box`, shapes list).
- `game/client/test/cosmetic-form.test.js` (new): JSDOM tests mirroring
  `settings-layout.test.js` style.

## Verification: code
