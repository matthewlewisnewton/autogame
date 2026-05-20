# Entity AI Movement and Minion Follow

Narrow this ticket to two concrete server-side AI improvements:

1. Make enemy and minion movement respect dungeon wall geometry.
2. Make allied minions follow their owner when no enemy is nearby.

Do not implement full A*, flow fields, room-role AI, boss behavior, attack telegraphs, or combat readability here. Those are separate tickets.

## Difficulty: medium

## Current State

`game/server/index.js` already has a good low-level baseline:

- Enemies spawn in generated rooms through `randomRoomPosition()`.
- `randomWanderTarget()` currently delegates to `randomRoomPosition()`, so the old hardcoded-bounds problem is mostly resolved.
- Players are clamped to dungeon bounds, and the client has wall AABB collision helpers in `game/client/collision.js`.
- Enemy and minion movement still directly mutates `x/z` with `dx / dist * move`, so server AI can pass through walls.
- Minions stop moving when no enemy is in detection range.

## Goal

Make simple AI movement feel physically grounded without introducing expensive pathfinding. Entities should slide or stop against walls, continue to wander/chase within valid space, and allied minions should regroup with their owner when out of combat.

## Acceptance Criteria

### Server Wall Colliders
- The server can derive wall AABB colliders from `gameState.layout`.
- The collider generation covers:
  - room walls
  - passage walls
- The server uses the same wall geometry semantics as the client:
  - wall `axis: 'x'` means a wall running along the X axis
  - wall `axis: 'z'` means a wall running along the Z axis
- Collider generation is deterministic for a fixed layout.
- `resetGameState()` refreshes any cached server collision data after generating a new layout.

### Shared Movement Helper
- Add a server-side helper that attempts to move an entity toward a target by a maximum distance.
- The helper signature should be close to:

  ```js
  moveEntityToward(entity, target, maxDistance, options = {})
  ```

- The helper:
  - computes a normalized direction toward `target`
  - returns without moving if the entity is already close enough
  - applies at most `maxDistance`
  - resolves the proposed position against wall colliders
  - clamps the final position to `gameState.dungeonBounds`
  - returns useful metadata such as `{ moved, blocked, reached }`
- Movement uses a smaller radius than the player if needed, but the radius is named, e.g. `ENTITY_RADIUS`.

### Wall-Slide Behavior
- If direct movement into a wall is blocked, the helper attempts axis-separated movement before giving up:
  - try X-only movement
  - try Z-only movement
  - choose a valid axis move if either works
- This is a lightweight wall-slide approximation, not full pathfinding.
- An entity must not end a tick overlapping a wall collider.

### Enemy Movement
- `updateEnemies()` uses the shared movement helper for both chase and wander movement.
- Enemies no longer pass through dungeon room or passage walls while chasing players.
- Enemies no longer pass through dungeon room or passage walls while wandering.
- If an enemy is blocked while wandering for several ticks, it chooses a new `wanderTarget`.
- If an enemy is blocked while chasing, it does not teleport or snap through walls.
- Existing enemy detection radius and chase speed remain unchanged unless a tiny tuning change is required for tests.

### Minion Movement
- `updateMinions()` uses the shared movement helper when chasing enemies.
- When no enemy is within detection radius, a living minion follows its owner.
- Owner-follow behavior:
  - if the owner is missing, disconnected, or dead, the minion does not follow
  - if the minion is within a small follow distance, it stays put
  - if farther than that distance, it moves toward the owner
  - minions also respect wall collision while following
- Suggested constants:
  - `MINION_FOLLOW_DISTANCE = 3`
  - `MINION_FOLLOW_SPEED = CHASE_SPEED`
- Existing minion TTL, hp cleanup, and attack behavior continue to work.

## Implementation Proposal

### Step 1: Server Collision Helpers

Add server-side equivalents of the client collision helpers. Keep them local to `game/server/index.js` unless the codebase already has an obvious shared module path.

Suggested helpers:

