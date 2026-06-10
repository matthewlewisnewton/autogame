# Glacial-thrower slow playthrough step

Wire the Glacial Thrower ice-ball slow-on-hit probe into the ice preset `--steps full` playthrough so the driver exercises ticket **293** enemy slow (`player.slowedUntil`) between mid-combat and card-mechanics. Mirror the fire preset `runEmberBurnStep` pattern with godmode disabled so the thrower can land a hit.

## Acceptance Criteria

- `harness/validate/lib/cardMechanics.mjs` exports `runGlacialSlowStep({ page, preset, outDirAbs, repoRoot })` that requests `preset.glacialSlowScenario`, turns **off** debug godmode, polls `__AUTOGAME_HARNESS_STATE__().player.slowedUntil > Date.now()`, records `hpBefore` / `hpAfterHit`, and writes `05-glacial-slow.png`.
- `harness/validate/playthrough.mjs` invokes `runGlacialSlowStep` on `--steps full` for preset `ice` **after** `runDefeatEnemiesCombatStep` and **before** card-mechanics / victory steps when `preset.glacialSlowScenario` is set.
- `summary.glacialSlow` is merged into `writeFullArtifacts` output (`run-summary.json`, `probes.json`) with `glacialSlowApplied: true` when slow is observed on the player.
- `buildAssertions` for `frost_crossing` sets `glacialSlowApplied` from `summary.glacialSlow.glacialSlowApplied`.
- `collectScreenshots` includes `summary.glacialSlow.screenshot`.
- `cd game && pnpm test:quick` passes. Scope is `harness/validate/**` only — no `game/server/` or `game/client/` edits unless a blocking slow bug is found (document in handoff). Depends on passed sub-tickets **01**, **02**, and **03**.

## Technical Specs

- **Edit:** `harness/validate/lib/cardMechanics.mjs` — implement `runGlacialSlowStep` using `readHarness`, `writeScreenshot`, and `window.__requestDebugScenarioForTest` (mirror `runEmberBurnStep`; poll `slowedUntil` instead of `burningUntil`).
- **Edit:** `harness/validate/playthrough.mjs` — import `runGlacialSlowStep`; call between defeat-enemies combat and subsequent full-flow steps; merge `glacialSlow` into summary, probes, and screenshot collection; extend `buildAssertions` / `collectScreenshots`.
- **Read-only:** `harness/validate/presets/ice.mjs` already sets `glacialSlowScenario: 'frost-crossing-glacial-thrower-slow'` via sub-ticket 02.
- **Out of scope:** card slow/burn/cleanse/windup probes (05), telepipe slice (05), running `pnpm validate:ice` (06).

## Verification: code
