# 01 — Appearance change price and diff helper

Add a configurable gold price for character-booth appearance edits and a shared
helper that distinguishes paid appearance-field changes (body colors, shape,
model, proportions) from free hat-only swaps.

## Acceptance Criteria

- `APPEARANCE_CHANGE_COST` is a positive integer exported from `game/server/config.js` and mirrored in `game/client/config.js` (same pattern as `MEDIC_HEAL_COST`).
- A shared module exposes `hasAppearanceFieldChanges(baseline, proposed)` that returns `true` when any of `bodyColor`, `accentColor`, `bodyShape`, `modelId`, or `proportions` differ from `baseline`, and `false` when only `hat` (or nothing) changed.
- Proportion comparison is deep/key-wise (a single slider change counts as an appearance change).
- Unit tests cover: no change → `false`; hat-only change → `false`; each appearance field changing alone → `true`; mixed appearance + hat change → `true`.
- `pnpm test:quick` passes with the new tests.

## Technical Specs

- `game/server/config.js` — add `const APPEARANCE_CHANGE_COST = <non-zero int>` (e.g. `25`) and export it in `module.exports`.
- `game/client/config.js` — export matching `APPEARANCE_CHANGE_COST`.
- `game/shared/cosmeticAppearance.esm.js` — canonical ESM implementation:
  - export `APPEARANCE_FIELD_KEYS` (or equivalent constant list);
  - export `hasAppearanceFieldChanges(baseline, proposed)` using `backfill`-style defaults for missing sub-fields (normalize proportions object before compare).
- `game/shared/cosmeticAppearance.js` — CJS eval-bridge wrapper (same pattern as `boothZones.js` / `floorSampling.js`).
- `game/server/test/cosmetic_appearance.test.js` — vitest for the helper via the CJS bridge.
- `game/client/test/cosmeticAppearance.test.js` — mirror client import of the ESM module (or shared test re-export).

## Verification: code
