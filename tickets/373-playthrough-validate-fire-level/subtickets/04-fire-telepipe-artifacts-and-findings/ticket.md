# Fire telepipe-reset slice, artifact verification, and findings template

Wire telepipe-up **vitals persistence** (287) and **card-charge reset on new sortie** (289) into the fire preset full run, add artifact verification for `game/validation/fire/`, and extend findings rendering for defeat-enemies runs, burn/card probes, floor alignment, and the **missing stage boss** gap.

## Acceptance Criteria

- `harness/validate/presets/fire.mjs` sets `telepipeScenario: 'fire-telepipe-ready'` (implemented in this sub-ticket or sub-ticket 02 if not yet present): deploys `ember_descent` tier 1 with `telepipe` in hand and partially depleted HP/MS/charges suitable for `runTelepipeResetStep`.
- `game/server/debugScenarios.js` adds `fire-telepipe-ready` if missing: playing-phase fire-cavern run with telepipe in hand, partial vitals, depleted weapon charge — mirrors `telepipe-ready` but on ember_descent layout.
- `harness/validate/playthrough.mjs` runs `runTelepipeResetStep` on `--steps full` for preset `fire` after victory (or as terminal slice); asserts `telepipeVitalsPreserved` and `cardChargesResetOnFreshSortie` via existing `harness/validate/lib/telepipe.mjs` probes (`probesMatchVitalsPreserved`, `probesMatchFreshDeploy`, fresh `runId`).
- `harness/validate/verify-fire-artifacts.mjs` validates `game/validation/fire/`: `run-summary.json` with `steps: "full"`, `preset: "fire"`, defeat-enemies assertion keys, victory section, required PNGs, non-empty `findings.md`, `probes.json`, `console.log`.
- `game/package.json` adds `"validate:fire:check": "node ../harness/validate/verify-fire-artifacts.mjs"`.
- `harness/validate/lib/findings.mjs` supports defeat-enemies presets: assertion labels (`layoutDeployed`, `enemiesCleared`, `victoryFired`, `emberBurnApplied`, `cardMechanicsOk`, `telepipeVitalsPreserved`, `cardChargesResetOnFreshSortie`), sections for **Ember burn**, **Card mechanics**, **Stage boss gap** (explicit note that `ember_descent` tier 1 has no stage boss — encounter UI / distinct boss visuals N/A per tickets 283/284), and floor-alignment probes (rim/ramp/basin bands).
- `cd game && pnpm validate:fire:check` fails before sub-ticket 05 runs; `cd game && pnpm test:quick` still passes.
- Do **not** run `pnpm validate:fire` or populate real screenshots in this sub-ticket. Depends on passed sub-tickets **01**–**03**.

## Technical Specs

- **New:** `harness/validate/verify-fire-artifacts.mjs` — clone `verify-sunken-canyon-artifacts.mjs` with `FIRE_DIR = game/validation/fire` and fire-specific assertion keys/PNG list.
- **Edit:** `harness/validate/lib/findings.mjs` — preset-aware assertion rendering; ember-burn, card-mechanics, telepipe, and stage-boss-gap sections.
- **Edit:** `harness/validate/playthrough.mjs` — fire telepipe-reset integration; pass card/burn/telepipe probes to `renderFindings`.
- **Edit:** `harness/validate/presets/fire.mjs` — `telepipeScenario`.
- **Edit:** `game/server/debugScenarios.js` — `fire-telepipe-ready` if needed.
- **Edit:** `game/package.json` — `validate:fire:check`.
- **Scope:** `harness/validate/**`, `game/package.json`, and minimal `game/server/debugScenarios.js` only if `fire-telepipe-ready` is not already covered.

## Verification: code
