# Server-Side Movement and Collision Validation

> **Staleness note.** This follow-up ticket was written against commit
> `dc999ac` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Prevent movement cheat vulnerabilities and desynchronization by validating and resolving player movement against dungeon wall bounds server-side.

## Difficulty: medium

## Server-side Wall Collision Resolution

Currently, when a client sends movement updates to the server via the `move` socket event:
```js
socket.on('move', (data) => {
  ...
  if (player) {
    const clamped = clampToDungeon(data.x, data.z);
    player.x = clamped.x;
    player.y = data.y;
    player.z = clamped.z;
    player.rotation = data.rotation;
  }
});
```

The server only clamps coordinates to the overall rectangular layout bounding box (`gameState.dungeonBounds`). It does not validate player positions against internal room or passage wall colliders. Consequently, a client could bypass wall collisions entirely (e.g., wall hacking, clipping bugs) or experience desync.

### Acceptance Criteria
- Reuse or adapt the client-side deterministic AABB calculation (`wallAABB`) and collision resolver (`resolveWallCollision`) on the server.
- Since the dungeon layout (`rooms` and `passages`) is generated server-side anyway, construct a server-side list of wall AABB colliders at startup/reset.
- Inside the server's `move` socket listener, validate and resolve the player's proposed position against these colliders.
- Reject or push back player positions that cross wall boundaries.
- Add an integration test in `game/server/test/integration.test.js` where a simulated player socket attempts to move directly through a known wall coordinate, and assert that the server-side state corrects/clamps their position back to the valid floor space.
