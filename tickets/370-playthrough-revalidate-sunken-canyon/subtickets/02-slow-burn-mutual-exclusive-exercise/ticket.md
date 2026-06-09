# 02 — Slow and burn card exercise (mutual exclusivity)

Add a harness card-exercise slice that casts a slow card (`ice_ball`, ticket **294**) and a burn card (`fireball`, ticket **297**) on the same enemy during a sunken-canyon playing session, and asserts ticket **301** mutual exclusivity (never both slowed and burning at once; most-recent status wins).

## Acceptance Criteria

- New helper `runSlowBurnExercise(page)` (in `harness/validate/lib/cardExercise.mjs` or `combat.mjs`) runs while `layout.profile === 'sunken-canyon'` and `phase === 'playing'`:
  1. `__requestDebugScenarioForTest('ice-ball-ready')` — cast Glacial Orb on the nearest grunt; record `afterSlow` probe.
  2. Cast Fireball on the **same** enemy id; record `afterBurn` probe.
  3. `slowBurnMutuallyExclusive === true` when the target enemy has burning active and no slow (or slow cleared), and never both `slowedUntil > now` and `burningUntil > now`.
- Probes include `targetEnemyId`, `slowedUntil`, `burningUntil`, `slowActive`, `burnActive` per enemy (or target-only subset).
- Screenshot `08-slow-burn-mutual-exclusive.png` captured after the burn cast.
- `__AUTOGAME_HARNESS_STATE__()` exposes enemy status fields needed for probes (`slowedUntil`, `burningUntil` on `enemyHp` entries, or a dedicated `enemyStatus` array).
- `cd game && pnpm test:quick` passes.
- Do **not** wire this into `--steps full` yet (sub-ticket **05**) or run the full validation.

## Technical Specs

- **New:** `harness/validate/lib/cardExercise.mjs` — `runSlowBurnExercise(page)`, `probeEnemyStatus(harness, enemyId)`, `assertSlowBurnMutualExclusive(probes)`.
- **Edit (minimal):** `game/client/main.js` — extend `enemyHp` harness mapping with `slowedUntil`, `burningUntil` (and `slowFactor` if present on server snapshot).
- **Reuse:** debug scenarios `ice-ball-ready` and `fireball-ready` in `game/server/debugScenarios.js`; card cast via existing slot key presses (same pattern as `harness/validate/lib/combat.mjs`).
- **Depends on:** none (standalone harness module); consumed by sub-ticket **05**.

## Verification: code
