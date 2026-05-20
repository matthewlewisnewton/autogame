# Server Collision Validation

The server currently does not validate movement positions against dungeon wall geometry. A client can emit `move` events with positions inside walls, effectively wall-clipping. Add server-side AABB collision checks using the existing dungeon layout data so the server rejects moves that place the player inside a wall.

## Acceptance Criteria
- The server checks the proposed movement position against all wall colliders from the dungeon layout.
- If the proposed position would place the player inside a wall, the server rejects the move by keeping the player at their last known position.
- The collision check uses the same dungeon layout data (`gameState.layout`) already available on the server.
- Legitimate movement through passages and between rooms is never blocked.

## Technical Specs
- **Files**: `game/server/index.js` — add a wall collision check inside the existing `socket.on('move', ...)` handler, after speed validation. Build AABB colliders from `gameState.layout.walls` (same structure as the client already uses) and check if the player's radius (e.g., 0.5) overlaps any wall box. If overlap, reject the move by returning early.
- The wall collider format from `gameState.layout` is arrays of `{x, z, w, d}` objects per wall segment. Use simple AABB overlap: `Math.abs(px - wx) < (pw/2 + pr) && Math.abs(pz - wz) < (pd/2 + pr)`.
- Do not modify any client files. Do not add new network messages.

## Verification: code
