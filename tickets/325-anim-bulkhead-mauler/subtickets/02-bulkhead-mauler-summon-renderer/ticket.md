# Bulkhead Mauler — summon renderer, registration & deploy wiring

Give `bulkhead_mauler` a dedicated card-specific summon renderer so deploying a Bulkhead Mauler reads unmistakably as a heavy stone construct taking the field — not a mis-fired shockwave cone. Compose sub-ticket 01's deploy primitive with the shared `spawnMinionSummonInEffect` flourish, timed to the minion summon-in window. Split the card registration into summon + attack renderers (attack polish lands in sub-ticket 03). Depends on sub-ticket 01 (`spawnBulkheadMaulerDeployEffect`).

## Background (verified, do not re-derive)

- Server `cardEffects.js` `bulkhead_mauler` branch resolves **instantly** (no `windUpMs`): it pushes one minion at the cast origin in a single `CARD_USED` emit with `{ origin, minionId, hits: [] }` — **no** `specialEffect` on summon.
- Client `minionSync.js` scales new minion meshes in over `MINION_SUMMON_IN_MS` (750 ms). Summon VFX must fire **synchronously** on `CARD_USED` receipt (no projectile travel, no `scheduleAfter` deferral).
- Card stats (`shared/cardStats.json`): `minionHp: 100`, `minionTtl: 30`, `attackRange: 4`, `attackDamage: 9`, `attackIntervalMs: 1500`, `specialEffect: "shockwave_sweep"` (attack-only). No wind-up telegraph.
- Today `bulkhead_mauler: renderShockwaveSweep` is the sole registry entry — summon events incorrectly run the attack renderer because it only guards on `data.origin`.
- `MINION_VISUAL.bulkhead_mauler` already exists in `renderer.js` (box silhouette, slate/amber palette); verify it still matches the card theme after this pass.

## Acceptance Criteria

- A new card-specific summon renderer function (e.g. `renderBulkheadMaulerSummon`) exists in `game/client/cardRenderers.js`.
- `CARD_RENDERERS.bulkhead_mauler` is registered as an array `[renderBulkheadMaulerSummon, renderBulkheadMaulerShockwaveSweep]` where the attack slot is the existing `renderShockwaveSweep` (renamed or aliased) until sub-ticket 03 upgrades it.
- `resolveRenderers('bulkhead_mauler')` returns exactly **two** renderers (summon + attack), neither of which is the generic `creature` type-default (`renderCreatureSummon`).
- On summon (`data.minionId` present, **no** `specialEffect === 'shockwave_sweep'`), the summon renderer calls:
  - `ctx.spawnBulkheadMaulerDeployEffect(originOf(data), bulkheadStyle)` for the stone assembly flourish.
  - `ctx.spawnMinionSummonInEffect(originOf(data), bulkheadStyle)` with slate/amber palette and parameters distinct from the generic green default.
- Summon renderer early-returns when `data.specialEffect === 'shockwave_sweep'` or when `data.minionId` is absent — it must not fire on minion attack `CARD_USED` events.
- All flourish durations passed to primitives use `MINION_SUMMON_IN_MS` (750 ms) so VFX lifetime matches the minion mesh scale-in.
- Bulkhead Mauler has **no** `windUpMs` — summon VFX fires synchronously on `CARD_USED` with no `scheduleAfter` delay.
- Every `ctx.*` call is guarded so optional primitives never throw.
- `main.js` `cardRenderCtx` exposes `spawnBulkheadMaulerDeployEffect` from `renderer.js`.
- `pnpm test:quick` passes; sub-ticket 04 owns extended test assertions.

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Add `BULKHEAD_MAULER_COLOR` / `BULKHEAD_MAULER_EMISSIVE` constants (or reuse module-level palette from sub-ticket 03 if already present).
  - Add `renderBulkheadMaulerSummon(data, ctx)`: early-return unless `data.minionId && data.specialEffect !== 'shockwave_sweep'`; compose `spawnBulkheadMaulerDeployEffect` + `spawnMinionSummonInEffect` at `originOf(data)`.
  - Change registration from `bulkhead_mauler: renderShockwaveSweep` to `bulkhead_mauler: [renderBulkheadMaulerSummon, renderShockwaveSweep]` (attack function may be renamed in sub-ticket 03).
  - Update the ctx interface comment block to document `spawnBulkheadMaulerDeployEffect`.
- **`game/client/main.js`**: import and wire `spawnBulkheadMaulerDeployEffect` on `cardRenderCtx`.
- **`game/client/renderer.js`**: read-only verification of `MINION_VISUAL.bulkhead_mauler`; touch only if emissive/palette drifted from card accent.
- **Server reference** (read-only): `cardEffects.js` ~L1336–1340 sets minion attack stats on spawn. Do not modify server code.
- Do **not** modify `spawnBulkheadMaulerDeployEffect` internals (owned by sub-ticket 01) or upgrade the attack renderer (owned by sub-ticket 03).

## Verification: code
