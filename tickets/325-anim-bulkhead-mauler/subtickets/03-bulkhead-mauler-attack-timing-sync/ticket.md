# Bulkhead Mauler — shockwave attack renderer & server timing sync

Rewrite the Bulkhead Mauler attack renderer to compose sub-ticket 01's shockwave primitive so each minion cone sweep reads unmistakably as a heavy stone construct mauling enemies in a short wide arc, with animation timing synced to the server's instant cone resolution. Depends on sub-tickets 01 (`spawnBulkheadMaulerShockwaveEffect`) and 02 (split `[summon, attack]` registration).

## Background (verified, do not re-derive)

- Server `simulation.js` `bulkhead_mauler` minion loop (~L3686–3721): when an enemy is within `attackRange` (4) and `now - lastAttackAt >= attackIntervalMs` (1500), it calls `collectConeHits` **instantly** (no wind-up, no projectile travel) and queues `_pendingMinionBreaths` with `{ cardId: 'bulkhead_mauler', specialEffect: 'shockwave_sweep', origin, direction, attackRange, attackConeAngle, hits, minionId }`.
- `index.js` drains `_pendingMinionBreaths` each tick, emitting `CARD_USED` with that payload — the client must render the shockwave **synchronously** on receipt (no `scheduleAfter`, no artificial travel delay).
- There is **no** `windUpMs` on this card and **no** 307 charge telegraph.
- Attack `CARD_USED` events carry `specialEffect: 'shockwave_sweep'` and **no** `minionId` on the summon path (summon events carry `minionId` without `specialEffect`).
- `enemySync.js` `MINION_HIT_VFX.bulkhead_mauler.spawn` is the HP-drop / attribution fallback when `cardUsed` may have been missed within `CARD_HIT_GRACE_MS`; it currently calls generic `spawnAttackEffect` and should be upgraded to the new primitive for visual consistency.

## Acceptance Criteria

- `renderBulkheadMaulerShockwaveSweep` (renamed from `renderShockwaveSweep`) early-returns unless `data.specialEffect === 'shockwave_sweep'` and `data.origin` is present — it must **not** fire on summon (`data.minionId` without `specialEffect`).
- On attack, the renderer calls `ctx.spawnBulkheadMaulerShockwaveEffect(originOf(data), directionOf(data), { range: data.attackRange, coneAngle: data.attackConeAngle, color, emissive })` using server-reported `attackRange` (4) and `attackConeAngle` (`2π/3`), not hard-coded fallbacks when payload values are present.
- For each entry in `data.hits`, `ctx.spawnHitSpark` fires at the enemy position (guarded when ctx helper or enemy mesh lookup is absent) with slate/amber accent — matching other creature attack renderers.
- A foot-level stone debris burst via `ctx.spawnParticleBurst` at the minion origin complements the shockwave (guarded when absent); palette matches `BULKHEAD_MAULER_COLOR` / `BULKHEAD_MAULER_EMISSIVE`.
- Renderer does **not** call `scheduleAfter`, `spawnProjectileTrail`, or any deferred timing — shockwave VFX resolves on the same frame as `CARD_USED` to match instant server cone hits.
- `enemySync.js` `MINION_HIT_VFX.bulkhead_mauler.spawn` calls `spawnBulkheadMaulerShockwaveEffect` (imported from `renderer.js`) instead of generic `spawnAttackEffect`, passing `minion.attackRange` / `minion.attackConeAngle` when available.
- `main.js` `cardRenderCtx` exposes `spawnBulkheadMaulerShockwaveEffect` from `renderer.js`.
- `bulkhead_mauler: [renderBulkheadMaulerSummon, renderBulkheadMaulerShockwaveSweep]` registration in `CARD_RENDERERS` is updated to reference the rewritten attack function.
- No server changes; no changes to other cards' renderers or the generic `applyShockwave` / `applyHitFlashes` post-effects.
- `pnpm test:quick` passes; sub-ticket 04 owns extended test assertions.

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Rename/refactor `renderShockwaveSweep` → `renderBulkheadMaulerShockwaveSweep` (~L2400): guard on `specialEffect === 'shockwave_sweep'`; replace `ctx.spawnAttackEffect` with `ctx.spawnBulkheadMaulerShockwaveEffect`; add per-hit `spawnHitSpark` loop over `data.hits || []`; retain guarded `spawnParticleBurst` at origin.
  - Define or consolidate `BULKHEAD_MAULER_COLOR` / `BULKHEAD_MAULER_EMISSIVE` constants near the renderer.
  - Update `CARD_RENDERERS.bulkhead_mauler` array entry for the attack slot.
  - Update ctx interface comment block to document `spawnBulkheadMaulerShockwaveEffect`.
- **`game/client/renderer/enemySync.js`**: import `spawnBulkheadMaulerShockwaveEffect`; update `MINION_HIT_VFX.bulkhead_mauler.spawn` (~L804–818) to call the new primitive with server-aligned range/cone params.
- **`game/client/main.js`**: import and wire `spawnBulkheadMaulerShockwaveEffect` on `cardRenderCtx`.
- **Server reference** (read-only): `simulation.js` ~L3686–3721; `creature_minions.test.js` "Bulkhead Mauler" block. Do not modify server code.
- Do **not** modify primitive internals in `renderer.js` (owned by sub-ticket 01) or the summon renderer (owned by sub-ticket 02).

## Verification: code
