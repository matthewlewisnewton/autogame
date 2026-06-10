# Generalize the new-content playthrough pipeline for open-plaza

The full new-content validation pipeline (mid-combat probe, boss-encounter-UI + boss-visual-identity
probes, slow/burn + heal-cleanse + wind-up card exercises, telepipe new-sortie vitals/charge step,
and the 7 extra assertions) is currently hard-wired to `opts.preset === 'sunken-canyon'`. Generalize
it to be preset-driven and wire the `open-plaza` preset + its artifact verifier so a
`pnpm validate:open-plaza` full run exercises the same NEW content (283/284/301/299/308/287/289)
against the arena_trials Tier II Arena Champion.

## Acceptance Criteria

- `harness/validate/playthrough.mjs`: the `runsSunkenCanyonFull` gate (currently
  `opts.preset === 'sunken-canyon' && runsRoomsFull`) is replaced by a preset-driven flag (e.g.
  `preset.newContentFull === true && runsRoomsFull`) so the same branch runs for any preset that
  opts in. Rename the local to something preset-neutral (e.g. `runsNewContentFull`). Behavior for
  the sunken-canyon preset is unchanged.
- `harness/validate/playthrough.mjs`: `isSunkenCanyonPreset(preset, summary)` (used to gate
  `buildAssertions` for the new-content assertions) is generalized so it returns true for open-plaza
  too (key off `preset.newContentFull === true`, or `preset.layoutProfile`/`summary.preset`), without
  breaking sunken-canyon. The 7 new-content assertions (`bossEncounterUiVisible`,
  `bossDistinctFromAdds`, `slowBurnMutuallyExclusive`, `healCleanseApplied`, `windupTelegraphActive`,
  `telepipeVitalsPreserved`, `cardChargesResetOnNewSortie`) are emitted for the open-plaza run.
- `harness/validate/presets/open-plaza.mjs` gains the new-content fields, mirroring
  `sunken-canyon.mjs`: `newContentFull: true`, `layoutProfile: 'open-plaza'`,
  `iceBallScenario: 'ice-ball-ready'`, `fireballScenario: 'fireball-hand-ready'`,
  `purifyingPulseScenario: 'purifying-pulse-ready'`, `windupScenario: 'magma-windup-ready'`,
  `windupCardId: 'magma_greatsword'`, `telepipeScenario: 'arena-trials-telepipe-ready'`,
  `telepipeDeployScenario: 'arena-trials-tier-2'`. Keep existing arena fields intact.
- `harness/validate/verify-open-plaza-artifacts.mjs` requires the full 11-key assertion list (the
  current 4 plus the 7 new-content keys) and checks the optional exercise PNGs
  (`08-slow-burn-mutual-exclusive.png`, `09-purifying-pulse.png`, `10-windup-charge.png`,
  `11-telepipe-before.png`, `12-telepipe-after.png`) when listed in the run-summary `screenshots`,
  exactly as `verify-sunken-canyon-artifacts.mjs` does.
- No game/ source is modified by this sub-ticket. (The arena debug scenarios land in sub-ticket 01.)

## Technical Specs

- `harness/validate/playthrough.mjs`:
  - Line ~1474: replace `const runsSunkenCanyonFull = opts.preset === 'sunken-canyon' && runsRoomsFull;`
    with a preset-driven flag and update every downstream use (`!runsSunkenCanyonFull` boss/victory
    skips ~1480/1512, the `if (runsSunkenCanyonFull && page)` new-content block ~1516-1560).
  - Line ~1051 `isSunkenCanyonPreset`: generalize the predicate (keep the name or rename, but keep
    sunken-canyon true) so `buildAssertions` (~1111) builds the new-content assertion set for
    open-plaza. The probe/exercise reads at ~1114-1128 already key off `summary.*` and need no
    structural change.
  - Do not change the windup defaults fallback (`preset.windupCardId ?? 'magma_greatsword'`,
    `preset.windupScenario ?? 'magma-windup-ready'`).
- `harness/validate/presets/open-plaza.mjs`: add the fields listed above (model exactly on
  `harness/validate/presets/sunken-canyon.mjs`).
- `harness/validate/verify-open-plaza-artifacts.mjs`: extend `REQUIRED_ASSERTION_KEYS` to the
  11-key list and add the `OPTIONAL_EXERCISE_PNGS` + `checkOptionalExercisePngs` logic copied from
  `verify-sunken-canyon-artifacts.mjs`.
- SCOPE NOTE: the literal "game/validate" in the top-level ticket is the playthrough driver, which
  lives under `harness/validate/`; these harness files are the in-scope driver. Do not run the
  playthrough in this sub-ticket (that is sub-ticket 03) — only wire it.

## Verification: code
