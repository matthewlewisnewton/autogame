# Fire ember-burn playthrough step

Wire the Ember Wraith burn-on-hit probe into the fire preset `--steps full` playthrough so the driver exercises ticket 296 enemy burn (player `burningUntil` DoT) between combat and card-mechanics. This sub-ticket is harness-only — debug scenario `ember-descent-ember-wraith-burn` is already provided by sub-ticket 02.

## Acceptance Criteria

- `harness/validate/lib/cardMechanics.mjs` exports `runEmberBurnStep({ page, preset, outDirAbs, repoRoot })` that requests `preset.emberBurnScenario`, turns **off** debug godmode so the wraith can apply burn, polls `__AUTOGAME_HARNESS_STATE__().player.burningUntil > Date.now()`, records `hpBefore` / `hpAfterTicks` / `hpDelta`, and writes `04-ember-burn.png`.
- `harness/validate/playthrough.mjs` invokes `runEmberBurnStep` on `--steps full` for preset `fire` **after** `runDefeatEnemiesCombatStep` and **before** card-mechanics / victory steps when `preset.emberBurnScenario` is set.
- `summary.emberBurn` is merged into `writeFullArtifacts` output (`run-summary.json`, `probes.json`) with `emberBurnApplied: true` when burn is observed.
- `buildAssertions` for `ember_descent` sets `emberBurnApplied` from `summary.emberBurn.emberBurnApplied`.
- `collectScreenshots` includes `summary.emberBurn.screenshot`.
- `cd game && pnpm test:quick` passes. Scope is `harness/validate/**` only — no `game/server/` or `game/client/` edits unless a blocking burn bug is found (document in handoff). Depends on passed sub-tickets **01** and **02**.

## Technical Specs

- **New or edit:** `harness/validate/lib/cardMechanics.mjs` — implement `runEmberBurnStep` using `readHarness`, `writeScreenshot`, and `window.__requestDebugScenarioForTest` (mirror telepipe/combat step patterns).
- **Edit:** `harness/validate/playthrough.mjs` — import `runEmberBurnStep`; call between defeat-enemies combat and subsequent full-flow steps; merge `emberBurn` into summary, probes, and screenshot collection.
- **Read-only:** `harness/validate/presets/fire.mjs` already sets `emberBurnScenario: 'ember-descent-ember-wraith-burn'`; do not change unless the key name is wrong.
- **Out of scope:** card burn/slow/cleanse/windup probes (sub-ticket 07), telepipe slice (sub-ticket 04), running `pnpm validate:fire` (sub-ticket 05).

## Verification: code
