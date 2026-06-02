# Sunken Canyon two-band layout

Implement `generateLayout({ stage: "sunken-canyon" })` (or equivalent `options.stage`) to produce the plateau + canyon floor geometry, outer walls, and 2–3 descending ramp paths using the ramp helper from sub-ticket 01.

## Acceptance Criteria

- `generateLayout(seed, profile, { stage: "sunken-canyon", slopes: true })` returns a layout with `layout.stage === "sunken-canyon"` (or equivalent metadata) and does not run the default grid growth path.
- Exactly two elevation bands: one upper **plateau** room (~12–15 unit width/depth, flat `floorCorners`) and one lower **canyon floor** walkable region with area ≥ 4× a default room (`MIN_ROOM_SIZE`² from `dungeon.js`).
- 2–3 distinct ramp rooms connect plateau → canyon; each uses non-uniform `floorCorners` from the ramp helper, average slope ≥ 0.15, and there is no unreachable vertical cliff between bands (BFS reachability from plateau center to canyon center through ramp + floor AABBs).
- Plateau center Y minus canyon center Y ≥ 8 units (measured via `sampleFloorY` at room centers).
- Outer perimeter walls enclose both bands with no gaps in `layout.rooms[*].walls` + `computeDungeonBounds`.
- Same seed produces deep-equal layout on repeated calls.
- Unit tests in `dungeon.test.js` cover: stage dispatch, two bands, canyon area ratio, ramp count 2–3, Y drop ≥ 8, slope bounds, reachability, determinism.

## Technical Specs

- **`game/server/dungeon.js`**: branch at top of `generateLayout` when `options.stage === "sunken-canyon"`; add `generateSunkenCanyonLayout(seed, options)` that places plateau north of canyon, sizes canyon ≥ `4 * MIN_ROOM_SIZE * MIN_ROOM_SIZE`, places 2–3 `createRampRoom` instances at spaced plateau edges, and tags rooms with `elevationBand: "plateau" | "canyon" | "ramp"`.
- **`game/server/dungeonRamps.js`**: consume `createRampRoom` from sub-ticket 01.
- **`game/server/test/dungeon.test.js`**: new `describe("generateLayout sunken-canyon")` block with helpers reusing `buildAdjacencyMap`, `bfsDistances`, `sampleFloorY`, and `computeWalkableAABBs` from `simulation.js`.
- **`game/shared/floorSampling.esm.js`**: no changes expected; use existing `sampleFloorY` in tests.

## Verification: code
