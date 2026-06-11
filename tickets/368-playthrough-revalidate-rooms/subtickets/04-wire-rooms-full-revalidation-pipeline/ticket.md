# 04 — Wire rooms full revalidation pipeline, verify script, and findings

Integrate sub-tickets **01–03** into the rooms `--steps full` playthrough (mirror sunken-canyon revalidation order), extend assertions and artifact verification, and update findings rendering. No artifact regeneration in this sub-ticket — wiring and verify-script only.

## Acceptance Criteria

- `harness/validate/playthrough.mjs` rooms full run order (new `runsRoomsRevalidateFull` branch or extend existing stage-preset flow):
  1. auth → hub/deploy (`training-caverns-tier-2`) → god-mode mid-combat (existing `03-mid-combat.png` path)
  2. `runSlowBurnExercise` + `runPurifyingPulseExercise` + `runWindupCardExercise` with `layoutProfile: 'crowded'`
  3. `runStageBossTelepipeNewSortieStep` (from sub-ticket 03) with `fromPlaying: true`; re-enable god-mode / `training-caverns-near-adds` afterward so boss path still works
  4. boss dormant/active (with UI/visual probes from sub-ticket 01) → defeat `annex_overseer` → victory (`06-boss-defeated.png`, `07-victory.png`)
- `buildAssertions(summary, preset)` for `rooms` includes all eleven booleans:
  - Legacy: `bossSpawned`, `encounterActivated`, `bossDefeated`, `victoryFired`
  - New: `bossEncounterUiVisible`, `bossDistinctFromAdds`, `slowBurnMutuallyExclusive`, `healCleanseApplied`, `windupTelegraphActive`, `telepipeVitalsPreserved`, `cardChargesResetOnNewSortie`
- `summary.ok === true` only when all assertions are true; failures set `summary.error` with probe detail (never fake green).
- `harness/validate/verify-rooms-artifacts.mjs` requires the seven new assertion keys in `run-summary.json` and optional PNGs `08`–`12` when listed in summary screenshots.
- `harness/validate/lib/findings.mjs` documents every assertion, new-content probe blocks (boss UI, visual identity, card exercises, telepipe), console errors, and a **New content exercise** section for rooms preset.
- `writeFullArtifacts` merges card-exercise and telepipe probes into `probes.json` alongside dormant/active/victory probes.
- `cd game && pnpm test:quick` passes.
- Do **not** run `pnpm validate:rooms` (sub-ticket **05**).

## Technical Specs

- **Edit:** `harness/validate/playthrough.mjs` — rooms revalidation branch (parallel to `runsSunkenCanyonFull`); import generalized card/telepipe helpers; extend `collectScreenshots`, `writeFullArtifacts`, `buildAssertions`, `buildAssertionFailureDetail`.
- **Edit:** `harness/validate/verify-rooms-artifacts.mjs` — `REQUIRED_ASSERTION_KEYS` += seven new keys; optional PNG checks for `08-slow-burn-mutual-exclusive.png` through `12-telepipe-after.png`.
- **Edit:** `harness/validate/lib/findings.mjs` — rooms preset assertion block and new-content sections (mirror sunken-canyon).
- **Edit:** `harness/validate/presets/rooms.mjs` — confirm `layoutProfile: 'crowded'`, telepipe fields from sub-ticket 03.
- **Depends on:** passed sub-tickets **01**, **02**, **03**.

## Verification: code
