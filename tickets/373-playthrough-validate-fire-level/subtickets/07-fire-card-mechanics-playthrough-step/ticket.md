# Fire card-mechanics playthrough step

Add the harness driver step that exercises slow, burn, mutual exclusion (301), cleanse (299), and wind-up (308) cards during the fire preset full playthrough. Prerequisite probe surface (`__AUTOGAME_HARNESS_STATE__` status fields, `status-mutual-exclusion-ready` debug scenario, and unit tests) already landed during the retired sub-ticket 03 — this ticket delivers only the playthrough wiring and structured probes.

## Acceptance Criteria

- `harness/validate/presets/fire.mjs` exports `cardMechanicsScenarios` map with keys `burn`, `mutualExclusion`, `cleanse`, `windup` pointing to `fireball-ready`, `status-mutual-exclusion-ready`, `purifying-pulse-ready`, and `magma-windup-ready`.
- `harness/validate/lib/cardMechanics.mjs` exports `runCardMechanicsStep` that, per scenario:
  - **burn:** cast `fireball`; assert enemy `burningUntil > now`; write `05-card-burn.png`.
  - **slow / mutual exclusion:** cast `fireball` then `permafrost_lance`; assert enemy `slowedUntil > now` and prior burn cleared.
  - **cleanse:** cast `purifying_pulse`; assert player `burningUntil`/`slowedUntil` cleared and HP increased.
  - **windup:** press slot 1 on `magma_windup`; assert `cardUseState === 'windup'` and `windupFlashing === true`; assert WASD movement does not change `x`/`z` during wind-up.
- `harness/validate/playthrough.mjs` calls `runCardMechanicsStep` on `--steps full` for preset `fire` after ember-burn (sub-ticket 06) and before `runVictoryStep` when `preset.cardMechanicsScenarios` is set.
- `summary.cardMechanics` records `{ ok, probes: { burn, slow, cleanse, windup } }`; `buildAssertions` sets `cardMechanicsOk` from `summary.cardMechanics.ok === true`.
- Victory screenshots remain `06-objective-complete.png` and `07-victory.png` (telepipe `08`/`09` unchanged per preset).
- `cd game && pnpm test:quick` passes. Harness scope only (`harness/validate/**`). Depends on passed sub-tickets **01**, **02**, and **06**.

## Technical Specs

- **New:** `harness/validate/lib/cardMechanics.mjs` — `runCardMechanicsStep` plus helpers (`requestScenario`, `castCardSlot` via `__emitUseCardForTest` / `__useCardForTest`, `pressCardSlot`, harness polling). Reuse `readHarness` from `harness/validate/lib/harnessState.mjs`.
- **Edit:** `harness/validate/playthrough.mjs` — import and invoke `runCardMechanicsStep`; merge `cardMechanics` into `writeFullArtifacts`, `collectScreenshots`, and `buildAssertions`.
- **Edit:** `harness/validate/presets/fire.mjs` — replace `cardMechanicsScenario: null` (if still present) with the `cardMechanicsScenarios` object.
- **Prerequisites (do not re-implement):** `game/client/main.js` harness fields (`player.burningUntil`, `player.slowedUntil`, `player.cardUseState`, `windupFlashing`); `game/server/debugScenarios.js` `status-mutual-exclusion-ready`; existing `fireball-ready`, `purifying-pulse-ready`, `magma-windup-ready` scenarios.
- **Out of scope:** ember-burn step (06), telepipe slice (04), executing `pnpm validate:fire` (05).

## Verification: code
