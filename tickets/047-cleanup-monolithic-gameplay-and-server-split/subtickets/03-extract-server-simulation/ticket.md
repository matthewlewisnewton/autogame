# Extract Server Simulation Module

Move tick-based entity AI logic (enemy state machine, minion chase/attack, movement/collision, magic stone regen, stale player cleanup) out of `game/server/index.js` into a dedicated `game/server/simulation.js` module.

## Acceptance Criteria

- `game/server/simulation.js` exists and exports:
  - `updateEnemies()` — enemy AI state machine (recovering → chasing → windup → attack; spawner logic; wander target selection)
  - `updateMinions()` — minion AI (seek nearest enemy, attack in range, follow owner, TTL expiry)
  - `damagePlayer(playerId, amount)` — reduces HP, sets dead flag, schedules respawn
  - `moveEntityToward(entity, targetX, targetZ, speed, delta)` — wall-slide movement with `{moved, blocked, reached}` result
  - `isEntityPositionBlocked(x, z, radius)` — checks if a position overlaps dungeon walls
  - `checkWallCollision(px, pz)` — point-in-AABB overlap test against wall colliders
  - `checkSweptCollision(x1, z1, x2, z2)` — segment-AABB intersection for teleport prevention
  - `clampToDungeon(x, z)` — clamps to dungeon AABB bounds
  - `buildWallColliders()` — builds AABB array from layout walls
  - `firstRoomPosition()` — returns spawn position in the start room
  - `randomRoomPosition()` — returns random position in a combat room (fallback: any non-start room)
  - `nearbySpawnPosition(x, z, radius)` — finds wall-safe spawn near a point
  - `regenMagicStones()` — increments magic stones per tick, caps at max
  - `cleanupStalePlayers()` — removes players inactive for `STALE_THRESHOLD` ms
  - `ENEMY_DEFS` — enemy type definitions (grunt, skirmisher, miniboss, spawner)
  - `ENTITY_RADIUS` — collision radius constant
- `game/server/index.js` imports all simulation functions from `./simulation.js` instead of defining them inline
- The game loop in `index.js` calls `updateEnemies()`, `updateMinions()`, `regenMagicStones()` from the simulation module
- Socket event handlers in `index.js` call `damagePlayer()`, `checkSweptCollision()` from the simulation module
- All existing server unit tests pass (`npm test` in `game/server/`)
- All existing integration tests pass (no behavior change in enemy AI, minion AI, collision, or damage)
- `module.exports` in `index.js` re-exports simulation functions for test compatibility

## Technical Specs

- **New file:** `game/server/simulation.js` — CommonJS module containing: collision system (lines ~93-375), enemy type definitions (lines ~401-454), enemy AI tick (lines ~1285-1418), minion AI tick (lines ~1420-1473), stale player cleanup + magic stone regen (lines ~1475-1516), player damage/respawn (lines ~994-1007), dungeon position helpers (lines ~104-127), nearby spawn helper (lines ~1261-1283)
- **Modify:** `game/server/index.js` — remove inline simulation code; import from `./simulation.js`; keep Express/Socket.IO bootstrapping, route delegation, connection handler, socket event handlers, game loop wiring, state snapshot, persistence, rewards/progression, run state, lobby helpers, debug scenarios
- **Dependencies:** `gameState` (imported from `index.js` or passed as parameter), `./config` constants (TICK_RATE, DETECTION_RADIUS, ENEMY_ATTACK_RANGE, etc.), `./dungeon` (generateLayout, roomsByRole, randomRoomPositionByRole, GRID_COLS, etc.)
- **Key challenge:** `damagePlayer()` calls `checkRunTerminalState()` which lives in `index.js` (or will be in progression). Use a function parameter or import to avoid circular dependency.
- **Re-exports:** `index.js` must re-export `ENEMY_DEFS`, `updateEnemies`, `updateMinions`, `damagePlayer`, `ENTITY_RADIUS`, `checkSweptCollision` etc. in its `module.exports` so existing tests that import from `index.js` continue to work

## Verification: code
