# Sloped Passage Client Rendering

Render ramp passages with sloped floor meshes (matching room slope rendering) so spire ascent is visible in the client and floor Y aligns with server `floorCorners`.

## Acceptance Criteria

- When a passage object includes non-uniform `floorCorners`, `buildDungeon()` renders a sloped floor mesh instead of a flat box at `FLOOR_Y`.
- Sloped passage mesh corner positions match `passage.floorCorners` (same convention as rooms: NW/NE/SE/SW relative to passage center).
- Flat passages (no `floorCorners` or uniform corners) render identically to today — no visual regression on default layouts.
- Passage side walls remain at appropriate heights (reuse existing wall mesh logic; walls may stay vertical).
- Client unit tests in `game/client/test/dungeon.test.js`: sloped passage produces non-zero `rotation.x` or `rotation.z` on the floor mesh (same assertions pattern as sloped rooms); flat passage unchanged.
- `buildPassageFloorSpec` (or successor) exposes enough geometry metadata for sloped mesh placement when `floorCorners` present.

## Technical Specs

- **Files:** `game/client/dungeon.js`, `game/client/test/dungeon.test.js`.
- **Reuse:** `buildSlopedFloorMesh` / `isUniformFloor` patterns already used for rooms; factor a shared helper if needed (`buildSlopedFloorMeshFromCorners(centerX, centerZ, width, depth, floorCorners)`).
- **Positioning:** mesh center Y should reflect the average corner height (or min corner) so the slab sits on the ramp, not at global `FLOOR_Y`.
- **Passages without `floorCorners`:** keep current `BoxGeometry` + `FLOOR_Y` path in the passage build loop.

## Verification: code
