# Ether Siphon — drain VFX primitive

Add a dedicated `spawnEtherSiphonEffect` primitive in `renderer.js` so Ether Siphon reads unmistakably as an ethereal mana-drain siphon — violet inward-pulling ether tendrils plus a contracting ground ring — instead of the generic expanding telegraph ring + accent burst used today. This primitive is the visual foundation sub-ticket 02 composes via `renderManaLeach`.

## Acceptance Criteria

- `spawnEtherSiphonEffect(origin, radius, style = {})` spawns **two** registered meshes: (1) a **contracting** ground ether ring scaled to `radius` (inward siphon pull, visually distinct from the expanding `spawnTelegraphRing` lifecycle), and (2) a short vertical violet ether wisp/column rising from the origin (modeled on `spawnThermalColumnShaft` / `spawnDivineGraceColumn`, but in the Ether Siphon purple palette).
- Both meshes use the Ether Siphon accent palette: default color `0xa855f7`, emissive `0x9333ea` (overridable via `style.color` / `style.emissive`).
- Every mesh is pushed to `activeEffects` with a finite `duration` (default `SUMMON_EFFECT_DURATION` or `style.duration`) and added to `window.___test_scene || scene` like other 315 primitives.
- The column entry uses `isEtherSiphonColumn: true`; the ring entry uses `isEtherSiphonRing: true`. `updateAttackEffects()` animates the ring **contracting** toward the origin (inverse of the telegraph expand path) and the column with a brief rise then fade/emissive flicker.
- The two-argument call `spawnEtherSiphonEffect(origin, radius)` remains backward-compatible (defaults apply).
- No per-frame geometry allocation; mesh count for one cast stays in the same order of magnitude as `spawnDivineGraceEffect` (ring + column).
- `game/client/test/vfx-primitives.test.js` adds a smoke test: spawn pushes two `activeEffects` entries (one flagged `isEtherSiphonColumn`, one `isEtherSiphonRing`), asserts violet palette, finite duration, and cleanup after `updateAttackEffects()` when past duration.
- No changes to `cardRenderers.js`, server code, or other cards' primitives.

## Technical Specs

- **`game/client/renderer.js`**:
  - Define palette constants near the other VFX blocks (e.g. `ETHER_SIPHON_COLOR`, `ETHER_SIPHON_EMISSIVE`, `ETHER_SIPHON_COLUMN_HEIGHT`).
  - Add `spawnEtherSiphonRing(origin, radius, style)` — unit-radius ring mesh scaled to `radius`, registered with `isEtherSiphonRing: true`; animate scale shrinking toward ~0.35× over the effect duration in `updateAttackEffects()`.
  - Add `spawnEtherSiphonColumn(origin, style)` — tapered `CylinderGeometry` violet wisp column, registered with `isEtherSiphonColumn: true`; rise/fade branch in `updateAttackEffects()` modeled on the `isThermalColumn` / `isLightColumn` paths.
  - Export `spawnEtherSiphonEffect(origin, radius, style = {})` composing ring + column; accept optional `style.duration`.
- **`game/client/test/vfx-primitives.test.js`**: import `spawnEtherSiphonEffect`; assert two effects, flags, violet emissive, finite duration, cleanup.
- Do **not** modify `cardRenderers.js`, `main.js`, or server code in this sub-ticket.

## Verification: code
