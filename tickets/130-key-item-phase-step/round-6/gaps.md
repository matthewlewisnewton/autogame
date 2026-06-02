1. Phase Step accepts wall-overlapped endpoints because it only checks `isInsideDungeon`, which validates walkable AABBs but not wall colliders.
   Files: `game/server/index.js`, `game/server/test/phase_step.test.js`
   Fix: Before swapping, reject either player endpoint when `isEntityPositionBlocked(x, z, PLAYER_RADIUS)` is true, emit `invalid_position` without burning cooldown, and add a phase_step test with a caster or ally placed inside a real wall collider but still inside the room AABB.
