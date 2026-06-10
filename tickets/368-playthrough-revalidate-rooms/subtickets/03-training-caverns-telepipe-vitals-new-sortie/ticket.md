# 03 — Training-caverns telepipe vitals preservation and new-sortie charge reset

Add a training-caverns telepipe exercise for ticket **287** (HP + magic stones persist through telepipe-up → hub → **abandon** → fresh redeploy) and ticket **289** (card charges reset to full on a new sortie). Mirrors the sunken-canyon `runCanyonTelepipeNewSortieStep` pattern but for `training_caverns` tier 2 / `crowded` layout.

## Acceptance Criteria

- `game/server/debugScenarios.js` adds `training-caverns-telepipe-ready` (or extends `training-caverns-tier-2` branch): `training_caverns` tier 2 playing state with `telepipe` in hand and partial HP/MS/charges suitable for depletion probes (mirror `canyon-descent-telepipe-ready`).
- `harness/validate/lib/telepipe.mjs` generalizes `runCanyonTelepipeNewSortieStep` (rename to `runStageBossTelepipeNewSortieStep` or add a thin wrapper) so it accepts `preset.telepipeScenario` and `preset.telepipeDeployScenario` without hardcoding sunken-canyon layout/profile checks — `training-caverns-telepipe-ready` + `training-caverns-tier-2` for rooms.
- Step flow when `fromPlaying: true` on crowded layout:
  1. `depleteRunResources` records `preSuspend` (HP, MS, hand charges, `runId`)
  2. Screenshot `11-telepipe-before.png`
  3. `suspendViaTelepipe` → hub with suspended checkpoint
  4. `abandonSuspendedRun` clears suspended state
  5. Redeploy via `training-caverns-tier-2`; screenshot `12-telepipe-after.png`
  6. `telepipeVitalsPreserved === true` via `probesMatchVitalsPreserved`
  7. `cardChargesResetOnNewSortie === true` via `probesMatchNewSortie` (full charges + fresh `runId`)
  8. Server log slice after suspend has **no** `[run] checkpoint restored`
- `harness/validate/presets/rooms.mjs` adds `telepipeScenario: 'training-caverns-telepipe-ready'` and `telepipeDeployScenario: 'training-caverns-tier-2'`.
- `cd game && pnpm test:quick` passes.
- Do **not** wire into rooms `--steps full` yet (sub-ticket **04**).

## Technical Specs

- **Edit:** `harness/validate/lib/telepipe.mjs` — generalize canyon telepipe step; replace sunken-canyon-only phase/profile error strings with preset-driven checks.
- **Edit:** `harness/validate/presets/rooms.mjs` — `telepipeScenario`, `telepipeDeployScenario`.
- **Edit:** `game/server/debugScenarios.js` — `training-caverns-telepipe-ready` handler (inject telepipe into hand after tier-2 deploy, partial vitals when not fresh-sortie).
- **Reuse:** `suspendViaTelepipe`, `abandonSuspendedRun`, `depleteRunResources`, `probesMatchVitalsPreserved`, `probesMatchNewSortie`, `readServerLogForbidden` from `telepipe.mjs`; `window.__abandonSuspendedRunForTest` from ticket 281.
- **Depends on:** none; consumed by sub-ticket **04**.

## Verification: code
