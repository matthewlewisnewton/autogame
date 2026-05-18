# Client Dungeon Geometry

Replace the single flat floor with 3D room and wall geometry built from the server-authoritative layout. Each room gets a floor tile and wall meshes; passages get connecting floor and side walls.

## Acceptance Criteria
- On receiving `init`, the client reads `layout` from the payload and builds Three.js meshes for all rooms and passages
- Each room renders as a raised floor tile (distinct color from the background) surrounded by wall meshes
- Passages render as narrow floor corridors with side walls connecting rooms
- The old 50×50 single floor plane is removed
- Walls are visually distinct (different color or material from floors)
- The camera follow and player rendering continue to work correctly inside the dungeon

## Technical Specs
- **File**: `game/client/main.js`
- Add a `buildDungeon(layout)` function called from `initScene()` (or right after it), receiving the layout from `gameState.layout`
- For each room: create a `BoxGeometry` or `PlaneGeometry` floor tile, and `BoxGeometry` wall meshes for each wall segment
- For each passage: create a narrow floor strip and thin wall meshes along its edges
- Use distinct materials — e.g., `0x334155` for floors, `0x475569` for walls — to make structure readable
- Remove the existing 50×50 floor plane creation in `initScene()`
- Position the player at the center of the first room on spawn (instead of origin)

## Verification: code
