# Render Plaza Cover Pieces + Platforms on the Client

Draw the open-plaza cover pieces and their sloped platforms in the Three.js
client, and add matching client-side colliders so movement prediction blocks on
cover exactly like the server. The plaza floor and outer walls already render via
the existing room loop — this sub-ticket only adds the cover.

## Acceptance Criteria

- `buildDungeon()` renders a box mesh for every `layout.cover` piece: `pillar`
  renders as a **tall** box, `brokenWall`/`planter` as a **low** box, each sized
  to the piece footprint and seated at its plaza floor Y.
- Cover pieces that carry a `floorCorners` platform also render the platform as a
  sloped floor patch (reuse `buildSlopedFloor()` / the existing `floorCorners`
  path), so the gentle rise reads visually.
- The client `buildWallColliders()` includes an AABB for every cover piece, so
  client-side movement/prediction collides with cover (matching the server).
- All cover/platform meshes are pushed into the `dungeonMeshes` array and are
  removed + geometry-disposed by `clearDungeon()` (no leak across rebuilds).
- A layout without a `cover` array still builds correctly (no crash; backward
  compatible with the existing rooms-and-passages layouts).
- Unit tests cover: `buildDungeon()` on an open-plaza layout produces the
  expected number of cover meshes (and platform meshes), and
  `buildWallColliders()` returns the expected number of cover colliders.

## Technical Specs

- `game/client/dungeon.js`: in `buildDungeon()`, after the room/passage loops,
  iterate `layout.cover` and add a `THREE.BoxGeometry` mesh per piece (height
  from `type`: tall for `pillar`, low for `brokenWall`/`planter`); for pieces
  with `floorCorners`, build the sloped patch via `buildSlopedFloor()`. In
  `buildWallColliders()`, append a `wallAABB`-equivalent / box AABB for each cover
  piece. Reuse the existing wall/box materials — no new asset pipeline.
- `game/client/test/dungeon.test.js`: add the unit tests described above using a
  small hand-built open-plaza layout fixture (rooms + `cover`).

## Verification: code
