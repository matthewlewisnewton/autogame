# 04 — Wire spire-ascent full revalidation pipeline, verify script, and findings

Integrate sub-tickets **01–03** into the spire-ascent `--steps full` playthrough, extend assertions and artifact verification, and update findings rendering. No artifact regeneration in this sub-ticket — wiring and verify-script only.

## Acceptance Criteria

- `harness/validate/playthrough.mjs` adds `runsSpireAscentFull` (mirror `runsSunkenCanyonFull`) with run order:
  1. auth → hub/deploy → god-mode mid-combat (existing)
  2. `runSlowBurnExercise` + `runPurifyingPulseExercise` + `runWindupCardExercise`
  3. `runSpireAscentTelepipeNewSortieStep` (re-enable god-mode / `near-adds` scenario afterward so boss path still works)
  4. boss dormant/active (with **01** UI/visual probes) → defeat Summit Warden → victory
- `buildAssertions(summary, preset)` adds the seven new booleans for `spire-ascent` (same keys as sunken-canyon):
  - `bossEncounterUiVisible`
  - `bossDistinctFromAdds`
  - `slowBurnMutuallyExclusive`
  - `healCleanseApplied`
  - `windupTelegraphActive`
  - `telepipeVitalsPreserved`
  - `cardChargesResetOnNewSortie`
  - Existing four boss/victory assertions unchanged.
- Refactor `isSunkenCanyonPreset` into a shared helper (e.g. `isStageRevalidationPreset`) or add `isSpireAscentPreset` with identical assertion block — sunken-canyon behavior must not regress.
- `summary.ok === true` only when **all** assertions are true; failures set `summary.error` with probe detail (never fake green).
- `harness/validate/verify-spire-ascent-artifacts.mjs` requires all eleven assertion keys in `run-summary.json` and optional PNGs `08`–`12` when listed in summary screenshots.
- `harness/validate/lib/findings.mjs` documents every assertion, new-content probe blocks, console errors, and a **New content exercise** section for spire-ascent referencing screenshot filenames.
- `writeFullArtifacts` merges card-exercise and telepipe probes into `probes.json` for spire-ascent runs.
- `cd game && pnpm test:quick` passes.
- Do **not** run `pnpm validate:spire-ascent` (sub-ticket **05**).

## Technical Specs

- **Edit:** `harness/validate/playthrough.mjs` — `runsSpireAscentFull` block, import telepipe helper, extend `collectScreenshots`, `writeFullArtifacts`, `buildAssertions`, `buildAssertionFailureDetail` (reference `spireTelepipe` or shared key).
- **Edit:** `harness/validate/verify-spire-ascent-artifacts.mjs` — `REQUIRED_ASSERTION_KEYS` += seven new keys; optional PNG checks for `08`–`12`.
- **Edit:** `harness/validate/lib/findings.mjs` — spire-ascent preset title/labels; telepipe summary key (`spireTelepipe` or `questTelepipe`).
- **Edit:** `harness/validate/presets/spire-ascent.mjs` — finalize any scenario constants from sub-tickets **01–03**.
- **Depends on:** passed sub-tickets **01**, **02**, **03**.

## Verification: code
