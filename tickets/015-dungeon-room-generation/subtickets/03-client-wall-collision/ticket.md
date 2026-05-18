# Client Wall Collision

Add client-side collision detection so players cannot walk through dungeon walls. Movement is blocked before the position is emitted to the server, keeping the player inside rooms and passages.

## Acceptance Criteria
- When the player moves into a wall, their position stops at the wall boundary instead of passing through
- Collision is checked every frame in `updateMyPlayer` before the position is applied
- The player can still move freely within rooms and through passages
- After collision, the player can change direction and move along the wall
- The existing friction and acceleration movement model is preserved

## Technical Specs
- **File**: `game/client/main.js`
- Extract all wall segments from `gameState.layout` into a flat array of axis-aligned bounding boxes (or line segments) at scene init time
- In `updateMyPlayer`, after computing the new `myX`/`myZ`, test the player's bounding box (≈ 0.5 radius) against each wall segment
- On overlap, clamp the player's position back to the wall edge along the movement axis
- Keep collision simple: treat walls as AABBs aligned to X or Z axis (matching the wall `axis` field from the layout)
- Do NOT add server-side collision — the server still clamps to a large boundary box; client-side collision is for feel

## Verification: code
