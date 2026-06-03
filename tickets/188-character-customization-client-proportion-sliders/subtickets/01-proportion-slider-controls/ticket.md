# Proportion slider controls in the customization panel

Add one range slider per body-proportion dimension to the Character section of
the Account overlay, wired to the in-progress cosmetic selection, clamped to the
exact server ranges, and included in the saved profile payload so the values
persist and (via the existing in-run apply path) render on the avatar.

## Acceptance Criteria
- The Character section (`#cosmetic-section`) contains exactly six `<input type="range">`
  sliders, one per proportion key: `height`, `headSize`, `torsoWidth`,
  `armLength`, `legLength`, `shoulderWidth`. Each slider carries a stable id and a
  `data-prop` attribute whose value is the proportion key string **verbatim**
  (case-sensitive, no alias/rename).
- Each slider's `min`/`max` equal the server clamp range for that key — `height`,
  `armLength`, `legLength` = `0.8`–`1.2`; `headSize`, `torsoWidth`,
  `shoulderWidth` = `0.7`–`1.3` — with default value `1.0` and `step` `0.01`.
- Each slider shows a live numeric readout of its current value, and moving a
  slider updates `cosmeticSelection.proportions[key]` (clamped into the key's
  range) and the readout.
- `syncCosmeticForm()` sets every slider position and readout from the account's
  saved `cosmetic.proportions` (defaulting to `1.0` for any missing key) each
  time the overlay opens.
- Clicking "Save character" sends a `cosmetic.proportions` object containing all
  six keys to `PATCH /api/me/profile`; after a successful save the client's
  cached cosmetic includes the saved `proportions`.
- The client-side `DEFAULT_COSMETIC` and `normalizeCosmetic()` in `settings.js`
  include `proportions` (six keys), backfilling missing keys to `1.0` and
  clamping numeric values to the same per-key ranges.
- No slider can emit a value outside the server clamp range, so the existing
  in-run avatar apply path (`applyLoadedModelCosmetic`) renders the saved
  proportions for self and peers without a reload.

## Technical Specs
- `game/client/index.html`: inside `#cosmetic-section`, add a labelled
  proportions group (e.g. a `#cosmetic-proportions` container) with six rows,
  each containing a label, an `<input type="range" id="cosmetic-prop-<key>"
  data-prop="<key>">`, and a value-readout `<span>`. Place it near the existing
  shape select / hat list. Mirror the markup style of the existing
  `gamepad-deadzone-slider` calibration row.
- `game/client/settings.js`: define a `PROPORTION_RANGES` constant mirroring
  `game/server/cosmetic.js` (the six keys + min/max + default 1.0). Extend
  `DEFAULT_COSMETIC` with `proportions` (all six keys = `1.0`) and extend
  `normalizeCosmetic()` to coerce/backfill `proportions`: each key numeric and
  clamped to its range, missing/invalid → `1.0`. Update the related JSDoc
  cosmetic typedefs to include `proportions`.
- `game/client/main.js`:
  - Add `proportions` (six keys = `1.0`) to the `cosmeticSelection` object.
  - Add a builder that, for each proportion key, configures the slider's
    `min`/`max`/`step`/value from `PROPORTION_RANGES` and attaches an `input`
    handler that clamps and writes `cosmeticSelection.proportions[key]`, updates
    the readout, and calls `refreshCosmeticPreview()`.
  - In `syncCosmeticForm()`, copy `getAccountCosmetic().proportions` into
    `cosmeticSelection.proportions` and set each slider + readout.
  - In the `cosmeticSaveBtnEl` click handler, add
    `proportions: { ...cosmeticSelection.proportions }` to the saved `cosmetic`.
- Do NOT change server files or the in-run avatar apply path — ticket 186/187
  already validate, persist, broadcast, and apply `proportions`.

## Verification: code
