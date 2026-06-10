# Slippery-floor playthrough step

Wire a harness step into the ice preset `--steps full` playthrough that exercises ticket **292** slippery-floor momentum: acceleration while holding input, continued drift after release, direction change while sliding, and a normal→ice surface transition. Runs after hub/deploy and **before** mid-combat.

## Acceptance Criteria

- `harness/validate/lib/slipperyFloor.mjs` exports `runSlipperyFloorStep({ page, preset, outDirAbs, repoRoot })` that:
  - Requests `preset.slipperyFloorScenario` (`slippery-floor-lab`), enables godmode, focuses canvas.
  - **Accelerate:** holds a movement key ≥400ms; records `speedWhileHolding > 0` from successive `player.x`/`player.z` samples.
  - **Momentum:** releases all keys, polls ≥6 server ticks; records `driftAfterRelease > 0` (position delta with no input).
  - **Direction change:** while still drifting, presses a perpendicular key; records `directionChangeWhileSliding: true` when heading component flips or lateral displacement increases without a full stop.
  - **Surface transition:** requests `preset.surfaceTransitionScenario` (`frost-crossing-surface-transition`), nudges toward ice, records `enteredSlipperyBand: true` when harness reports player standing on a slippery floor sample (via `window.__sampleFloorSurfaceForHarness?.(x,z) === 'slippery'` or equivalent minimal hook).
  - Writes `03-slippery-floor.png` and returns structured probes merged into `summary.slipperyFloor`.
- `harness/validate/playthrough.mjs` invokes `runSlipperyFloorStep` on `--steps full` for preset `ice` after `runHubStep` and **before** `runDefeatEnemiesCombatStep` when `preset.slipperyFloorScenario` is set.
- `runDefeatEnemiesCombatStep` mid-combat screenshot filename becomes `04-mid-combat.png` for preset `ice` (shifted numbering); other presets unchanged.
- `buildAssertions` for `frost_crossing` adds `slipperyFloorOk` derived from `summary.slipperyFloor.ok === true` (acceleration, drift, direction change, and surface transition all pass).
- `cd game && pnpm test:quick` passes. Scope is `harness/validate/**` plus optional minimal `game/client/main.js` harness hook for floor-surface sampling if position-only probes are insufficient. Depends on passed sub-tickets **01** and **02**.

## Technical Specs

- **New:** `harness/validate/lib/slipperyFloor.mjs` — keyboard nudge helpers (mirror `hubMovement.mjs`), harness polling via `readHarness`, `writeScreenshot`, `requestScenario` pattern from `cardMechanics.mjs`.
- **Edit:** `harness/validate/playthrough.mjs` — import/call `runSlipperyFloorStep`; merge `slipperyFloor` into summary, probes, screenshot collection; parameterize mid-combat screenshot basename for ice preset.
- **Optional minimal edit:** `game/client/main.js` — expose `window.__sampleFloorSurfaceForHarness(x, z)` delegating to shared `sampleFloorSurface` when transition probe cannot be inferred from layout bands alone.
- **Read-only:** `harness/validate/presets/ice.mjs` scenario keys from sub-ticket 02.
- **Out of scope:** glacial slow step (04), card mechanics, telepipe, full validation run (06).

## Verification: code
