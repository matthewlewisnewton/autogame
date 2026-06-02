# 07 — Render elevated spire tier floors at server Y

Client dungeon meshes currently place every uniform flat room floor at the constant `FLOOR_Y`, so spire tiers with elevated but uniform `floorCorners` draw at ground level while walls, ramps, and player Y use the real height.

## Acceptance Criteria

- In `buildDungeon()`, a room with uniform `floorCorners` whose corner Y is not the default ground height positions its floor mesh at that elevation (same convention as sloped floors: use corner average / `sampleFloorY` at room center, not the global `FLOOR_Y` constant alone).
- Treasure-room exit marker mesh on spire layouts uses the treasure room’s sampled floor Y plus the existing marker height offset (not `0.75 + FLOOR_Y` at ground level).
- A generated `spire-ascent` layout’s top-tier treasure room floor mesh Y is ≥ 10 units above the start-tier floor mesh Y in client tests.
- Existing tests for legacy flat rooms at default elevation still pass (bottom tier / non-spire layouts unchanged).
- New client test in `game/client/test/dungeon.test.js` covers at least one elevated uniform tier room.

## Technical Specs

- **`game/client/dungeon.js`**:
  - Add a small helper (e.g. `uniformFloorCenterY(room, layout)`) returning average corner Y or `sampleFloorY(layout, room.x, room.z) ?? DEFAULT_FLOOR_Y` when `floorCorners` is uniform.
  - In the uniform-floor branch of `buildDungeon`, set `floorMesh.position.y` from that helper (retain thin-box geometry); keep `FLOOR_Y` only as a z-fight epsilon if the project already uses that pattern for ground-level rooms.
  - Position treasure markers with `marker.position.y = markerHalfHeight + uniformFloorCenterY(treasureRoom, layout)` (or equivalent).
- **`game/client/test/dungeon.test.js`**: add case using `generateLayout(seed, undefined, { stage: 'spire-ascent' })`, compare start vs treasure room floor mesh Y values; update any test that incorrectly expected all uniform floors at `FLOOR_Y` when corners specify a higher Y.

## Verification: code
