# 02 — Card exercises on crowded / training-caverns layout

Generalize the sunken-canyon card-exercise helpers so they run on the **rooms** preset (`training_caverns` tier 2, `crowded` layout profile). Exercise ticket **301** slow/burn mutual exclusivity (`ice_ball` + `fireball`), ticket **299** heal/cleanse (`purifying_pulse`), and ticket **308** wind-up telegraph (`magma_greatsword`) during a playing-phase training-caverns session.

## Acceptance Criteria

- `runSlowBurnExercise`, `runPurifyingPulseExercise`, and `runWindupCardExercise` accept an optional `layoutProfile` (default `'sunken-canyon'` for backward compatibility) and wait for `harness.layout.profile === layoutProfile` instead of hardcoding sunken-canyon only.
- When called with `layoutProfile: 'crowded'` after `training-caverns-tier-2` deploy, each exercise completes without throwing:
  - **slow/burn:** `ice-ball-ready` → cast Glacial Orb → `fireball-hand-ready` → cast Fireball; `slowBurnMutuallyExclusive === true`; screenshot `08-slow-burn-mutual-exclusive.png`
  - **cleanse:** `purifying-pulse-ready` → cast Purifying Pulse; `healCleanseApplied === true`; screenshot `09-purifying-pulse.png`
  - **windup:** `magma-windup-ready` → press weapon slot; `windupTelegraphActive === true` with `cardUseState === 'windup'` and DOM telegraph; screenshot `10-windup-charge.png`
- Existing debug scenarios (`ice-ball-ready`, `fireball-hand-ready`, `purifying-pulse-ready`, `magma-windup-ready`) work when emitted mid-run on `training_caverns` tier 2 playing state; add `resumePlayingRunForCardProbe` to `ice-ball-ready` if it fails to preserve stage-boss run context on crowded layout.
- `cd game && pnpm test:quick` passes.
- Do **not** wire exercises into `--steps full` for preset `rooms` yet (sub-ticket **04**) or run the full validation.

## Technical Specs

- **Edit:** `harness/validate/lib/cardExercise.mjs` — add `layoutProfile` option to all three `run*Exercise` functions; thread through `page.waitForFunction` profile check.
- **Edit (minimal, only if ice-ball-ready drops run context):** `game/server/debugScenarios.js` — call `resumePlayingRunForCardProbe(state, player)` at the start of `ice-ball-ready` (match `fireball-ready` / `purifying-pulse-ready` pattern).
- **Reuse:** `game/client/main.js` harness fields (`enemyHp.slowedUntil`/`burningUntil`, `player.cardUseState`, `cardWindupUntil`, `cardWindupCardId`); existing scenario handlers in `debugScenarios.js`.
- **Depends on:** none; consumed by sub-ticket **04**.

## Verification: code
