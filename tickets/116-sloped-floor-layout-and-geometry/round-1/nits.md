## Document floorCorners schema in design.md

`game/docs/design.md` describes sloped floors conceptually but does not name the `floorCorners: { yNW, yNE, ySE, ySW }` field that every generated room now carries. A one-line schema note would help downstream tickets (117 movement, future passage slopes) without reading server code.
### Acceptance Criteria
- `game/docs/design.md` **Floor Geometry** lists `floorCorners` with corner labels matching `floorSampling.esm.js` (NW/NE/SE/SW relative to room center).

## Wall meshes ignore sloped floor height

`buildDungeon()` places room walls at `WALL_HEIGHT / 2 + FLOOR_Y` (visual constant `0.05`) even when the floor mesh uses corner heights `0.5`–`2.0`. On ramp rooms, wall bases may appear to float or clip relative to the inclined floor until art pass or ticket 117 movement work.
### Acceptance Criteria
- Sloped rooms position wall segments so their base aligns with `sampleFloorY()` at the wall’s `(x, z)` (or a documented approximation), verified in a sloped test layout screenshot or unit assertion on wall `position.y`.

## Harness ramp-focused capture

Round-1 capture fell back to generic lobby/movement smoke (`capturePlanSource: "fallback-after-error"`) and did not frame a visible ramp. Future rounds could use seed/profile known to place a ramp near spawn-adjacent combat rooms for visual QA.
### Acceptance Criteria
- Harness capture plan includes at least one screenshot whose description states a sloped room/ramp is in frame, taken after deploy with `{ slopes: true }` layout.

## Sloped floor mesh is a rotated box approximation

`buildSlopedFloor()` uses a single rotated `BoxGeometry` along the dominant axis; bilinear `sampleFloorY()` defines a slightly different surface for non-axis-aligned corner patterns (e.g. diagonal ramps). Acceptable for ticket 116 scope but may show minor gaps at room edges.
### Acceptance Criteria
- Either document the box approximation in `buildSlopedFloor` JSDoc as intentional, or switch sloped rooms to a four-corner `BufferGeometry` floor that matches bilinear sampling within a small epsilon at room corners.
