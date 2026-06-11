# Glacier Rupture — shatter VFX primitive

Add a dedicated `spawnGlacierRuptureEffect` primitive in `renderer.js` so Glacier Rupture reads unmistakably as a cracking glacier collapse — an expanding ice-fracture ground ring plus upward/outward ice-shard burst — instead of the generic `spawnSummonEffect` expanding ring used today. This primitive is the visual foundation sub-ticket 02 composes via `renderGlacierCollapse`.

## Acceptance Criteria

- `spawnGlacierRuptureEffect(origin, radius, style = {})` spawns **two** registered meshes: (1) an **expanding** ground ice-fracture ring scaled to `radius` (crack/shatter read, visually distinct from a plain `spawnTelegraphRing` or `spawnSummonEffect` lifecycle), and (2) a short burst of upward/outward ice shards or a tapered ice column rising from the origin (modeled on `spawnSpikeTrapEffect` spikes or `spawnDivineGraceColumn`, but in the fixed glacier palette).
- Both meshes use the Glacier Rupture palette: default color `0x38bdf8`, emissive `0x0ea5e9` (overridable via `style.color` / `style.emissive`).
- Every mesh is pushed to `activeEffects` with a finite `duration` (default `SUMMON_EFFECT_DURATION` or `style.duration`) and added to `window.___test_scene || scene` like other 315 primitives.
- The shard/column entry uses `isGlacierRuptureShards: true`; the ring entry uses `isGlacierRuptureRing: true`. `updateAttackEffects()` animates the ring **expanding** to `radius` then fading (reuse the shared radius-based expand→fade path used by `spawnSpikeTrapEffect`'s ring), and the shards with a brief rise/outward scatter then fade.
- The two-argument call `spawnGlacierRuptureEffect(origin, radius)` remains backward-compatible (defaults apply).
- No per-frame geometry allocation; mesh count for one cast stays in the same order of magnitude as `spawnSpikeTrapEffect` (ring + shard group).
- `game/client/test/vfx-primitives.test.js` adds a smoke test: spawn pushes two `activeEffects` entries (one flagged `isGlacierRuptureShards`, one `isGlacierRuptureRing`), asserts glacier palette, finite duration, and cleanup after `updateAttackEffects()` when past duration.
- No changes to `cardRenderers.js`, server code, or other cards' primitives.

## Technical Specs

- **`game/client/renderer.js`**:
  - Define palette constants near the other VFX blocks (e.g. `GLACIER_RUPTURE_COLOR`, `GLACIER_RUPTURE_EMISSIVE`, `GLACIER_RUPTURE_SHARD_HEIGHT`).
  - Add `spawnGlacierRuptureRing(origin, radius, style)` — unit-radius ring mesh scaled to `radius`, registered with `isGlacierRuptureRing: true`; animate expand→fade in `updateAttackEffects()` using the same radius-interpolation pattern as `spawnSpikeTrapEffect`'s hazard ring.
  - Add `spawnGlacierRuptureShards(origin, radius, style)` — small cluster of tapered shard meshes (e.g. `ConeGeometry` or thin boxes) rising/scattering from the origin, registered with `isGlacierRuptureShards: true`; rise/scatter/fade branch in `updateAttackEffects()`.
  - Export `spawnGlacierRuptureEffect(origin, radius, style = {})` composing ring + shards; accept optional `style.duration`.
- **`game/client/test/vfx-primitives.test.js`**: import `spawnGlacierRuptureEffect`; assert two effects, flags, glacier emissive, finite duration, cleanup.
- Do **not** modify `cardRenderers.js`, `main.js`, or server code in this sub-ticket.

## Verification: code
