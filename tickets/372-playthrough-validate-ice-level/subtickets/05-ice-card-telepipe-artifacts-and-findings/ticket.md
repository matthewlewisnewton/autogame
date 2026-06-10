# Ice card mechanics, telepipe-reset, artifact verification, and findings template

Wire slow/burn mutual exclusion (301), cleanse (299), and wind-up (308) card probes, telepipe-up **vitals persistence** (287) and **card-charge reset on new sortie** (289) into the ice preset full run, add artifact verification for `game/validation/ice/`, and extend findings rendering for slippery-floor probes, glacial slow, floor alignment on ice-cavern bands, and the **missing stage boss** gap (Rimecast named rare only).

## Acceptance Criteria

- `harness/validate/presets/ice.mjs` exports `cardMechanicsScenarios` map with keys `burn`, `mutualExclusion`, `cleanse`, `windup` pointing to `fireball-ready`, `status-mutual-exclusion-ready`, `purifying-pulse-ready`, and `magma-windup-ready` (reuse existing generic debug scenarios).
- `harness/validate/playthrough.mjs` calls `runCardMechanicsStep` on `--steps full` for preset `ice` after glacial-slow (sub-ticket 04) and before `runVictoryStep`; card burn screenshot writes `06-card-burn.png` for ice preset.
- `harness/validate/playthrough.mjs` runs `runTelepipeResetStep` on `--steps full` for preset `ice` after victory when `preset.telepipeScenario` is set (generalize `runsFireTelepipeReset` to include `ice`); asserts `telepipeVitalsPreserved` and `cardChargesResetOnFreshSortie` via `harness/validate/lib/telepipe.mjs`.
- `harness/validate/verify-ice-artifacts.mjs` validates `game/validation/ice/`: `run-summary.json` with `steps: "full"`, `preset: "ice"`, defeat-enemies assertion keys (`layoutDeployed`, `enemiesCleared`, `victoryFired`, `slipperyFloorOk`, `glacialSlowApplied`, `cardMechanicsOk`, `telepipeVitalsPreserved`, `cardChargesResetOnFreshSortie`), victory section, required PNGs (`01-hub` through `10-telepipe-after`), non-empty `findings.md`, `probes.json`, `console.log`.
- `game/package.json` adds `"validate:ice:check": "node ../harness/validate/verify-ice-artifacts.mjs"`.
- `harness/validate/lib/findings.mjs` supports ice preset: **Slippery floor**, **Glacial slow**, **Card mechanics**, **Stage boss gap** (explicit note that `frost_crossing` tier 1 has **no stage boss** — encounter UI / distinct boss visuals N/A per tickets 283/284; named rare **Rimecast the Slow** is the signature encounter), and floor-alignment probes for `entry`/`stone`/`ice`/`ramp` bands.
- `buildAssertions` for `frost_crossing` includes all ice assertion keys; does not require `emberBurnApplied`.
- `cd game && pnpm validate:ice:check` fails before sub-ticket 06 runs; `cd game && pnpm test:quick` still passes.
- Do **not** run `pnpm validate:ice` or populate real screenshots in this sub-ticket. Depends on passed sub-tickets **01**–**04**.

## Technical Specs

- **New:** `harness/validate/verify-ice-artifacts.mjs` — clone `verify-fire-artifacts.mjs` with `ICE_DIR = game/validation/ice` and ice-specific assertion keys/PNG list.
- **Edit:** `harness/validate/lib/findings.mjs` — `renderSlipperyFloorSection`, `renderGlacialSlowSection`, preset-aware assertion rendering; stage-boss-gap and ice-cavern floor-band notes.
- **Edit:** `harness/validate/playthrough.mjs` — ice card-mechanics and telepipe-reset integration; pass slippery/glacial/card/telepipe probes to `renderFindings`; generalize telepipe-reset gate for `ice` preset; ice screenshot basename overrides for victory/telepipe steps.
- **Edit:** `harness/validate/lib/cardMechanics.mjs` — optional `screenshotBasename` parameter for burn probe (`06-card-burn` on ice).
- **Edit:** `game/package.json` — `validate:ice:check`.
- **Scope:** `harness/validate/**`, `game/package.json` only.

## Verification: code
