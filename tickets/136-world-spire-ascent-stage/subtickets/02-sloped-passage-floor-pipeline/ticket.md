# 02 — Sloped passage floors (sample, walk, render)

Extend the floor pipeline so ramp **passages** can carry `floorCorners` and participate in height sampling, walkability, and client rendering — not just sloped rooms.

## Acceptance Criteria

- Passage schema may include optional `floorCorners` plus `floorWidth` / `floorDepth` / `floorX` / `floorZ` (center and size of the corridor slab, aligned with `buildPassageFloorSpec` geometry).
- `sampleFloorY(layout, x, z)` in `game/shared/floorSampling.esm.js` returns bilinear height inside sloped passages after checking rooms (passages without `floorCorners` unchanged).
- `computeWalkableAABBs` (server `simulation.js` and client `dungeon.js`) uses the corridor rectangle from passage floor fields when present, not the oversized center-to-center box.
- `buildDungeon` renders sloped passage floors via `buildSlopedFloor` when a passage has non-uniform `floorCorners`; passage side walls use `sampleFloorY` for base Y (same as room walls).
- Existing flat layouts and `{ slopes: true }` grid dungeons behave identically (no regressions in current `dungeon.test.js` / `shared-floor-sampling.test.js`).
- Unit tests prove: a point on a sloped test passage returns interpolated Y; walkable AABB matches corridor bounds; client `buildPassageFloorSpec` + sloped passage path does not throw.

## Technical Specs

- **`game/shared/floorSampling.esm.js`**: add passage iteration using passage floor center/size + `floorCorners`; keep room logic first.
- **`game/shared/floorSampling.js`**: no duplicated logic — ensure CJS bridge still re-exports updated ESM (regenerate or rely on existing eval bridge per project convention).
- **`game/server/simulation.js`**: update `computeWalkableAABBs` for passages with `floorWidth`/`floorDepth`/`floorX`/`floorZ`.
- **`game/client/dungeon.js`**: mirror walkable AABB change; in passage build loop, branch to `buildSlopedFloor` when passage has sloped corners (may wrap passage in a pseudo-room shape `{ x: floorX, z: floorZ, width: floorWidth, depth: floorDepth, floorCorners }`).
- **`game/server/test/applyPlayerMovement.test.js`** or **`game/client/test/shared-floor-sampling.test.js`**: add at least one sloped-passage height sample test.
- **`game/client/test/dungeon.test.js`**: extend `buildPassageFloorSpec` / sloped passage render coverage.

## Verification: code
