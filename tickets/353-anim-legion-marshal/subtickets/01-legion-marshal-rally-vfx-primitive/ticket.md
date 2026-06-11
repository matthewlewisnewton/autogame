# Legion Marshal — necrotic rally VFX primitive

Add a dedicated `spawnLegionMarshalRallyEffect` primitive in `renderer.js` so the Legion Marshal (`undead_commander`) cast reads unmistakably as an undead commander rallying a skeletal legion — bone-white and necrotic purple, with a rising bone-shard burst — instead of the generic amber `spawnSummonEffect` ground ring used today. This primitive is the visual foundation sub-ticket 02 composes via `renderUndeadCommander`.

## Acceptance Criteria

- `spawnLegionMarshalRallyEffect(origin, radius, style = {})` spawns at least two visible elements registered in `activeEffects` with finite `duration`:
  1. An expanding bone-white/purple ground rally ring at `radius` (reuse the `spawnSummonEffect` expand→fade lifecycle pattern).
  2. A short vertical rising bone-shard / necrotic wisp column from the origin (modeled on `spawnDivineGraceColumn` / `spawnEtherSiphonColumn` `isLightColumn` pattern, but in the Legion Marshal palette).
- Default palette matches the card accent: color `0xe4e4e7` (bone white), emissive `0xa855f7` (necrotic purple), overridable via `style.color` / `style.emissive`.
- Optional compact upward particle burst via existing `spawnParticleBurst` is allowed if it stays within the same order of magnitude as other creature cast primitives.
- Every mesh is added to `window.___test_scene || scene` and cleaned up via `updateAttackEffects` (default duration `SUMMON_EFFECT_DURATION` or `style.duration`).
- The primitive is a pure additive VFX call: no network traffic, no server changes, no changes to `minionSync.js` mesh scale-in logic.
- `game/client/test/vfx-primitives.test.js` adds a smoke test asserting the primitive pushes the expected `activeEffects` entries with bone/purple palette and finite duration, and that effects are removed after `updateAttackEffects()` past duration.
- Do **not** modify `cardRenderers.js`, `main.js`, or server code in this sub-ticket.

## Technical Specs

- **`game/client/renderer.js`**:
  - Define palette constants near other VFX blocks (e.g. `LEGION_MARSHAL_COLOR = 0xe4e4e7`, `LEGION_MARSHAL_EMISSIVE = 0xa855f7`, `LEGION_MARSHAL_COLUMN_HEIGHT`).
  - Implement `export function spawnLegionMarshalRallyEffect(origin, radius, style = {})` (~after `spawnMinionSummonInEffect`):
    1. Expanding ground rally ring at `radius` (ring geometry + expand→fade, same pattern as `spawnSummonEffect`).
    2. Vertical open-ended cylinder or tapered column rising from origin with `isLegionMarshalColumn: true` (or equivalent flag) animated in `updateAttackEffects()`.
    3. Optional `spawnParticleBurst` at `{ x: origin.x, y: 0.5, z: origin.z }` with modest count/spread.
  - Default `radius` fallback: `2` (matches current `renderUndeadCommander` commander ring).
- **`game/client/test/vfx-primitives.test.js`**: import `spawnLegionMarshalRallyEffect`; assert `activeEffects` gains entries with correct flags, palette, finite duration, and cleanup.

## Verification: code
