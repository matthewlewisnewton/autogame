# 02 — Card exercises on spire-ascent (slow/burn, heal/cleanse, wind-up)

Generalize the harness card-exercise helpers (landed for sunken-canyon in ticket **370**) so they run during a **spire-ascent** `playing` session. Exercise ticket **301** slow+burn mutual exclusivity, ticket **299** `purifying_pulse` heal/cleanse, and ticket **308** wind-up input lock + charge telegraph.

## Acceptance Criteria

- `runSlowBurnExercise(page)` accepts `layout.profile === 'spire-ascent'` (in addition to `sunken-canyon`):
  1. `__requestDebugScenarioForTest('ice-ball-ready')` — cast Glacial Orb on nearest grunt; record `afterSlow`.
  2. Cast Fireball on the **same** enemy id; record `afterBurn`.
  3. `slowBurnMutuallyExclusive === true` — never both `slowActive` and `burnActive`; burn wins over slow.
  4. Screenshot `08-slow-burn-mutual-exclusive.png`.
- `runPurifyingPulseExercise(page)` on spire-ascent playing phase:
  1. `purifying-pulse-ready` — player has slow + burn debuffs and low HP.
  2. Cast Purifying Pulse; `healCleanseApplied === true` when HP rises and debuff timers cleared.
  3. Screenshot `09-purifying-pulse.png`.
- `runWindupCardExercise(page)` on spire-ascent playing phase:
  1. `magma-windup-ready` (or preset `windupScenario`) — press weapon slot once.
  2. Probe records `cardUseState === 'windup'`, `cardWindupUntil > Date.now()`, matching `cardWindupCardId`.
  3. DOM charge telegraph visible while input locked; `windupTelegraphActive === true`.
  4. Screenshot `10-windup-charge.png` during wind-up.
- `harness/validate/presets/spire-ascent.mjs` lists scenario constants: `iceBallScenario`, `fireballScenario`, `purifyingPulseScenario`, `windupScenario`, `windupCardId` (mirror `presets/sunken-canyon.mjs`).
- Exercises use existing debug scenarios in `game/server/debugScenarios.js` (no spire-specific scenario required unless `ice-ball-ready` fails on spire layout — then add minimal `spire-ascent-card-ready` alias only).
- `cd game && pnpm test:quick` passes.
- Do **not** wire exercises into `--steps full` yet (sub-ticket **04**).

## Technical Specs

- **Edit:** `harness/validate/lib/cardExercise.mjs` — replace hard-coded `layout.profile === 'sunken-canyon'` gates with `isCardExerciseLayout(profile)` accepting `'sunken-canyon'` and `'spire-ascent'`; optional `preset` param for scenario names.
- **Edit:** `harness/validate/presets/spire-ascent.mjs` — card exercise scenario constants.
- **Reuse:** debug scenarios `ice-ball-ready`, `fireball-hand-ready`, `purifying-pulse-ready`, `magma-windup-ready` in `game/server/debugScenarios.js`; harness fields `slowedUntil`, `burningUntil`, `cardUseState`, `cardWindupUntil` on `__AUTOGAME_HARNESS_STATE__()` from `game/client/main.js`.
- **Edit (minimal, only if scenarios fail on spire layout):** `game/server/debugScenarios.js` — spire-ascent branch inside existing card-ready scenarios to reposition player near a grunt on `spire-ascent` profile.
- **Depends on:** none; consumed by sub-ticket **04**.

## Verification: code
