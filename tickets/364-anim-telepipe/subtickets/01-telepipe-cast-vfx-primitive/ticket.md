# Telepipe cast VFX primitive

Add a dedicated `spawnTelepipeCastEffect` primitive in `renderer.js` for the instant portal-opening flourish when the Telepipe spell is cast. The current `renderTelepipe` path only calls the generic `spawnSummonEffect` ground ring, which does not read as an evacuation warp tube. This primitive is the visual foundation for sub-ticket 02.

## Acceptance Criteria

- `spawnTelepipeCastEffect(origin, radius, style?)` in `game/client/renderer.js` creates a brief, transient portal-opening silhouette using the cyan Telepipe palette (`#67e8f9` / `#22d3ee`, matching `cards.js` accent and the persistent portal in `lootSync.js`).
- The effect composes at least two visible elements registered in `activeEffects` with finite `duration` (e.g. an expanding ground ring **and** a rising open-ended cylinder shaft modeled on the telepipe portal column / `spawnDivineGraceColumn` `isLightColumn` pattern), so it reads as a warp-tube opening — not a flat generic summon ring.
- Optional third flourish (e.g. compact `spawnParticleBurst` or orbiting ring meshes) may be included if it stays within the same order of magnitude as other spell cast primitives; no per-frame geometry allocation.
- Every mesh is added to `window.___test_scene || scene` and cleaned up via the existing `updateAttackEffects` lifecycle (`SUMMON_EFFECT_DURATION` or equivalent).
- The primitive is a pure additive VFX call: no network traffic, no server changes, no changes to `syncTelepipeMesh` / persistent portal code in `lootSync.js`.
- `game/client/test/vfx-primitives.test.js` (or a colocated test) asserts the primitive pushes the expected `activeEffects` entries with cyan palette and finite duration.
- Do **not** modify `cardRenderers.js` or `main.js` in this sub-ticket.

## Technical Specs

- **`game/client/renderer.js`**:
  - Add named palette constants near other spell palettes (e.g. `TELEPIPE_CAST_COLOR = 0x67e8f9`, `TELEPIPE_CAST_EMISSIVE = 0x22d3ee`).
  - Implement `export function spawnTelepipeCastEffect(origin, radius, style = {})` (~after `spawnSummonEffect` / near other 315 primitives):
    1. Expanding ground ring at `radius` (reuse ring-geometry + expand→fade pattern from `spawnSummonEffect`).
    2. Vertical open-ended cylinder shaft rising from origin (`isLightColumn: true` branch in `updateAttackEffects`, same base-pinning approach as `spawnDivineGraceColumn`).
    3. Optional upward particle burst via existing `spawnParticleBurst` helper (not a new per-frame pool).
  - Honor `style.color` / `style.emissive` overrides; default to Telepipe cyan palette.
  - Default `radius` fallback: `2.5` (matches server `PORTAL_RADIUS` in `game/server/config.js`).
- **`game/client/test/vfx-primitives.test.js`**: smoke test spawning the primitive, asserting `getActiveEffects()` gains entries, verifying cleanup after `updateAttackEffects()` past duration.
- **Read-only reference**: persistent portal mesh palette in `game/client/renderer/lootSync.js` (`syncTelepipeMesh`) — cast palette should match but that file is out of scope here.

## Verification: code
