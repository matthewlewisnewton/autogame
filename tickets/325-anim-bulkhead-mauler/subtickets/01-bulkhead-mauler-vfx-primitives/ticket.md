# Bulkhead Mauler — deploy & shockwave VFX primitives

Add dedicated `spawnBulkheadMaulerDeployEffect` and `spawnBulkheadMaulerShockwaveEffect` primitives in `renderer.js` so the Bulkhead Mauler reads unmistakably as a heavy stone/iron construct — slate-gray chassis with amber forge glow — instead of the generic green minion puff and plain `spawnAttackEffect` cone. These primitives are the visual foundation sub-tickets 02–03 compose via the card renderer and minion hit-VFX fallback.

## Acceptance Criteria

- `spawnBulkheadMaulerDeployEffect(origin, style = {})` spawns at least two visible elements registered in `activeEffects` with finite `duration`:
  1. An expanding slate/amber ground assembly ring at deploy radius (reuse the `spawnSummonEffect` expand→fade lifecycle pattern).
  2. A short vertical rocky column or tapered bulkhead slab rising from the origin (modeled on `spawnBatteryAutomatonDeployEffect` / `spawnLegionMarshalRallyEffect` column paths, but in the Bulkhead Mauler palette).
- `spawnBulkheadMaulerShockwaveEffect(origin, direction, style = {})` spawns a short wide-range cone shockwave (default `range: 4`, `coneAngle: (Math.PI * 2) / 3`, overridable via `style`) with:
  1. A ground-hugging wedge or fan mesh expanding along `direction` (distinct from the generic `spawnAttackEffect` cone — heavier stone/amber materials, wider silhouette).
  2. A debris/impact burst at the construct's feet via `spawnParticleBurst` (or equivalent registered mesh) so the sweep reads as a mauling shockwave, not a spell bolt.
- Default palette matches the card accent: body color `0x78716c` (slate stone), emissive `0xf59e0b` (amber forge), overridable via `style.color` / `style.emissive`.
- Shockwave default duration is brief (~400–600 ms, overridable via `style.duration`) — the server resolves cone hits instantly on the same tick as `CARD_USED`; the primitive must not imply projectile travel.
- Column/ring/shockwave entries use distinct flags (e.g. `isBulkheadMaulerColumn`, `isBulkheadMaulerRing`, `isBulkheadMaulerShockwave`) animated in `updateAttackEffects()`.
- Every mesh is added to `window.___test_scene || scene` and cleaned up via `updateAttackEffects` when past duration.
- Primitives are pure additive VFX: no network traffic, no server changes, no changes to `cardRenderers.js` or `minionSync.js` in this sub-ticket.
- `game/client/test/vfx-primitives.test.js` adds smoke tests for both primitives: each pushes the expected `activeEffects` entries with the bulkhead palette, finite duration, and cleanup after `updateAttackEffects()` past duration.

## Technical Specs

- **`game/client/renderer.js`**:
  - Define palette constants near other VFX blocks (e.g. `BULKHEAD_MAULER_COLOR = 0x78716c`, `BULKHEAD_MAULER_EMISSIVE = 0xf59e0b`, column height ~1.4).
  - Implement `spawnBulkheadMaulerDeployEffect(origin, style = {})` composing an expanding ground ring + rising rocky column; default deploy duration aligns with `MINION_SUMMON_IN_MS` (750 ms) when `style.duration` is omitted.
  - Implement `spawnBulkheadMaulerShockwaveEffect(origin, direction, style = {})` composing a ground-hugging cone fan along `direction` plus a foot-level debris burst; default duration ~500 ms.
  - Export both functions; add `updateAttackEffects()` branches for the new flags.
- **`game/client/test/vfx-primitives.test.js`**: import both primitives; assert `activeEffects` entries, palette, finite duration, and post-duration cleanup.
- Do **not** modify `cardRenderers.js`, `main.js`, `enemySync.js`, or server code.

## Verification: code