```js
const ENTITY_RADIUS = 0.45;
const ROOM_WALL_THICKNESS = 0.4;
const PASSAGE_WALL_THICKNESS = 0.3;

function wallAABB(wall, halfThickness) { ... }
function buildServerWallColliders(layout) { ... }
function overlapsAABB(x, z, radius, collider) { ... }
function resolveEntityWallCollision(x, z, radius = ENTITY_RADIUS) { ... }
function isEntityPositionBlocked(x, z, radius = ENTITY_RADIUS) { ... }
```

Use the same `WALL_THICKNESS` and `PASSAGE_WALL_THICKNESS` values that the client uses when building dungeon geometry, or centralize named constants if that is straightforward.

### Step 2: Movement Primitive

Add one primitive used by both enemies and minions:

```js
function moveEntityToward(entity, target, maxDistance, options = {}) {
  const radius = options.radius ?? ENTITY_RADIUS;
  const stopDistance = options.stopDistance ?? 0.1;
  // compute dx/dz/dist
  // propose direct movement
  // resolve/clamp
  // if blocked, try x-only and z-only
  // assign entity.x/entity.z only to a valid final position
  // return { moved, blocked, reached }
}
```

Keep this deterministic and easy to test. Avoid timers, randomness, or socket emissions inside the helper.

### Step 3: Apply to Enemies

Replace direct mutations in `updateEnemies()`:

```js
enemy.x += (dx / dist) * move;
enemy.z += (dz / dist) * move;
```

with:

```js
const result = moveEntityToward(enemy, nearestPlayer, CHASE_SPEED * dt);
```

For wander movement, call the same helper with `enemy.wanderTarget`.

If wander movement returns `blocked: true` for multiple ticks, increment an `enemy.blockedTicks` counter and choose a new wander target once it exceeds a small threshold, such as `10`.

### Step 4: Apply to Minions

When a minion has an enemy target and is outside attack range, use `moveEntityToward(minion, nearestEnemy, CHASE_SPEED * dt)`.

When no enemy is nearby:

```js
const owner = gameState.players[minion.ownerId];
if (owner && !owner.dead) {
  moveEntityToward(minion, owner, MINION_FOLLOW_SPEED * dt, {
    stopDistance: MINION_FOLLOW_DISTANCE,
  });
}
```

Do not change minion damage, TTL, spawn rules, or ownership cleanup.

## Files
- `game/server/index.js`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`

## Tests

### Unit Tests
- `buildServerWallColliders()` creates colliders for room and passage walls.
- `moveEntityToward()` moves an entity toward a target in open space.
- `moveEntityToward()` does not move an entity through a blocking wall.
- `moveEntityToward()` can slide along one axis when direct movement is blocked.
- `moveEntityToward()` clamps final positions to dungeon bounds.
- `updateEnemies()` uses wall-aware movement while chasing.
- `updateEnemies()` chooses a new wander target after repeated blocked wander ticks.
- `updateMinions()` follows a living owner when no enemy is nearby.
- `updateMinions()` does not follow a dead or missing owner.
- `updateMinions()` still attacks enemies in range.

### Integration Tests
- Place a player and enemy on opposite sides of a wall and tick enemy AI; the enemy must not cross the wall.
- Place a minion far from its owner with no enemies nearby and tick minion AI; the minion moves closer to the owner.
- Place a minion near an enemy and owner; the minion prioritizes attacking/chasing the enemy over following the owner.

## Visual QA Checklist
- Start a dungeon and observe enemies wandering without leaving room/passages.
- Stand across a wall from an enemy; the enemy should not clip straight through the wall.
- Summon a monster and move away from combat; the minion should follow the player when idle.
- Summon a monster near an enemy; the minion should still prioritize combat.

## Out of Scope
- A* pathfinding.
- Flow fields.
- Boss AI.
- Enemy attack telegraphs.
- Audio cues.
- Combat hit readability.
- Advanced map room roles.

## Verification: visual
