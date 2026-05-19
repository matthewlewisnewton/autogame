# Extract Client Dungeon Building to Dedicated Module

Move `buildDungeon()`, `clearDungeon()`, `buildWallColliders()`, and `resolveWallCollision()` from `client/main.js` into a new `game/client/dungeon.js` module. Extract visual constants (`WALL_HEIGHT`, `FLOOR_Y`, `WALL_THICKNESS`, `PASSAGE_WALL_HEIGHT`, `PASSAGE_WALL_THICKNESS`) alongside shared materials.

## Acceptance Criteria
- `game/client/dungeon.js` exports `buildDungeon(scene, layout)`, `clearDungeon(scene)`, `buildWallColliders(layout)`, and `resolveWallCollision(newX, newZ, collidersRef)`
- `buildDungeon(scene, layout)` creates room floors, room walls, passage floors, and passage walls as Three.js meshes added to the provided scene
- `clearDungeon(scene)` removes all dungeon meshes from the scene and disposes geometries
- `buildWallColliders(layout)` returns an array of wall AABBs (no longer relying on a module-level `wallColliders` variable)
- `main.js` imports from `dungeon.js` and delegates all dungeon geometry work
- `main.js` no longer defines `buildDungeon`, `clearDungeon`, or `buildWallColliders` inline
- Existing visual appearance (wall height, floor position, passage style) is unchanged

## Technical Specs
- **New file**: `game/client/dungeon.js` — exports `buildDungeon(scene, layout)`, `clearDungeon(scene, dungeonMeshes)`, `buildWallColliders(layout)`, constants (`WALL_HEIGHT`, `WALL_THICKNESS`, `FLOOR_Y`, `PASSAGE_WALL_HEIGHT`, `PASSAGE_WALL_THICKNESS`), and shared materials (`groundMaterial`, `floorMaterial`, `wallMaterial`, `passageFloorMaterial`)
- **Modify**: `game/client/main.js` — import from `dungeon.js`; replace inline dungeon functions with calls to the module; pass `scene` and `layout` as arguments; store `wallColliders` as a local variable returned by `buildWallColliders`
- **Modify**: `game/client/collision.js` — no changes needed (already a pure module); `dungeon.js` imports `wallAABB` from `collision.js`

## Verification: code
