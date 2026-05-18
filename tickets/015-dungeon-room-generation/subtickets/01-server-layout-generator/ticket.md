# Server Layout Generator

Generate a semi-procedural dungeon layout on the server and broadcast it to every client on connect. The layout consists of multiple rooms (each with position, size, and wall segments) connected by passages, all derived from a deterministic seed.

## Acceptance Criteria
- A `generateLayout(seed)` function exists in `game/server/index.js` that produces a layout object containing an array of rooms and passages
- Each room has `x`, `z`, `width`, `depth`, and `walls` (array of wall segments with position + orientation)
- Passages connect adjacent rooms and also carry wall data for their boundaries
- The layout is fully traversable — every room is reachable from every other room
- The server generates a random seed at startup, stores it on `gameState`, and includes it (along with the layout) in the `init` payload sent to each new client
- Calling `generateLayout` with the same seed always returns an identical layout

## Technical Specs
- **File**: `game/server/index.js`
- Add a `generateLayout(seed)` function using a simple seeded PRNG (e.g., mulberry32 or similar)
- Layout structure: `{ rooms: [{x, z, width, depth, walls: [{x, z, length, axis}]}, …], passages: [{x1, z1, x2, z2, walls: […]}, …] }`
- Generate at least 4 rooms arranged in a connected graph (e.g., a small grid or chain with branches)
- Walls bound each room on all 4 sides, with gaps where passages connect
- Store `gameState.layoutSeed` and `gameState.layout` at server start; include both in the `init` emit
- Rooms should span a larger area than the current [-25, 25] bounds so the level feels bigger

## Verification: code
