# 04 — Canyon telepipe vitals preservation and new-sortie card-charge reset

Add a sunken-canyon telepipe exercise for ticket **287** (HP + magic stones persist through telepipe-up → hub → **abandon** → fresh redeploy) and ticket **289** (card charges reset to full on a new sortie, not resume). Distinct from hub preset telepipe: runs inside the canyon quest context and must call `abandonSuspendedRun()` before redeploy.

## Acceptance Criteria

- New `runCanyonTelepipeNewSortieStep({ page, preset, outDirAbs, repoRoot, serverLogPath, gameProcess })` in `harness/validate/lib/telepipe.mjs` (or `canyonTelepipe.mjs`):
  1. While in sunken-canyon `playing` with telepipe in hand, `depleteRunResources` records `preSuspend` (HP, MS, hand charges, `runId`).
  2. Screenshot `11-telepipe-before.png`.
  3. `suspendViaTelepipe(page)` → hub with suspended checkpoint.
  4. `abandonSuspendedRun(page)` clears suspended state (`suspendedRunSummary` null, `abandonRunBtnUsable` false).
  5. Redeploy via `canyon-descent-tier-2` (preset `deployScenario`); screenshot `12-telepipe-after.png`.
  6. `telepipeVitalsPreserved === true` — `probesMatchVitalsPreserved(preSuspend, postDeploy)`.
  7. `cardChargesResetOnNewSortie === true` — every occupied hand slot has `remainingCharges === charges`; `postDeploy.runId !== preSuspend.runId`.
  8. Server log slice after suspend has **no** `[run] checkpoint restored`.
- Export `probesMatchFreshDeploy` (or equivalent) from `telepipe.mjs` for charge-reset assertion; do not require MS reset to `STARTING_MAGIC_STONES` (287 preserves MS).
- `harness/validate/presets/sunken-canyon.mjs` may add `telepipeDeployScenario: 'canyon-descent-tier-2'` if helpful.
- If telepipe is not guaranteed in opening hand, add minimal scenario `canyon-descent-telepipe-ready` in `game/server/debugScenarios.js` that ensures telepipe in a hand slot without changing normal gameplay.
- `cd game && pnpm test:quick` passes.
- Do **not** wire into `--steps full` yet (sub-ticket **05**).

## Technical Specs

- **Edit:** `harness/validate/lib/telepipe.mjs` — `runCanyonTelepipeNewSortieStep`, reuse `suspendViaTelepipe`, `abandonSuspendedRun`, `depleteRunResources`, `probesMatchVitalsPreserved`, `readServerLogForbidden`.
- **Edit (minimal, only if needed):** `game/server/debugScenarios.js` — `canyon-descent-telepipe-ready` places telepipe in hand during canyon_descent tier 2 playing state.
- **Edit (minimal, if missing):** `game/client/main.js` — ensure harness exposes `abandonRunBtnUsable`, `runId`, and `window.__abandonSuspendedRunForTest` (per ticket **281** sub-ticket 09).
- **Reuse:** `harness/validate/presets/sunken-canyon.mjs` `deployScenario: 'canyon-descent-tier-2'`.
- **Depends on:** none for implementation; consumed by sub-ticket **05**.

## Verification: code
