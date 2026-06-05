# Profile landmark props

Place 1–2 deterministic landmark props per layout so each profile has an unmistakable biome signature beyond materials and cover.

## Acceptance Criteria

- `generateLayout` for `crowded` and `open` profiles returns a `landmarks` array with 1–2 entries: `{ x, z, type, yaw? }`.
- Landmark types are profile-specific: crowded uses `reactor_coil` and/or `pipe_stack`; open uses `sand_spire` and/or `sun_arch`.
- Landmarks are placed in non-start rooms, clear of cover footprints and passage doorway gaps; placement is deterministic per seed.
- Client `buildDungeon` renders each landmark as a composed mesh (stacked cylinders/boxes/torus) using profile materials with a bright emissive accent so landmarks read at a distance.
- Landmarks do not add collision (visual identity only).
- Vitest asserts landmark count, allowed types per profile, and that client `buildDungeon` adds one mesh group per landmark.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `LANDMARK_TYPES` map per profile and `placeLandmarks(layout, rng)`.
  - Invoke from crowded and open branches of `generateLayout` after cover/platform/hazard decoration.
  - Pick 1–2 host rooms (prefer combat or treasure), sample an interior point with margin from walls/cover/doorways.
- `game/client/dungeon.js`:
  - Add `buildLandmarkMesh(type, materials)` returning a `THREE.Group` with profile-appropriate primitive composition and emissive accent.
  - In `buildDungeon`, iterate `layout.landmarks || []`, position at `(lm.x, floorY, lm.z)`, apply `lm.yaw` rotation, push group children into `meshes` for disposal tracking.
  - Export `buildLandmarkMesh` for tests.
- `game/server/test/dungeon.test.js` and `game/client/test/dungeon.test.js`: landmark presence, type whitelist, and mesh group count.

## Verification: code
