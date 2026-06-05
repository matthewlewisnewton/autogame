# Per-profile floor and wall materials

Introduce a profile-keyed dungeon material palette so `open` layouts read sandy/warm and `crowded` layouts read as dark metal/industrial, instead of the shared grey-green defaults. Wire `buildDungeon` to select floor, wall, and passage materials from `layout.profile` while keeping role tints (start/treasure) as subtle overlays on the profile base.

## Acceptance Criteria

- A shared palette defines distinct floor and wall colors (and roughness) for at least `open` and `crowded` profiles; `open` uses sandy/warm tones, `crowded` uses dark metallic tones.
- `buildDungeon` applies profile materials to room floors, room walls, passage floors, and passage walls based on `layout.profile`; unknown profiles fall back to the current default palette.
- Role-specific floor tints (start, treasure) remain visible but are derived from the active profile base, not the legacy global grey-green.
- Vitest asserts that `buildDungeon` meshes for the same seed use different material colors when `layout.profile` is `open` vs `crowded`.
- Existing dungeon tests (spawn position, colliders, sloped floors) continue to pass.

## Technical Specs

- `game/shared/dungeonTheme.json` (new): export per-profile `{ floor, wall, passageFloor, passageWall }` hex colors and roughness values. Example targets: `open` floor ≈ warm sand (`#c4a574`), walls ≈ weathered sandstone; `crowded` floor ≈ gunmetal (`#2a3444`), walls ≈ darker steel (`#1a2230`).
- `game/client/dungeon.js`:
  - Add `getProfileMaterials(profile)` that lazily builds/caches `THREE.MeshStandardMaterial` instances per profile (reuse across rooms; do not allocate per mesh).
  - Replace direct use of module-level `floorMaterial` / `wallMaterial` / passage materials inside `buildDungeon` with the profile lookup (`layout.profile ?? 'crowded'`).
  - Keep `roleFloorMaterials` but tint from the active profile floor color instead of hard-coded greens.
  - Export `getProfileMaterials` (or material color getters) for tests.
- `game/client/test/dungeon.test.js`: add tests comparing material `.color.getHex()` for crowded vs open layouts generated from the same seed.

## Verification: code
