# 05 — Wire full revalidation pipeline, verify script, and findings template

Integrate sub-tickets **01–04** into the sunken-canyon `--steps full` playthrough, extend assertions/verification, and update findings rendering. No artifact regeneration in this sub-ticket — wiring and verify-script only.

## Acceptance Criteria

- `harness/validate/playthrough.mjs` sunken-canyon full run order:
  1. auth → hub/deploy → god-mode mid-combat (existing floor probes)
  2. `runSlowBurnExercise` + `runPurifyingPulseExercise` + `runWindupCardExercise`
  3. `runCanyonTelepipeNewSortieStep` (re-enable god-mode / `near-adds` scenario afterward so boss path still works)
  4. boss dormant/active (with **01** UI/visual probes) → defeat boss → victory
- `buildAssertions(summary, preset)` adds booleans (names exact):
  - `bossEncounterUiVisible`
  - `bossDistinctFromAdds`
  - `slowBurnMutuallyExclusive`
  - `healCleanseApplied`
  - `windupTelegraphActive`
  - `telepipeVitalsPreserved`
  - `cardChargesResetOnNewSortie`
  - Existing four boss/victory assertions unchanged.
- `summary.ok === true` only when **all** assertions are true; failures set `summary.error` with probe detail (never fake green).
- `harness/validate/verify-sunken-canyon-artifacts.mjs` requires the seven new assertion keys in `run-summary.json` and optional PNGs `08`–`12` when present in summary screenshots list.
- `harness/validate/lib/findings.mjs` documents every assertion, new-content probe blocks, floor alignment (existing), console errors, and a **New content exercise** section referencing screenshot filenames.
- `writeFullArtifacts` merges card-exercise and telepipe probes into `probes.json` alongside dormant/active/victory/floorAlignment.
- `cd game && pnpm test:quick` passes.
- Do **not** run `pnpm validate:sunken-canyon` (sub-ticket **06**).

## Technical Specs

- **Edit:** `harness/validate/playthrough.mjs` — import card/telepipe helpers; extend `collectScreenshots`, `writeFullArtifacts`, `buildAssertions`.
- **Edit:** `harness/validate/verify-sunken-canyon-artifacts.mjs` — `REQUIRED_ASSERTION_KEYS` += seven new keys; optional PNG checks for `08-slow-burn-mutual-exclusive.png` through `12-telepipe-after.png`.
- **Edit:** `harness/validate/lib/findings.mjs` — sections for boss UI, visual identity, status cards, heal/cleanse, wind-up, telepipe vitals/charges.
- **Edit:** `harness/validate/presets/sunken-canyon.mjs` — optional telepipe/card scenario name constants.
- **Depends on:** passed sub-tickets **01**, **02**, **03**, **04**.

## Verification: code
