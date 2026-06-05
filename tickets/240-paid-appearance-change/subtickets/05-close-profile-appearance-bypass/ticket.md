# 05 — Close profile appearance bypass

The paid booth socket path from sub-tickets 02–04 is complete, but the Account
overlay still exposes body color, accent, shape, and proportions controls whose
`Save character` button calls free `PATCH /api/me/profile`. Close this exploit by
enforcing server-side rejection of paid appearance writes on the HTTP profile route
and limiting the Account UI to hat-only cosmetic edits (appearance changes belong
in the in-hub character booth).

Depends on completed sub-tickets **02–04**.

## Acceptance Criteria

- `PATCH /api/me/profile` with a `cosmetic` payload that changes any paid appearance
  field (`bodyColor`, `accentColor`, `bodyShape`, `modelId`, or any `proportions`
  key) returns **400** with a clear error (e.g. appearance changes require the
  character booth); account cosmetic and player currency on disk are unchanged.
- `PATCH /api/me/profile` with a **hat-only** cosmetic change (no appearance-field
  delta per `appearanceFieldsChanged`) still succeeds for free, same as before.
- Account overlay no longer exposes paid appearance controls (body color, accent
  color, body shape, proportions sliders); it keeps hat selection and preview.
  `cosmetic-save-btn` saves **hat only** via `patchProfile({ cosmetic: { hat } })`.
- A short hint in the Account character section directs players to the in-hub
  character booth for paid appearance edits (uses `appearanceChangeCost` label).
- Regression tests in `game/server/test/account.test.js` prove paid appearance
  fields cannot be changed via `/api/me/profile` for free; hat-only profile update
  test remains or is added.
- Existing vitest suites pass (`pnpm test:quick`).

## Technical Specs

- **`game/server/account.js`** — in `PATCH /api/me/profile`, when `cosmetic` is
  present: load current user cosmetic, merge/backfill, and call
  `appearanceFieldsChanged(current, requested)` from `./cosmetic`. If true, return
  400 before `updateProfile`. If false (hat-only or no appearance delta), proceed
  with existing `updateProfile` flow.
- **`game/server/cosmetic.js`** — no changes expected; reuse exported
  `appearanceFieldsChanged` and `backfillCosmetic`.
- **`game/client/index.html`** — remove paid appearance controls from
  `#cosmetic-section` (body/accent swatches, shape select, proportions block);
  keep preview canvas, hat list, error line, and save button; add booth hint text.
- **`game/client/main.js`** — simplify account cosmetic wiring: drop DOM refs and
  event listeners for removed controls; update `cosmeticSaveBtnEl` handler to send
  only `{ cosmetic: { hat: cosmeticSelection.hat } }`; keep `syncCosmeticForm` /
  preview working for hat + read-only preview of current appearance.
- **`game/client/settings.js`** — no API change required; `patchProfile` JSDoc may
  note that cosmetic profile patches are hat-only.
- **`game/server/test/account.test.js`** — replace or invert tests that currently
  expect free appearance updates via profile (`updates cosmetic and returns it`,
  `updates cosmetic modelId and proportions`); add explicit rejection cases for
  each paid field class and a passing hat-only case.

Do not modify booth socket charging logic (sub-tickets 02–04).

## Verification: code
