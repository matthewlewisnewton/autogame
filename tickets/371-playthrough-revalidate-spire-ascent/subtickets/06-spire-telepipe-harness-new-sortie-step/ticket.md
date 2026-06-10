# 06 — Spire telepipe harness new-sortie step (harness-only)

Original sub-ticket 03 failed because it bundled `game/` debug-scenario work with harness telepipe wiring; implementers scoped to `game/` only landed the server scenario while the harness step and preset constants never shipped. The game-side `spire-ascent-telepipe-ready` debug scenario is already done — this sub-ticket completes **only** the harness layer for tickets **287** (HP + magic stones persist through telepipe-up → hub → abandon → fresh redeploy) and **289** (card charges reset on new sortie).

## Acceptance Criteria

- `harness/validate/lib/telepipe.mjs` exports `runSpireAscentTelepipeNewSortieStep` (thin wrapper over shared `runQuestTelepipeNewSortieStep` is fine) that:
  1. While in spire-ascent `playing` with telepipe in hand, `depleteRunResources` records `preSuspend` (HP, MS, hand charges, `runId`).
  2. Screenshot `11-telepipe-before.png`.
  3. `suspendViaTelepipe(page)` → hub with suspended checkpoint.
  4. `abandonSuspendedRun(page)` clears suspended state.
  5. Redeploy via `spire-ascent-tier-2` (`preset.telepipeDeployScenario`); screenshot `12-telepipe-after.png`.
  6. `telepipeVitalsPreserved === true` — `probesMatchVitalsPreserved(preSuspend, postDeploy)`.
  7. `cardChargesResetOnNewSortie === true` — occupied hand slots have `remainingCharges === charges`; `postDeploy.runId !== preSuspend.runId`.
  8. Server log slice after suspend has **no** `[run] checkpoint restored`.
- `harness/validate/presets/spire-ascent.mjs` sets `telepipeScenario: 'spire-ascent-telepipe-ready'` and `telepipeDeployScenario: 'spire-ascent-tier-2'`.
- `harness/validate/playthrough.mjs` accepts `--preset spire-ascent --steps telepipe-new-sortie` that runs auth → deploy via `telepipeScenario` → `runSpireAscentTelepipeNewSortieStep` only (no boss/card exercises). Summary sets `spireTelepipe` and assertions `telepipeVitalsPreserved` + `cardChargesResetOnNewSortie`; exits non-zero when either is false.
- `game/package.json` adds `validate:spire-ascent:telepipe-new-sortie` invoking the slice above to `game/validation/spire-ascent/` (or a dedicated `game/validation/spire-ascent-telepipe/` out dir — either is fine if documented in handoff).
- `cd game && pnpm test:quick` passes.
- Do **not** change `--steps full` wiring (sub-ticket **04**, passed) or edit `game/` unless `spire-ascent-telepipe-ready` is broken.

## Technical Specs

- **Edit:** `harness/validate/lib/telepipe.mjs` — `runQuestTelepipeNewSortieStep` (shared), `runSpireAscentTelepipeNewSortieStep` export; reuse `suspendViaTelepipe`, `abandonSuspendedRun`, `depleteRunResources`, `probesMatchVitalsPreserved`, `probesMatchNewSortie`, `readServerLogForbidden`.
- **Edit:** `harness/validate/presets/spire-ascent.mjs` — `telepipeScenario`, `telepipeDeployScenario`.
- **Edit:** `harness/validate/playthrough.mjs` — register `telepipe-new-sortie` in `assertStepsForPreset` for stage presets with `telepipeScenario`; branch runs auth + `runSpireAscentTelepipeNewSortieStep` when `opts.preset === 'spire-ascent'`.
- **Edit:** `game/package.json` — `validate:spire-ascent:telepipe-new-sortie` npm script.
- **Reuse (no change expected):** `game/server/debugScenarios.js` (`spire-ascent-telepipe-ready`), `game/client/main.js` (`runId`, `abandonRunBtnUsable`, `window.__abandonSuspendedRunForTest`).
- **Depends on:** none; consumed by any future full revalidation (sub-ticket **05**, passed).

## Verification: code
