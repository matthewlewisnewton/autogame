# Passage side walls sample the sloped floor

Passage side walls in `buildDungeon()` are still positioned with the flat
`PASSAGE_WALL_HEIGHT / 2 + FLOOR_Y`, so doorway segments on sloped room
connections can show a small vertical mismatch. Make passage walls sample the
floor at each wall `(x, z)` exactly like room walls already do.

## Acceptance Criteria
- Each passage side wall mesh in `game/client/dungeon.js` is positioned in Y
  using `resolveFloorY(sampleFloorY(layout, wallX, wallZ)) + PASSAGE_WALL_HEIGHT / 2`,
  replacing the current flat `PASSAGE_WALL_HEIGHT / 2 + FLOOR_Y`.
- On a flat (default-band) corridor the new formula yields the same Y as
  before, so existing flat layouts are unchanged.
- A new unit test in `game/client/test/dungeon.test.js` mirrors the existing
  room-wall assertion ("positions wall Y on sloped rooms using sampleFloorY"):
  it builds a layout with a passage whose endpoints sit on a sloped room and
  asserts each passage wall mesh `position.y` equals
  `sampleFloorY(layout, wall.x, wall.z) + PASSAGE_WALL_HEIGHT / 2` (allowing for
  `resolveFloorY`).
- `pnpm test` passes from `game/`.

## Technical Specs
- `game/client/dungeon.js`: in the "Passage side walls" loop (~line 309–327),
  compute `const wallBaseY = resolveFloorY(sampleFloorY(layout, wallX, wallZ));`
  and set `wallMesh.position.set(wallX, wallBaseY + PASSAGE_WALL_HEIGHT / 2, wallZ);`.
  `resolveFloorY` and `sampleFloorY` are already imported and used by the
  room-wall loop just above (~line 265). Keep the geometry/axis branching as-is.
- `game/client/test/dungeon.test.js`: add a test mirroring the room-wall case
  (~line 227). Export `PASSAGE_WALL_HEIGHT` from `dungeon.js` if it is not
  already exported so the test can reference it.

## Verification: code
