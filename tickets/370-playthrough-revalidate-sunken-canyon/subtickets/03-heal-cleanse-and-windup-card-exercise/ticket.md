# 03 — Heal/cleanse and wind-up card exercise

Add harness card-exercise slices for ticket **299** (`purifying_pulse` AoE heal + cleanse) and ticket **308** wind-up heavy hitter (`magma_greatsword` or `flame_blade` with `windUpMs`, input lock, and charge telegraph). Exercises run in playing phase on sunken-canyon layout via existing debug scenarios.

## Acceptance Criteria

- `runPurifyingPulseExercise(page)`:
  1. `__requestDebugScenarioForTest('purifying-pulse-ready')` — player has slow + burn debuffs and low HP.
  2. Cast Purifying Pulse; record `preCast` / `postCast` probes.
  3. `healCleanseApplied === true` when `postCast.player.hp > preCast.player.hp` and player/enemy slow+burn timers are cleared (`slowedUntil`/`burningUntil` not active).
  4. Screenshot `09-purifying-pulse.png`.
- `runWindupCardExercise(page)`:
  1. `__requestDebugScenarioForTest('magma-windup-ready')` (or `heavy-greatsword-slash-ready` limited to `magma_greatsword` slot).
  2. Press the weapon slot key once; within wind-up window record probe with `cardUseState === 'windup'`, `cardWindupUntil > Date.now()`, matching `cardWindupCardId`.
  3. DOM probe: charge telegraph visible (e.g. `.card-slot` wind-up class or `.card-windup-indicator` width > 0) while input locked.
  4. Screenshot `10-windup-charge.png` during wind-up (before release completes).
  5. `windupTelegraphActive === true` only when wind-up state and telegraph DOM agree.
- `__AUTOGAME_HARNESS_STATE__()` exposes `player.cardUseState`, `player.cardWindupUntil`, `player.cardWindupCardId` (and player slow/burn fields if not landed in sub-ticket **02**).
- `cd game && pnpm test:quick` passes.
- Do **not** wire into `--steps full` yet (sub-ticket **05**).

## Technical Specs

- **Edit:** `harness/validate/lib/cardExercise.mjs` — add `runPurifyingPulseExercise`, `runWindupCardExercise`, shared `castHandSlot(page, slotIndex)`.
- **Edit (minimal):** `game/client/main.js` — mirror `cardUseState`, `cardWindupUntil`, `cardWindupCardId` on harness `player` object from live `gameState.players[myId]`.
- **Reuse:** scenarios `purifying-pulse-ready`, `magma-windup-ready` in `game/server/debugScenarios.js`; wind-up DOM/classes from `game/client/renderer.js` / `game/client/test/windup-charge.test.js`.
- **Depends on:** sub-ticket **02** only if sharing `cardExercise.mjs` (can land in parallel if file created in **02**).

## Verification: code
