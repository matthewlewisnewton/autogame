// ── Server Simulation Module ──
// Tick-based entity AI, collision, player damage, magic stone regen, stale cleanup.
// Imported by index.js; re-exported from index.js for test compatibility.

const crypto = require('crypto');
const {
  TICK_RATE,
  MOVE_SPEED,
  INPUT_STALE_MS,
  DETECTION_RADIUS,
  ENEMY_ATTACK_RANGE,
  ENEMY_ATTACK_RECOVERY_MS,
  ATTACK_CONE_ANGLE,
  MAX_MAGIC_STONES,
  MAGIC_STONES_REGEN_PER_TICK,
  SUMMON_RADIUS,
  ATTACK_RANGE,
  PROJECTILE_HIT_WIDTH,
  MINION_FOLLOW_DISTANCE,
  MINION_FOLLOW_SPEED,
  MINION_CHASE_SPEED_GRUNT,
  MINION_CHASE_SPEED_SKIRMISHER,
  STALE_THRESHOLD,
  BOUNDS_MARGIN,
  SPAWN_PADDING,
  MAX_HP,
  RESPAWN_DELAY_MS,
  COOLDOWN_MS
} = require('./config');
const { PASSAGE_WIDTH, sampleFloorY, DEFAULT_FLOOR_Y, resolveFloorY } = require('./dungeon');
const { applyLeechHeal, getFrenziedCombatMultipliers, checkFrenziedTelegraph } = require('./enemyVariants');
const { isPlayingPhase } = require('./lobbies');

// ── Circular-dependency resolution ──
// simulation.js must not require('./index') (circular). Instead, index.js
// calls setGameState() / setCallbacks() after both modules are loaded.

let _gameState = null;
let _timeouts = null;
let _onTerminalCheck = null;       // checkRunTerminalState()
let _findSocketByPlayerId = null;
let _savePlayerData = null;

function _progression() {
  return require('./progression');
}

function setGameState(gs, timeouts) {
  _gameState = gs;
  _timeouts = timeouts;
}

function setTerminalCheckCallback(fn) { _onTerminalCheck = fn; }
function setFindSocketCallback(fn) { _findSocketByPlayerId = fn; }
function setSavePlayerCallback(fn) { _savePlayerData = fn; }

// ── Collision System ──

const PLAYER_RADIUS = 0.5;
const WALL_THICKNESS = 0.4;
const PASSAGE_WALL_THICKNESS = 0.3;
const ENTITY_RADIUS = 0.45;
let _wallColliders = [];
let _wallCollidersLayout = null;

/**
 * Build AABB colliders from the current dungeon layout walls.
 * Returns an array of { minX, maxX, minZ, maxZ } objects.
 */
function buildWallColliders(layout = _gameState && _gameState.layout) {
  const colliders = [];
  if (!layout || !layout.rooms || !layout.passages) return colliders;

  for (const room of layout.rooms) {
    for (const wall of room.walls) {
      colliders.push(wallAABB(wall, WALL_THICKNESS / 2));
    }
  }
  for (const passage of layout.passages) {
    for (const wall of passage.walls) {
      colliders.push(wallAABB(wall, PASSAGE_WALL_THICKNESS / 2));
    }
  }

  // Open-plaza cover pieces (pillars / broken walls) are solid obstacles, so a
  // player cannot walk through them. Each footprint becomes an AABB collider.
  if (layout.cover) {
    for (const c of layout.cover) {
      colliders.push({
        minX: c.x - c.width / 2,
        maxX: c.x + c.width / 2,
        minZ: c.z - c.depth / 2,
        maxZ: c.z + c.depth / 2,
      });
    }
  }

  return colliders;
}

function rebuildWallColliders() {
  _wallColliders = buildWallColliders();
  _wallCollidersLayout = _gameState && _gameState.layout;
  return _wallColliders;
}

function getWallColliders() {
  if (!_gameState || _wallCollidersLayout !== _gameState.layout) {
    return rebuildWallColliders();
  }
  return _wallColliders;
}

/**
 * Compute the AABB for a wall segment given its half-thickness.
 */
function wallAABB(wall, halfThickness) {
  if (wall.axis === 'x') {
    return {
      minX: wall.x - wall.length / 2 - halfThickness,
      maxX: wall.x + wall.length / 2 + halfThickness,
      minZ: wall.z - halfThickness,
      maxZ: wall.z + halfThickness,
    };
  } else {
    return {
      minX: wall.x - halfThickness,
      maxX: wall.x + halfThickness,
      minZ: wall.z - wall.length / 2 - halfThickness,
      maxZ: wall.z + wall.length / 2 + halfThickness,
    };
  }
}

/**
 * Check if a proposed player position overlaps any wall collider.
 * Returns true if the position is inside a wall (collision), false otherwise.
 */
function checkWallCollision(px, pz, colliders = getWallColliders(), radius = PLAYER_RADIUS) {
  for (const w of colliders) {
    if (px + radius <= w.minX || px - radius >= w.maxX) continue;
    if (pz + radius <= w.minZ || pz - radius >= w.maxZ) continue;
    return true; // overlap
  }

  return false;
}

/**
 * Resolve a proposed player position against wall colliders.
 * When the previous position is provided, push back to that side of the wall
 * so a client cannot tunnel through by landing inside the wall volume.
 */
function resolveWallCollision(newX, newZ, colliders = getWallColliders(), fromX = newX, fromZ = newZ, radius = PLAYER_RADIUS) {
  let resolvedX = newX;
  let resolvedZ = newZ;

  for (let pass = 0; pass < 2; pass++) {
    let adjusted = false;

    for (const w of colliders) {
      const pMinX = resolvedX - radius;
      const pMaxX = resolvedX + radius;
      const pMinZ = resolvedZ - radius;
      const pMaxZ = resolvedZ + radius;

      if (pMaxX <= w.minX || pMinX >= w.maxX || pMaxZ <= w.minZ || pMinZ >= w.maxZ) continue;

      const overlapX = Math.min(pMaxX - w.minX, w.maxX - pMinX);
      const overlapZ = Math.min(pMaxZ - w.minZ, w.maxZ - pMinZ);

      if (overlapX < overlapZ) {
        if (fromX + radius <= w.minX) {
          resolvedX = w.minX - radius;
        } else if (fromX - radius >= w.maxX) {
          resolvedX = w.maxX + radius;
        } else {
          const wallCX = (w.minX + w.maxX) / 2;
          resolvedX += resolvedX < wallCX ? -overlapX : overlapX;
        }
      } else {
        if (fromZ + radius <= w.minZ) {
          resolvedZ = w.minZ - radius;
        } else if (fromZ - radius >= w.maxZ) {
          resolvedZ = w.maxZ + radius;
        } else {
          const wallCZ = (w.minZ + w.maxZ) / 2;
          resolvedZ += resolvedZ < wallCZ ? -overlapZ : overlapZ;
        }
      }

      adjusted = true;
    }

    if (!adjusted) break;
  }

  return { x: resolvedX, z: resolvedZ };
}

/**
 * Check if the line segment from (fromX, fromZ) to (toX, toZ) intersects
 * any wall collider expanded by PLAYER_RADIUS. Returns true on intersection.
 * Uses a slab-based segment-AABB intersection test.
 */
function checkSweptCollision(fromX, fromZ, toX, toZ, colliders = getWallColliders(), options = {}) {
  const pr = options.radius != null ? options.radius : PLAYER_RADIUS;

  for (const w of colliders) {
    // Expand AABB by entity radius
    const aabb = {
      minX: w.minX - pr,
      maxX: w.maxX + pr,
      minZ: w.minZ - pr,
      maxZ: w.maxZ + pr,
    };

    if (options.allowEndpointTouch) {
      const entryT = segmentAABBEntryT(fromX, fromZ, toX, toZ, aabb);
      if (entryT == null) continue;
      if (entryT <= 1e-8 && !checkWallCollision(fromX, fromZ, colliders, pr)) continue;
      if (entryT < 1 - 1e-8) return true;
    } else if (segmentIntersectsAABB(fromX, fromZ, toX, toZ, aabb)) {
      return true;
    }
  }

  return false;
}

/**
 * Move an entity using direct movement with axis-separated wall sliding.
 * Shared by player movement and enemy knockback/pull resolution.
 */
function tryDisplacement(fromX, fromZ, dirX, dirZ, distance, colliders, radius) {
  if (checkWallCollision(fromX, fromZ, colliders, radius)) {
    const resolved = resolveWallCollision(fromX, fromZ, colliders, fromX, fromZ, radius);
    fromX = resolved.x;
    fromZ = resolved.z;
  }

  const moveX = dirX * distance;
  const moveZ = dirZ * distance;
  const sweptOptions = { allowEndpointTouch: true, radius };

  function attempt(targetX, targetZ) {
    const clamped = clampToDungeon(targetX, targetZ);
    const resolved = resolveWallCollision(clamped.x, clamped.z, colliders, fromX, fromZ, radius);
    if (!isInsideDungeon(resolved.x, resolved.z)) return null;
    if (checkWallCollision(resolved.x, resolved.z, colliders, radius)) return null;
    if (checkSweptCollision(fromX, fromZ, resolved.x, resolved.z, colliders, sweptOptions)) {
      return null;
    }
    return resolved;
  }

  const direct = attempt(fromX + moveX, fromZ + moveZ);
  if (direct) {
    return {
      x: direct.x,
      z: direct.z,
      moved: direct.x !== fromX || direct.z !== fromZ,
    };
  }

  if (Math.abs(moveX) > 1e-8) {
    const xSlide = attempt(fromX + moveX, fromZ);
    if (xSlide && (Math.abs(xSlide.x - fromX) > 1e-8 || Math.abs(xSlide.z - fromZ) > 1e-8)) {
      return { x: xSlide.x, z: xSlide.z, moved: true };
    }
  }

  if (Math.abs(moveZ) > 1e-8) {
    const zSlide = attempt(fromX, fromZ + moveZ);
    if (zSlide && (Math.abs(zSlide.x - fromX) > 1e-8 || Math.abs(zSlide.z - fromZ) > 1e-8)) {
      return { x: zSlide.x, z: zSlide.z, moved: true };
    }
  }

  return { x: fromX, z: fromZ, moved: false };
}

function tryEntityDisplacement(fromX, fromZ, dirX, dirZ, distance, colliders = getWallColliders()) {
  return tryDisplacement(fromX, fromZ, dirX, dirZ, distance, colliders, ENTITY_RADIUS);
}

/**
 * Move a player using direct movement with axis-separated wall sliding.
 */
function tryPlayerMove(fromX, fromZ, dirX, dirZ, distance, colliders = getWallColliders()) {
  return tryDisplacement(fromX, fromZ, dirX, dirZ, distance, colliders, PLAYER_RADIUS);
}

/**
 * Apply one tick of movement for all players with active input.
 * Uses a fixed step (MOVE_SPEED / TICK_RATE) so client and server stay aligned.
 */
function applyPlayerMovement() {
  if (!_gameState || !isPlayingPhase(_gameState)) return;

  const step = MOVE_SPEED / TICK_RATE;
  const colliders = getWallColliders();
  const now = Date.now();

  for (const [playerId, player] of Object.entries(_gameState.players)) {
    if (!player || player.dead || player.extracted) continue;
    if (player.connected === false) continue;
    if (!player.inputActive) continue;
    if (now - (player.lastInputTime || 0) > INPUT_STALE_MS) {
      player.inputActive = false;
      continue;
    }

    const mag = Math.hypot(player.inputDx || 0, player.inputDz || 0);
    if (mag < 1e-8) continue;

    let dx = player.inputDx;
    let dz = player.inputDz;
    if (mag > 1) { dx /= mag; dz /= mag; }

    // Slow movement to 20% while guard_block is active
    let playerStep = now < (player.blockingUntil || 0) ? step * 0.2 : step;
    // rally_cry: boost move speed while the buff is active
    if (now < (player.rallyUntil || 0)) playerStep *= (player.rallySpeedMultiplier || 1);
    // ground_anchor: slow move speed while the anchor window is active
    if (now < (player.anchorUntil || 0)) playerStep *= (player.anchorSpeedMultiplier || 0.7);

    const prevX = player.x;
    const prevZ = player.z;
    const result = tryPlayerMove(player.x, player.z, dx, dz, playerStep, colliders);
    player.x = result.x;
    player.z = result.z;
    player.y = resolveFloorY(sampleFloorY(_gameState.layout, result.x, result.z));
    if (Number.isFinite(player.inputRotation)) {
      player.rotation = player.inputRotation;
    }
    player.lastMoveTime = now;
    if (result.moved || player.x !== prevX || player.z !== prevZ) {
      player.persistenceDirty = true;
    }
  }
}

/** Flush at most one persistence write per dirty player (called once per tick). */
function flushDirtyPlayerSaves() {
  if (!_gameState || !_savePlayerData) return;
  for (const [playerId, player] of Object.entries(_gameState.players)) {
    if (player?.persistenceDirty) {
      player.persistenceDirty = false;
      _savePlayerData(playerId);
    }
  }
}

function segmentAABBEntryT(x1, z1, x2, z2, aabb) {
  const dx = x2 - x1;
  const dz = z2 - z1;

  let tmin = 0;
  let tmax = 1;

  if (Math.abs(dx) > 1e-8) {
    let t0 = (aabb.minX - x1) / dx;
    let t1 = (aabb.maxX - x1) / dx;
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return null;
  } else if (x1 <= aabb.minX || x1 >= aabb.maxX) {
    return null;
  }

  if (Math.abs(dz) > 1e-8) {
    let t0 = (aabb.minZ - z1) / dz;
    let t1 = (aabb.maxZ - z1) / dz;
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return null;
  } else if (z1 <= aabb.minZ || z1 >= aabb.maxZ) {
    return null;
  }

  return tmin;
}

/**
 * Segment-AABB intersection using the slab method (Li-Whitted).
 * Returns true if the segment from (x1, z1) to (x2, z2) intersects the AABB.
 */
function segmentIntersectsAABB(x1, z1, x2, z2, aabb) {
  const dx = x2 - x1;
  const dz = z2 - z1;

  let tmin = 0;
  let tmax = 1;

  // X slab
  if (Math.abs(dx) > 1e-8) {
    let t0 = (aabb.minX - x1) / dx;
    let t1 = (aabb.maxX - x1) / dx;
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return false;
  } else {
    // Segment is axis-aligned in X — check if x1 is inside slab
    if (x1 < aabb.minX || x1 > aabb.maxX) return false;
  }

  // Z slab
  if (Math.abs(dz) > 1e-8) {
    let t0 = (aabb.minZ - z1) / dz;
    let t1 = (aabb.maxZ - z1) / dz;
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return false;
  } else {
    // Segment is axis-aligned in Z — check if z1 is inside slab
    if (z1 < aabb.minZ || z1 > aabb.maxZ) return false;
  }

  return true;
}

/**
 * Check if a point position overlaps any wall collider expanded by radius.
 * Returns true when overlapping a wall, false otherwise.
 */
function isEntityPositionBlocked(x, z, radius) {
  const colliders = getWallColliders();
  const r = radius != null ? radius : ENTITY_RADIUS;

  for (const w of colliders) {
    if (x + r <= w.minX || x - r >= w.maxX) continue;
    if (z + r <= w.minZ || z - r >= w.maxZ) continue;
    return true; // overlap
  }

  return false;
}

/**
 * Attempt to move an entity toward a target while respecting wall colliders
 * and dungeon bounds. Uses axis-separated wall-slide when direct movement
 * is blocked.
 *
 * Returns { moved, blocked, reached } metadata.
 */
function moveEntityToward(entity, target, maxDistance, options) {
  const radius = (options && options.radius) != null ? options.radius : ENTITY_RADIUS;
  const stopDistance = (options && options.stopDistance) != null ? options.stopDistance : 0.1;

  const dx = target.x - entity.x;
  const dz = target.z - entity.z;
  const dist = Math.hypot(dx, dz);

  // Already within stop distance
  if (dist <= stopDistance) {
    return { moved: false, blocked: false, reached: true };
  }

  // Normalize direction
  const ndx = dx / dist;
  const ndz = dz / dist;

  // Clamp movement to maxDistance
  const move = Math.min(dist, maxDistance);

  // Proposed position
  const proposedX = entity.x + ndx * move;
  const proposedZ = entity.z + ndz * move;

  // Try direct movement
  if (!isEntityPositionBlocked(proposedX, proposedZ, radius)) {
    const clamped = clampToDungeon(proposedX, proposedZ);
    entity.x = clamped.x;
    entity.z = clamped.z;
    const postDist = Math.hypot(entity.x - target.x, entity.z - target.z);
    return { moved: true, blocked: false, reached: postDist <= stopDistance };
  }

  // Direct is blocked — try axis-separated movement (wall-slide)
  // Try X-only
  const xProposed = entity.x + ndx * move;
  const xOnlyBlocked = (Math.abs(xProposed - entity.x) > 1e-8)
    ? isEntityPositionBlocked(xProposed, entity.z, radius)
    : true; // no displacement on X — treat as blocked
  // Try Z-only
  const zProposed = entity.z + ndz * move;
  const zOnlyBlocked = (Math.abs(zProposed - entity.z) > 1e-8)
    ? isEntityPositionBlocked(entity.x, zProposed, radius)
    : true; // no displacement on Z — treat as blocked

  if (!xOnlyBlocked) {
    const clamped = clampToDungeon(xProposed, entity.z);
    entity.x = clamped.x;
    entity.z = clamped.z;
    const postDist = Math.hypot(entity.x - target.x, entity.z - target.z);
    return { moved: true, blocked: true, reached: postDist <= stopDistance };
  } else if (!zOnlyBlocked) {
    const clamped = clampToDungeon(entity.x, zProposed);
    entity.x = clamped.x;
    entity.z = clamped.z;
    const postDist = Math.hypot(entity.x - target.x, entity.z - target.z);
    return { moved: true, blocked: true, reached: postDist <= stopDistance };
  }

  // Both axes blocked
  return { moved: false, blocked: true, reached: false };
}

// ── Dungeon Position Helpers ──

/**
 * Compute dungeon AABB bounds from layout rooms.
 */
function computeDungeonBounds(layout) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const room of layout.rooms) {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    minX = Math.min(minX, room.x - halfW);
    maxX = Math.max(maxX, room.x + halfW);
    minZ = Math.min(minZ, room.z - halfD);
    maxZ = Math.max(maxZ, room.z + halfD);
  }

  return {
    minX: minX - BOUNDS_MARGIN,
    maxX: maxX + BOUNDS_MARGIN,
    minZ: minZ - BOUNDS_MARGIN,
    maxZ: maxZ + BOUNDS_MARGIN,
  };
}

/**
 * Compute walkable AABBs from the dungeon layout.
 * Returns an array of { minX, maxX, minZ, maxZ } — one per room and one per passage.
 */
function computeWalkableAABBs(layout) {
  const aabbs = [];
  if (!layout) return aabbs;

  if (layout.rooms) {
    for (const room of layout.rooms) {
      const halfW = room.width / 2;
      const halfD = room.depth / 2;
      aabbs.push({
        minX: room.x - halfW,
        maxX: room.x + halfW,
        minZ: room.z - halfD,
        maxZ: room.z + halfD,
      });
    }
  }

  if (layout.passages) {
    const halfGap = (layout.passageWidth ?? PASSAGE_WIDTH) / 2;
    for (const p of layout.passages) {
      aabbs.push({
        minX: Math.min(p.x1, p.x2) - halfGap,
        maxX: Math.max(p.x1, p.x2) + halfGap,
        minZ: Math.min(p.z1, p.z2) - halfGap,
        maxZ: Math.max(p.z1, p.z2) + halfGap,
      });
    }
  }

  return aabbs;
}

/**
 * Check if (x, z) is inside any walkable AABB.
 * Returns false when walkableAABBs is unset or empty.
 */
function isInsideDungeon(x, z) {
  const aabbs = _gameState && _gameState.walkableAABBs;
  if (!aabbs || aabbs.length === 0) return false;

  for (const a of aabbs) {
    if (x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ) {
      return true;
    }
  }
  return false;
}

/**
 * Returns spawn position in the start room.
 */
function firstRoomPosition() {
  const layout = _gameState.layout;
  const startRoom = layout.rooms.find(r => r.role === 'start');
  const room = startRoom || layout.rooms[0]; // defensive fallback
  return { x: room.x, z: room.z };
}

/**
 * Returns random position in a random room.
 */
function randomRoomPosition() {
  const room = _gameState.layout.rooms[Math.floor(Math.random() * _gameState.layout.rooms.length)];
  const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
  const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
  return {
    x: room.x + (Math.random() * 2 - 1) * halfW,
    z: room.z + (Math.random() * 2 - 1) * halfD,
  };
}

/**
 * Seeded, cover-aware spawn position for single-room / no-role layouts (the
 * open-plaza arena). Samples points inside the walkable plaza floor and rejects
 * any candidate that overlaps a cover piece or wall collider, retrying up to
 * `maxAttempts` before falling back to a known-safe point near the plaza centre
 * (the start-room spawn-clear zone, which generation keeps clear of cover).
 *
 * Uses the passed-in seeded `rng` only — never `Math.random()` — so placement is
 * deterministic for a given layout seed. Collision rejection reuses the same
 * collider set as player movement (`buildWallColliders` / `checkWallCollision`),
 * which already includes open-plaza cover footprints.
 */
function pickFloorSpawnPosition(layout, rng, { maxAttempts = 24 } = {}) {
  const startRoom = layout.rooms.find(r => r.role === 'start') || layout.rooms[0];
  const halfW = Math.max(0, startRoom.width / 2 - SPAWN_PADDING);
  const halfD = Math.max(0, startRoom.depth / 2 - SPAWN_PADDING);
  const colliders = buildWallColliders(layout);

  for (let i = 0; i < maxAttempts; i++) {
    const x = startRoom.x + (rng() * 2 - 1) * halfW;
    const z = startRoom.z + (rng() * 2 - 1) * halfD;
    if (!checkWallCollision(x, z, colliders)) {
      return { x, z };
    }
  }

  // Exhausted attempts: the plaza centre / start-room spawn-clear zone is kept
  // free of cover at generation time, so it is a known-safe landing point.
  return { x: startRoom.x, z: startRoom.z };
}

/**
 * Clamps (x, z) to dungeon AABB bounds.
 */
function clampToDungeon(x, z) {
  const bounds = _gameState.dungeonBounds;
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
    z: Math.max(bounds.minZ, Math.min(bounds.maxZ, z)),
  };
}

/**
 * Try to find a position within `radius` units of (x, z) that is inside
 * dungeon bounds. Falls back to the clamped candidate when all attempts
 * are pushed outside the radius (near dungeon edges).
 */
function nearbySpawnPosition(x, z, radius) {
  const bounds = _gameState.dungeonBounds;

  // Try up to 8 random candidates within the circle
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * radius;
    const candidate = {
      x: x + Math.cos(angle) * dist,
      z: z + Math.sin(angle) * dist,
    };
    candidate.x = Math.max(bounds.minX, Math.min(bounds.maxX, candidate.x));
    candidate.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, candidate.z));
    if (Math.hypot(candidate.x - x, candidate.z - z) <= radius) return candidate;
  }

  // All attempts exceeded radius after clamping (near dungeon edge).
  // Return the point clamped to both bounds and radius.
  const clamped = clampToDungeon(x, z);
  const dx = clamped.x - x;
  const dz = clamped.z - z;
  const d = Math.hypot(dx, dz);
  if (d <= radius) return clamped;
  // Clamp to radius
  const scale = radius / d;
  return { x: x + dx * scale, z: z + dz * scale };
}

/**
 * Returns a random wander target (random position in a random room).
 */
function randomWanderTarget() {
  return randomRoomPosition();
}

// ── Enemy Type Definitions ──

const ENEMY_DEFS = {
	grunt: {
		hp: 100, chaseSpeed: 2.5, wanderSpeed: 1.0, attackDamage: 10, attackWindupMs: 800,
		attackStyle: 'radial',
	},
	skirmisher: {
		hp: 40, chaseSpeed: 4.5, wanderSpeed: 1.5, attackDamage: 6, attackWindupMs: 500,
		attackStyle: 'cone', attackConeAngle: Math.PI / 3,
	},
	miniboss: {
		hp: 300, chaseSpeed: 1.2, wanderSpeed: 0.6, attackDamage: 18, attackWindupMs: 1200,
		attackStyle: 'cone', attackConeAngle: Math.PI / 2, attackRange: 5,
	},
	spawner: {
		hp: 120, chaseSpeed: 1.8, wanderSpeed: 0.9, attackDamage: 8, attackWindupMs: 900,
		attackStyle: 'radial',
		spawnIntervalMs: 4000, spawnMaxAlive: 3, spawnType: 'skirmisher',
	},
};

function enemyDefFor(type) {
	const def = ENEMY_DEFS[type];
	if (!def) {
		throw new Error(`Unknown enemy type: ${type} (valid: ${Object.keys(ENEMY_DEFS).join(', ')})`);
	}
	return def;
}

function lockWindupDirection(enemy, target) {
	const dx = target.x - enemy.x;
	const dz = target.z - enemy.z;
	const len = Math.hypot(dx, dz);
	if (len > 0) {
		enemy.windupDirX = dx / len;
		enemy.windupDirZ = dz / len;
	} else {
		enemy.windupDirX = 1;
		enemy.windupDirZ = 0;
	}
}

function isEntityInEnemyAttack(enemy, target) {
	const range = enemy.attackRange ?? ENEMY_ATTACK_RANGE;
	const dx = target.x - enemy.x;
	const dz = target.z - enemy.z;
	const dist = Math.hypot(dx, dz);
	if (dist > range) return false;

	if (enemy.attackStyle === 'cone') {
		const coneAngle = enemy.attackConeAngle ?? ATTACK_CONE_ANGLE;
		const dirX = enemy.windupDirX ?? 1;
		const dirZ = enemy.windupDirZ ?? 0;
		const tDirX = dist > 0 ? dx / dist : dirX;
		const tDirZ = dist > 0 ? dz / dist : dirZ;
		const dot = dirX * tDirX + dirZ * tDirZ;
		return dot >= Math.cos(coneAngle / 2);
	}

	return true;
}

function isPlayerInEnemyAttack(enemy, target) {
	return isEntityInEnemyAttack(enemy, target);
}

/** Backfill combat stats on enemies created before spawnEnemy spread (tests, corrupt type throws). */
function ensureEnemyCombatStats(enemy) {
	if (enemy.chaseSpeed !== undefined) return;
	const def = enemyDefFor(enemy.type);
	const { hp, ...statFields } = def;
	Object.assign(enemy, statFields);
}

function resolveWindupTarget(enemy) {
	const targetType = enemy.windupTargetType || 'player';
	if (targetType === 'minion') {
		return _gameState.minions.find(
			(minion) => minion.id === enemy.windupTargetId && minion.hp > 0
		) || null;
	}
	const player = _gameState.players[enemy.windupTargetId];
	return player && !player.dead ? player : null;
}

// Returns true if `player` is standing inside any living player's active smoke
// zone (smoke_bomb key item). Concealed players are skipped by enemy target
// acquisition and cause in-progress wind-ups to be cancelled. The zone is fixed
// at the cast point, so a player who walks out — or whose zone expires — becomes
// targetable again.
function isPlayerConcealed(player, now) {
	if (!player) return false;
	for (const owner of Object.values(_gameState.players)) {
		if (!owner || owner.dead || owner.extracted) continue;
		if (!owner.smokeBombUntil || now >= owner.smokeBombUntil) continue;
		const radius = owner.smokeBombRadius;
		if (!Number.isFinite(radius) || radius <= 0) continue;
		const dx = player.x - owner.smokeBombX;
		const dz = player.z - owner.smokeBombZ;
		if (Math.hypot(dx, dz) <= radius) return true;
	}
	return false;
}

function isEnemyFrozen(enemy) {
  return enemy.frozenUntil != null && Date.now() < enemy.frozenUntil;
}

function healPlayer(playerId, amount) {
  const player = _gameState.players[playerId];
  if (!player || player.dead || !Number.isFinite(amount) || amount <= 0) return 0;
  const before = Number.isFinite(player.hp) ? player.hp : MAX_HP;
  player.hp = Math.min(MAX_HP, before + amount);
  return player.hp - before;
}

// Minimal debuff helper: append a debuff to a player's debuffs array in
// insertion (oldest-first) order. No per-tick effects are applied here; this
// exists so debuffs can be placed on a player (e.g. by tests or future systems)
// for purge_charm to clear the oldest one.
function addDebuff(player, type, expiresAt) {
  if (!player) return null;
  if (!Array.isArray(player.debuffs)) player.debuffs = [];
  const debuff = { type, expiresAt };
  player.debuffs.push(debuff);
  return debuff;
}

function collectConeHits(originX, originZ, dirX, dirZ, range, coneAngle, damage, options = {}) {
  const hits = [];
  let magicStonesGained = 0;
  const magicStoneOnHit = options.magicStoneOnHit || 0;
  const magicStoneOnKill = options.magicStoneOnKill || 0;
  const attackerId = options.attackerId;

  for (const enemy of _gameState.enemies) {
    const dx = enemy.x - originX;
    const dz = enemy.z - originZ;
    const dist = Math.hypot(dx, dz);
    if (dist > range) continue;

    const enemyDirX = dist > 0 ? dx / dist : dirX;
    const enemyDirZ = dist > 0 ? dz / dist : dirZ;
    const dot = dirX * enemyDirX + dirZ * enemyDirZ;
    if (dot < Math.cos(coneAngle / 2)) continue;

    if (attackerId) enemy.lastDamagedBy = attackerId;
    const { killed } = damageEnemy(enemy, damage);
    const hitGain = magicStoneOnHit;
    const killGain = killed ? magicStoneOnKill : 0;
    magicStonesGained += hitGain + killGain;
    hits.push({ enemyId: enemy.id, hp: enemy.hp, magicStonesGained: hitGain + killGain });
  }

  return { hits, magicStonesGained };
}

function collectRadialHits(originX, originZ, radius, damage, options = {}) {
  const hits = [];
  let magicStonesGained = 0;
  let hpHealed = 0;
  const magicStoneOnHit = options.magicStoneOnHit || 0;
  const magicStoneOnKill = options.magicStoneOnKill || 0;
  const healOnHit = options.healOnHit || 0;
  const healOnKill = options.healOnKill || 0;
  const attackerId = options.attackerId;

  for (const enemy of _gameState.enemies) {
    const dist = Math.hypot(enemy.x - originX, enemy.z - originZ);
    if (dist > radius) continue;

    if (attackerId) enemy.lastDamagedBy = attackerId;
    const { killed } = damageEnemy(enemy, damage);
    const hitGain = magicStoneOnHit;
    const killGain = killed ? magicStoneOnKill : 0;
    magicStonesGained += hitGain + killGain;
    if (attackerId && (healOnHit || healOnKill)) {
      hpHealed += healPlayer(attackerId, healOnHit + (killed ? healOnKill : 0));
    }
    hits.push({ enemyId: enemy.id, hp: enemy.hp, magicStonesGained: hitGain + killGain });
  }

  return { hits, magicStonesGained, hpHealed };
}

function collectProjectileHits(originX, originZ, dirX, dirZ, range, damage, options = {}) {
  const hits = [];
  let magicStonesGained = 0;
  const magicStoneOnHit = options.magicStoneOnHit || 0;
  const magicStoneOnKill = options.magicStoneOnKill || 0;
  const attackerId = options.attackerId;
  const hitWidth = options.hitWidth ?? PROJECTILE_HIT_WIDTH;
  const sampleCount = Math.max(4, Math.ceil(range * 2));
  const hitEnemyIds = new Set();

  for (let i = 0; i <= sampleCount; i++) {
    const t = range * (i / sampleCount);
    const px = originX + dirX * t;
    const pz = originZ + dirZ * t;

    for (const enemy of _gameState.enemies) {
      if (hitEnemyIds.has(enemy.id)) continue;
      const dist = Math.hypot(enemy.x - px, enemy.z - pz);
      if (dist > hitWidth) continue;

      if (attackerId) enemy.lastDamagedBy = attackerId;
      const { killed } = damageEnemy(enemy, damage);
      const hitGain = magicStoneOnHit;
      const killGain = killed ? magicStoneOnKill : 0;
      magicStonesGained += hitGain + killGain;
      hitEnemyIds.add(enemy.id);
      hits.push({ enemyId: enemy.id, hp: enemy.hp, magicStonesGained: hitGain + killGain });
      if (!options.pierces) {
        return { hits, magicStonesGained };
      }
    }
  }

  return { hits, magicStonesGained };
}

function collectPhaseBeamHits(originX, originZ, dirX, dirZ, range, damage, options = {}) {
  const hits = [];
  const attackerId = options.attackerId;
  const hitWidth = options.hitWidth ?? PROJECTILE_HIT_WIDTH;
  const excludeMinionId = options.excludeMinionId;
  const sampleCount = Math.max(4, Math.ceil(range * 2));
  const hitEnemyIds = new Set();
  const hitMinionIds = new Set();
  const hitPlayerIds = new Set();

  for (let i = 0; i <= sampleCount; i++) {
    const t = range * (i / sampleCount);
    const px = originX + dirX * t;
    const pz = originZ + dirZ * t;

    for (const enemy of _gameState.enemies) {
      if (hitEnemyIds.has(enemy.id)) continue;
      const dist = Math.hypot(enemy.x - px, enemy.z - pz);
      if (dist > hitWidth) continue;

      if (attackerId) enemy.lastDamagedBy = attackerId;
      damageEnemy(enemy, damage);
      hitEnemyIds.add(enemy.id);
      hits.push({ enemyId: enemy.id, hp: enemy.hp });
    }

    for (const ally of _gameState.minions) {
      if (ally.id === excludeMinionId || hitMinionIds.has(ally.id) || ally.hp <= 0) continue;
      const dist = Math.hypot(ally.x - px, ally.z - pz);
      if (dist > hitWidth) continue;

      damageMinion(ally, damage);
      hitMinionIds.add(ally.id);
      hits.push({ minionId: ally.id, hp: ally.hp });
    }

    for (const [playerId, player] of Object.entries(_gameState.players)) {
      if (hitPlayerIds.has(playerId) || player.dead) continue;
      const dist = Math.hypot(player.x - px, player.z - pz);
      if (dist > hitWidth) continue;

      // Phase beam is a ranged/projectile attack — taggable so an active
      // barrier dome can block it (see damagePlayer's barrier-dome check).
      damagePlayer(playerId, damage, { attackerId, ranged: true });
      hitPlayerIds.add(playerId);
      hits.push({ playerId, hp: player.hp });
    }
  }

  return { hits };
}

function lockMinionWindupDirection(minion, target) {
  const dx = target.x - minion.x;
  const dz = target.z - minion.z;
  const len = Math.hypot(dx, dz);
  if (len > 0) {
    minion.windupDirX = dx / len;
    minion.windupDirZ = dz / len;
  } else {
    minion.windupDirX = 1;
    minion.windupDirZ = 0;
  }
}

function lockMinionBreathDirection(minion, target) {
  lockMinionWindupDirection(minion, target);
  minion.breathDirX = minion.windupDirX;
  minion.breathDirZ = minion.windupDirZ;
  delete minion.windupDirX;
  delete minion.windupDirZ;
}

function queueWyrmBreathCardUsed(minion, cardId, options) {
  _gameState._pendingMinionBreaths.push({
    playerId: minion.ownerId,
    cardId,
    specialEffect: options.specialEffect,
    origin: { x: minion.x, z: minion.z },
    direction: { x: minion.breathDirX, z: minion.breathDirZ },
    attackRange: options.breathRange,
    attackConeAngle: options.breathConeAngle,
    hits: options.hits,
    minionId: minion.id,
    breathPhase: options.breathPhase,
    breathDurationMs: options.breathDurationMs,
  });
}

function applyWyrmBreathTick(minion, cardId, config, breathPhase) {
  const dirX = minion.breathDirX ?? 1;
  const dirZ = minion.breathDirZ ?? 0;
  const { hits } = collectConeHits(
    minion.x,
    minion.z,
    dirX,
    dirZ,
    config.breathRange,
    config.breathConeAngle,
    config.breathDamage,
    { attackerId: minion.ownerId }
  );
  queueWyrmBreathCardUsed(minion, cardId, {
    specialEffect: config.specialEffect,
    breathRange: config.breathRange,
    breathConeAngle: config.breathConeAngle,
    hits,
    breathPhase,
    breathDurationMs: config.breathDurationMs,
  });
}

function updateWyrmMinionAI(minion, nearestEnemy, nearestDist, dt, config) {
  const now = Date.now();
  const cardId = config.cardId;

  if (minion.breathState === 'breathing') {
    const elapsed = now - (minion.breathStartedAt || now);
    if (elapsed >= config.breathDurationMs) {
      minion.breathState = 'idle';
      minion.lastBreathAt = now;
      delete minion.breathStartedAt;
      delete minion.breathDirX;
      delete minion.breathDirZ;
      delete minion.lastBreathTickAt;
      return;
    }

    const lastTick = minion.lastBreathTickAt ?? 0;
    if (now - lastTick >= config.breathTickMs) {
      const breathPhase = lastTick === 0 ? 'start' : 'tick';
      applyWyrmBreathTick(minion, cardId, config, breathPhase);
      minion.lastBreathTickAt = now;
    }
    return;
  }

  if (nearestEnemy && nearestDist < DETECTION_RADIUS) {
    const lastBreathAt = minion.lastBreathAt ?? 0;
    const holdDistance = config.breathHoldDistance ?? Math.max(2.5, config.breathRange * 0.6);
    const canBreath = nearestDist <= config.breathRange
      && nearestDist >= holdDistance * 0.85
      && now - lastBreathAt >= config.breathIntervalMs;

    if (canBreath) {
      lockMinionBreathDirection(minion, nearestEnemy);
      minion.breathState = 'breathing';
      minion.breathStartedAt = now;
      minion.lastBreathTickAt = 0;
      applyWyrmBreathTick(minion, cardId, config, 'start');
      minion.lastBreathTickAt = now;
      return;
    }

    if (nearestDist < holdDistance) {
      const retreatX = minion.x - (nearestEnemy.x - minion.x);
      const retreatZ = minion.z - (nearestEnemy.z - minion.z);
      moveEntityToward(minion, { x: retreatX, z: retreatZ }, config.chaseSpeed * dt);
      return;
    }

    if (nearestDist > config.breathRange) {
      moveEntityToward(minion, nearestEnemy, config.chaseSpeed * dt, { stopDistance: holdDistance });
    }
    return;
  }

  const owner = _gameState.players[minion.ownerId];
  if (owner && !owner.dead) {
    const dx = owner.x - minion.x;
    const dz = owner.z - minion.z;
    const distToOwner = Math.hypot(dx, dz);
    if (distToOwner > MINION_FOLLOW_DISTANCE) {
      moveEntityToward(minion, owner, MINION_FOLLOW_SPEED * dt, { stopDistance: MINION_FOLLOW_DISTANCE });
    }
  }
}

function collectReturningProjectileHits(originX, originZ, dirX, dirZ, range, damage, options = {}) {
  const hits = [];
  let magicStonesGained = 0;
  const magicStoneOnHit = options.magicStoneOnHit || 0;
  const magicStoneOnKill = options.magicStoneOnKill || 0;
  const attackerId = options.attackerId;
  const returnPasses = Math.max(1, options.returnPasses || 1);
  const totalPasses = 1 + returnPasses;
  const sampleCount = Math.max(4, Math.ceil(range * 2));

  for (let pass = 0; pass < totalPasses; pass++) {
    const hitEnemyIds = new Set();
    const isOutbound = pass === 0;
    const start = isOutbound ? 0 : range;
    const end = isOutbound ? range : 0;
    for (let i = 0; i <= sampleCount; i++) {
      const t = start + (end - start) * (i / sampleCount);
      const px = originX + dirX * t;
      const pz = originZ + dirZ * t;

      for (const enemy of _gameState.enemies) {
        if (hitEnemyIds.has(enemy.id)) continue;
        const dist = Math.hypot(enemy.x - px, enemy.z - pz);
        if (dist > PROJECTILE_HIT_WIDTH) continue;

        if (attackerId) enemy.lastDamagedBy = attackerId;
        const { killed } = damageEnemy(enemy, damage);
        const hitGain = magicStoneOnHit;
        const killGain = killed ? magicStoneOnKill : 0;
        magicStonesGained += hitGain + killGain;
        hitEnemyIds.add(enemy.id);
        hits.push({ enemyId: enemy.id, hp: enemy.hp, magicStonesGained: hitGain + killGain, pass: pass + 1 });
      }
    }
  }

  return { hits, magicStonesGained };
}

function applyFreezeInRadius(originX, originZ, radius, durationMs, damage = 0, frozenBonusDamage = 0) {
  const now = Date.now();
  const frozenUntil = now + durationMs;
  const hits = [];

  for (const enemy of _gameState.enemies) {
    const dist = Math.hypot(enemy.x - originX, enemy.z - originZ);
    if (dist > radius) continue;
    const wasFrozen = enemy.frozenUntil != null && enemy.frozenUntil > now;
    let hitDamage = damage;
    if (wasFrozen && frozenBonusDamage > 0) {
      hitDamage += frozenBonusDamage;
    }
    if (hitDamage > 0) {
      damageEnemy(enemy, hitDamage);
      const hit = { enemyId: enemy.id, hp: enemy.hp };
      if (wasFrozen && frozenBonusDamage > 0) {
        hit.frozenShatter = true;
      }
      hits.push(hit);
    }
    enemy.frozenUntil = Math.max(enemy.frozenUntil || 0, frozenUntil);
  }

  return hits;
}

function pullEnemiesToward(originX, originZ, radius, strength) {
  const moved = [];
  for (const enemy of _gameState.enemies) {
    const dx = originX - enemy.x;
    const dz = originZ - enemy.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= 0.01 || dist > radius) continue;

    const pull = Math.min(strength, dist);
    const result = tryEntityDisplacement(enemy.x, enemy.z, dx / dist, dz / dist, pull);
    enemy.x = result.x;
    enemy.z = result.z;
    moved.push({ enemyId: enemy.id, x: enemy.x, z: enemy.z });
  }
  return moved;
}

function applyKnockback(originX, originZ, dirX, dirZ, hits, strength) {
  const moved = [];
  if (!Array.isArray(hits) || hits.length === 0 || strength <= 0) return moved;

  const hitIds = new Set(hits.map((hit) => hit.enemyId));
  for (const enemy of _gameState.enemies) {
    if (!hitIds.has(enemy.id)) continue;
    const result = tryEntityDisplacement(enemy.x, enemy.z, dirX, dirZ, strength);
    enemy.x = result.x;
    enemy.z = result.z;
    moved.push({ enemyId: enemy.id, x: enemy.x, z: enemy.z });
  }
  return moved;
}

/**
 * Knock back a single player by `strength` along (dirX, dirZ). No-op while the
 * player's ground_anchor window is active (now < player.anchorUntil): an anchored
 * player ignores knockback/displacement entirely. Returns true if the player moved.
 */
function applyPlayerKnockback(playerId, dirX, dirZ, strength) {
  const player = _gameState && _gameState.players ? _gameState.players[playerId] : null;
  if (!player) return false;
  if (Date.now() < (player.anchorUntil || 0)) return false;
  if (strength <= 0) return false;
  const mag = Math.hypot(dirX || 0, dirZ || 0);
  if (mag < 1e-8) return false;
  const result = tryPlayerMove(player.x, player.z, dirX / mag, dirZ / mag, strength);
  player.x = result.x;
  player.z = result.z;
  return !!result.moved;
}

function applyEventHorizon(originX, originZ, cardDef, attackerId) {
  const radius = cardDef.pullRadius || 12;
  const pulled = pullEnemiesToward(originX, originZ, radius, cardDef.pullStrength || 4);
  const crush = collectRadialHits(
    originX,
    originZ,
    cardDef.centerRadius || 2.5,
    cardDef.centerDamage || 30,
    { attackerId }
  );
  return { pulled, crushed: crush.hits };
}

function spawnFireTrailEffect(originX, originZ, dirX, dirZ, cardDef, ownerId) {
  if (!_gameState.areaEffects) _gameState.areaEffects = [];
  const now = Date.now();
  const ticks = cardDef.dotTicks || 4;
  const intervalMs = cardDef.dotIntervalMs || 500;
  _gameState.areaEffects.push({
    id: crypto.randomUUID(),
    type: 'fire_trail',
    ownerId,
    originX,
    originZ,
    dirX,
    dirZ,
    coneAngle: cardDef.attackConeAngle || ATTACK_CONE_ANGLE,
    range: cardDef.attackRange || ATTACK_RANGE,
    damagePerTick: cardDef.trailDamagePerTick || Math.round((cardDef.damage || 0) * 0.25),
    ticksRemaining: ticks,
    intervalMs,
    lastTickAt: now,
    expiresAt: now + ticks * intervalMs + 250,
  });
}

function spawnDragonsBreathEffect(originX, originZ, dirX, dirZ, cardDef, ownerId) {
  if (!_gameState.areaEffects) _gameState.areaEffects = [];
  const now = Date.now();
  const ticks = cardDef.dotTicks || 4;
  const intervalMs = cardDef.dotIntervalMs || 500;
  _gameState.areaEffects.push({
    id: crypto.randomUUID(),
    type: 'dragons_breath',
    ownerId,
    originX,
    originZ,
    dirX,
    dirZ,
    coneAngle: cardDef.attackConeAngle || Math.PI / 3,
    range: cardDef.attackRange || 7,
    damagePerTick: cardDef.damage || 8,
    ticksRemaining: ticks,
    intervalMs,
    lastTickAt: now,
    expiresAt: now + ticks * intervalMs + 250,
  });
}

function spawnInfernoPillarEffect(originX, originZ, cardDef, ownerId) {
  if (!_gameState.areaEffects) _gameState.areaEffects = [];
  const now = Date.now();
  const ticks = cardDef.dotTicks || 4;
  const intervalMs = cardDef.dotIntervalMs || 500;
  _gameState.areaEffects.push({
    id: crypto.randomUUID(),
    type: 'inferno_pillar',
    ownerId,
    originX,
    originZ,
    range: cardDef.attackRange || 7,
    damagePerTick: cardDef.damage || 12,
    ticksRemaining: ticks,
    intervalMs,
    lastTickAt: now,
    expiresAt: now + ticks * intervalMs + 250,
  });
}

/**
 * Spawn the on-death radial blast of a `volatile`-variant enemy. Pushes a
 * one-shot `volatile_explosion` area effect at (x, z) that the next
 * updateAreaEffects() tick resolves into damage, and records the detonation on
 * `_gameState._pendingVolatileExplosions` so runGameLoopTick can broadcast it
 * to clients (mirroring `_pendingMinionBreaths`). `def` is the variant registry
 * entry carrying `radius`/`damage`.
 */
function spawnVolatileExplosion(x, z, def) {
  if (!_gameState.areaEffects) _gameState.areaEffects = [];
  if (!_gameState._pendingVolatileExplosions) _gameState._pendingVolatileExplosions = [];
  const now = Date.now();
  const radius = Number.isFinite(def?.radius) ? def.radius : 5;
  const damage = Number.isFinite(def?.damage) ? def.damage : 20;
  _gameState.areaEffects.push({
    id: crypto.randomUUID(),
    type: 'volatile_explosion',
    originX: x,
    originZ: z,
    range: radius,
    damagePerTick: damage,
    ticksRemaining: 1,
    intervalMs: 0,
    lastTickAt: now,
    expiresAt: now + 250,
  });
  _gameState._pendingVolatileExplosions.push({ x, z, radius });
}

function updateAreaEffects() {
  if (!_gameState.areaEffects || _gameState.areaEffects.length === 0) return;
  const now = Date.now();

  for (const effect of _gameState.areaEffects) {
    if (now >= effect.expiresAt || effect.ticksRemaining <= 0) continue;
    if (now - effect.lastTickAt < effect.intervalMs) continue;

    let hits;
    if (effect.type === 'volatile_explosion') {
      // One-shot radial blast from a dead `volatile` enemy: damages every
      // living enemy, minion, and player within `range` of the origin.
      ({ hits } = collectRadialHits(
        effect.originX,
        effect.originZ,
        effect.range,
        effect.damagePerTick
      ));
      for (const minion of _gameState.minions) {
        if (minion.hp <= 0) continue;
        const dist = Math.hypot(minion.x - effect.originX, minion.z - effect.originZ);
        if (dist <= effect.range) damageMinion(minion, effect.damagePerTick);
      }
      for (const [playerId, player] of Object.entries(_gameState.players)) {
        if (player.dead) continue;
        const dist = Math.hypot(player.x - effect.originX, player.z - effect.originZ);
        // Route through damagePlayer so barrier/anchor/shield rules still apply.
        if (dist <= effect.range) damagePlayer(playerId, effect.damagePerTick);
      }
    } else if (effect.type === 'inferno_pillar') {
      ({ hits } = collectRadialHits(
        effect.originX,
        effect.originZ,
        effect.range,
        effect.damagePerTick,
        { attackerId: effect.ownerId }
      ));
    } else {
      ({ hits } = collectConeHits(
        effect.originX,
        effect.originZ,
        effect.dirX,
        effect.dirZ,
        effect.range,
        effect.coneAngle,
        effect.damagePerTick
      ));
    }
    effect.lastTickAt = now;
    effect.ticksRemaining -= 1;
    effect.lastHits = hits;
  }

  _gameState.areaEffects = _gameState.areaEffects.filter(
    effect => effect.ticksRemaining > 0 && now < effect.expiresAt
  );
  _progression().cleanupAfterDamage();
}

/**
 * Apply due Echo Strike packets. Each entry was enqueued by the weapon branch
 * of useCard ({ attackerId, targets:[{enemyId,damage}], applyAt }). Once its
 * applyAt has passed, subtract the echo damage from each still-living target
 * enemy, attribute the kill, and drop the entry.
 */
function processPendingEchoes() {
  const pending = _gameState.pendingEchoes;
  if (!pending || pending.length === 0) return;
  const now = Date.now();
  let applied = false;

  for (const echo of pending) {
    if (now < echo.applyAt) continue;
    for (const target of echo.targets) {
      const enemy = _gameState.enemies.find(e => e.id === target.enemyId);
      if (!enemy || enemy.hp <= 0) continue;
      enemy.lastDamagedBy = echo.attackerId;
      damageEnemy(enemy, target.damage);
      applied = true;
    }
    echo.done = true;
  }

  if (applied) _progression().cleanupAfterDamage();
  _gameState.pendingEchoes = pending.filter(echo => !echo.done);
}

function findNearestMinionNear(enemyX, enemyZ, detectionRadius, options = {}) {
  const tauntOnly = options.tauntOnly === true;
  let nearestDist = Infinity;
  let nearestMinion = null;

  for (const minion of _gameState.minions) {
    if (minion.hp <= 0) continue;
    if (tauntOnly && !minion.taunt) continue;
    const dist = Math.hypot(minion.x - enemyX, minion.z - enemyZ);
    if (dist <= detectionRadius && dist < nearestDist) {
      nearestDist = dist;
      nearestMinion = minion;
    }
  }

  if (!nearestMinion) return null;
  return { minion: nearestMinion, dist: nearestDist };
}

function findTauntMinionNear(enemyX, enemyZ, detectionRadius) {
  const result = findNearestMinionNear(enemyX, enemyZ, detectionRadius, { tauntOnly: true });
  return result ? result.minion : null;
}

function damageMinion(minion, amount) {
  if (!minion || amount <= 0 || minion.hp <= 0) return;
  const maxHp = minion.maxHp || Math.max(minion.hp, 1);
  const maxTtl = minion.maxTtl || minion.ttl || 1;
  minion.hp = Math.max(0, minion.hp - amount);
  const ttlBurn = (amount * maxTtl / maxHp) * 0.25;
  minion.ttl = Math.max(0, minion.ttl - ttlBurn);
}

// ── Player Damage / Respawn ──

// ── Enchantments (ground hazards + self buffs) ──

function countGroundEnchantmentsForPlayer(ownerId) {
  if (!_gameState.enchantments) return 0;
  return _gameState.enchantments.filter(
    (enc) => enc.ownerId === ownerId && enc.target === 'ground' && enc.armed
  ).length;
}

function spawnGroundEnchantment(x, z, cardDef, ownerId) {
  if (!_gameState.enchantments) _gameState.enchantments = [];
  const now = Date.now();
  _gameState.enchantments.push({
    id: crypto.randomUUID(),
    ownerId,
    cardId: cardDef.id,
    effect: cardDef.effect,
    target: 'ground',
    x,
    z,
    radius: cardDef.radius || 2.5,
    damage: cardDef.damage || 35,
    damagePerTick: cardDef.damagePerTick,
    dotTicks: cardDef.dotTicks,
    dotIntervalMs: cardDef.dotIntervalMs,
    expiresAt: now + (cardDef.ttlMs || 30000),
    armed: true,
  });
}

function armSelfEnchantment(player, cardDef) {
  const now = Date.now();
  player.activeEnchantment = {
    cardId: cardDef.id,
    effect: cardDef.effect,
    target: 'self',
    damageScale: cardDef.damageScale ?? 0.5,
    minReflectDamage: cardDef.minReflectDamage || 15,
    reflectRange: cardDef.reflectRange || 8,
    expiresAt: now + (cardDef.ttlMs || 20000),
    armed: true,
  };
}

// ── Block / angle helpers ──

/** Normalize an angle (radians) into [-PI, PI]. */
function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Resolve attacker position {x, z} from damage options.
 * Checks `options.attackerEnemyId` (enemy) then `options.attackerId` (minion).
 * Returns null if no attacker position can be resolved.
 */
function getAttackerPosition(options) {
  if (!options) return null;
  if (options.attackerEnemyId) {
    const enemies = _gameState && _gameState.enemies;
    if (enemies) {
      const enemy = enemies.find(
        (e) => e.id === options.attackerEnemyId && e.hp > 0
      );
      if (enemy) return { x: enemy.x, z: enemy.z };
    }
  }
  if (options.attackerId) {
    const minions = _gameState && _gameState.minions;
    if (minions) {
      const minion = minions.find(
        (m) => m.id === options.attackerId && m.hp > 0
      );
      if (minion) return { x: minion.x, z: minion.z };
    }
  }
  return null;
}

/**
 * Compute the angle (in the XZ plane) from the player to an attacker position.
 * Returns radians: 0 = +X direction, increasing toward +Z (matches rotation = atan2(z, x)).
 */
function angleFromPlayerTo(attackerPos, player) {
  return Math.atan2(attackerPos.z - player.z, attackerPos.x - player.x);
}

function findEnemyById(enemyId) {
  return _gameState.enemies.find((enemy) => enemy.id === enemyId && enemy.hp > 0) || null;
}

function triggerMirrorWard(playerId, damageTaken, attackerEnemyId) {
  const player = _gameState.players[playerId];
  if (!player || !player.activeEnchantment || !player.activeEnchantment.armed) return null;

  const enc = player.activeEnchantment;
  if (enc.effect !== 'mirror_ward') return null;

  const now = Date.now();
  if (now >= enc.expiresAt) {
    player.activeEnchantment = null;
    return null;
  }

  const reflectDamage = Math.max(
    enc.minReflectDamage,
    Math.round(damageTaken * enc.damageScale)
  );
  let hits = [];
  let direction = { x: 1, z: 0 };

  const attacker = attackerEnemyId ? findEnemyById(attackerEnemyId) : null;
  if (attacker) {
    const dx = attacker.x - player.x;
    const dz = attacker.z - player.z;
    const dist = Math.hypot(dx, dz) || 1;
    direction = { x: dx / dist, z: dz / dist };
    attacker.lastDamagedBy = playerId;
    damageEnemy(attacker, reflectDamage);
    hits.push({ enemyId: attacker.id, damage: reflectDamage });
  } else {
    const radial = collectRadialHits(
      player.x,
      player.z,
      enc.reflectRange,
      reflectDamage,
      { attackerId: playerId }
    );
    hits = radial.hits;
    if (hits.length > 0) {
      const firstHit = _gameState.enemies.find((enemy) => enemy.id === hits[0].enemyId);
      if (firstHit) {
        const dx = firstHit.x - player.x;
        const dz = firstHit.z - player.z;
        const dist = Math.hypot(dx, dz) || 1;
        direction = { x: dx / dist, z: dz / dist };
      }
    }
  }

  player.activeEnchantment = null;
  _progression().cleanupAfterDamage();

  return { hits, direction, reflectDamage };
}

function updateEnchantments() {
  if (!_gameState.enchantments) _gameState.enchantments = [];

  const now = Date.now();
  let triggered = false;

  for (const enc of _gameState.enchantments) {
    if (!enc.armed || now >= enc.expiresAt) continue;
    if (enc.effect !== 'spike_trap' && enc.effect !== 'cinder_snare') continue;

    for (const enemy of _gameState.enemies) {
      if (enemy.hp <= 0) continue;
      const dist = Math.hypot(enemy.x - enc.x, enemy.z - enc.z);
      if (dist <= enc.radius) {
        if (enc.effect === 'cinder_snare') {
          // Instead of a one-shot hit, drop a lingering inferno-pillar DoT
          // area at the trap position; updateAreaEffects ticks the damage.
          const syntheticDef = {
            damage: enc.damagePerTick,
            dotTicks: enc.dotTicks,
            dotIntervalMs: enc.dotIntervalMs,
            attackRange: enc.radius,
          };
          spawnInfernoPillarEffect(enc.x, enc.z, syntheticDef, enc.ownerId);
        } else {
          enemy.lastDamagedBy = enc.ownerId;
          damageEnemy(enemy, enc.damage);
        }
        enc.armed = false;
        triggered = true;
        break;
      }
    }
  }

  _gameState.enchantments = _gameState.enchantments.filter(
    (enc) => enc.armed && now < enc.expiresAt
  );

  for (const player of Object.values(_gameState.players)) {
    if (player.activeEnchantment && now >= player.activeEnchantment.expiresAt) {
      player.activeEnchantment = null;
    }
  }

  if (triggered) {
    _progression().cleanupAfterDamage();
  }
}

function damageEnemy(enemy, amount) {
  if (!enemy || amount <= 0) {
    return { hpBefore: enemy?.hp ?? 0, killed: false };
  }

  const hpBefore = enemy.hp;
  let remaining = amount;

  if ((enemy.shieldHp || 0) > 0) {
    const absorbed = Math.min(enemy.shieldHp, remaining);
    enemy.shieldHp -= absorbed;
    remaining -= absorbed;
    if (enemy.shieldHp <= 0) {
      enemy.shieldHp = 0;
    }
  }

  if (remaining > 0) {
    enemy.hp = Math.max(0, enemy.hp - remaining);
  }

  const killed = hpBefore > 0 && enemy.hp <= 0;
  return { hpBefore, killed };
}

function damagePlayer(playerId, amount, options = {}) {
  const player = _gameState.players[playerId];
  if (!player) return null;

  if (amount <= 0) return null;

  let remaining = amount;
  const now = Date.now();

  // Invulnerability check (i-frames from dodge roll, etc.)
  if (player.invulnerableUntil && now < player.invulnerableUntil) return null;

  // Barrier dome check (only ranged/projectile damage from outside the dome).
  // Any living player's active dome protects allies standing inside it (co-op),
  // not just the caster. Melee (unflagged) damage is never blocked here.
  if (options.ranged || options.projectile) {
    const attackerPos = getAttackerPosition(options);
    for (const dome of Object.values(_gameState.players)) {
      if (dome.dead) continue;
      if (!dome.barrierDomeUntil || now >= dome.barrierDomeUntil) continue;
      const radius = dome.barrierDomeRadius || 0;
      if (radius <= 0) continue;
      const victimDist = Math.hypot(player.x - dome.barrierDomeX, player.z - dome.barrierDomeZ);
      if (victimDist > radius) continue; // victim not inside this dome
      // Victim is inside an active dome. Block unless the attacker is also inside
      // it (outside→inside is blocked; inside→inside is not). Unknown attacker
      // position is treated as outside and blocked.
      if (attackerPos) {
        const attackerDist = Math.hypot(attackerPos.x - dome.barrierDomeX, attackerPos.z - dome.barrierDomeZ);
        if (attackerDist <= radius) continue; // attacker inside same dome → not blocked
      }
      return null; // fully blocked
    }
  }

  // Block check (only if not invulnerable — dodge takes priority)
  if (player.blockingUntil && now < player.blockingUntil) {
    const attackerPos = getAttackerPosition(options);
    if (attackerPos) {
      const angle = angleFromPlayerTo(attackerPos, player);
      const halfArc = (150 / 2) * (Math.PI / 180); // ~1.309 rad
      const yawDiff = Math.abs(normalizeAngle(angle - (player.blockingYaw || 0)));
      if (yawDiff <= halfArc) {
        // Frontal — apply damage reduction
        const def = _progression().getKeyItemDef('guard_block');
        remaining *= (1 - (def?.damageReduction || 0.7));
      }
      // else: rear — full damage (chip)
    }
  }

  // One-hit absorb shield (purge_charm no-debuff fallback). Hit-based, not
  // HP-based: the FULL incoming hit is absorbed regardless of amount, and the
  // shield is consumed. Checked before the shieldHp pool below.
  if ((player.shieldHitsRemaining || 0) > 0) {
    player.shieldHitsRemaining -= 1;
    return null;
  }

  // Shield expiry
  if (player.shieldExpiresAt && now > player.shieldExpiresAt) {
    player.shieldHp = 0;
    player.shieldExpiresAt = 0;
  }
  if (player.shieldHp > 0 && remaining > 0) {
    const absorbed = Math.min(player.shieldHp, remaining);
    player.shieldHp -= absorbed;
    remaining -= absorbed;
    if (player.shieldHp <= 0) {
      player.shieldHp = 0;
      player.shieldExpiresAt = 0;
    }
  }
  if (remaining <= 0) return null;

  player.hp = Math.max(0, player.hp - remaining);
  if (options.attackerEnemyId) {
    applyLeechHeal(options.attackerEnemyId, remaining, _gameState.enemies);
  }
  const mirrorResult = triggerMirrorWard(playerId, remaining, options.attackerEnemyId);

  if (player.hp <= 0 && !player.dead) {
    player.dead = true;

    if (_onTerminalCheck) {
      _onTerminalCheck();
    }

    const respawnId = setTimeout(() => {
      const p = _gameState.players[playerId];
      if (!p) return; // player may have disconnected
      const spawn = firstRoomPosition();
      p.hp = MAX_HP;
      p.dead = false;
      p.invulnerableUntil = 0;
      p.lastMoveTime = Date.now();
      p.x = spawn.x;
      p.y = 0.5;
      p.z = spawn.z;
    }, RESPAWN_DELAY_MS);
    _timeouts.push(respawnId);
  }

  return mirrorResult;
}

// ── Enemy AI Tick ──

function updateEnemies() {
	if (_gameState.run && (_gameState.run.status === 'victory' || _gameState.run.status === 'failed')) return;

	const dt = 1 / TICK_RATE;
	const players = Object.values(_gameState.players).filter(p => !p.dead && !p.extracted);

	for (const enemy of _gameState.enemies) {
		ensureEnemyCombatStats(enemy);
		checkFrenziedTelegraph(enemy, Date.now());
		const { chaseSpeedMult, attackWindupMult } = getFrenziedCombatMultipliers(enemy);
		const chaseSpeed = enemy.chaseSpeed * chaseSpeedMult;
		const attackWindupMs = enemy.attackWindupMs * attackWindupMult;

		if (isEnemyFrozen(enemy)) {
			continue;
		}

		// Ensure attackState exists (backward compat for enemies spawned before this change)
		if (!enemy.attackState) enemy.attackState = 'idle';

		// ── Recovery: wait out cooldown, then return to chasing or idle ──
		if (enemy.attackState === 'recovering') {
			if (Date.now() >= enemy.recoverUntil) {
				enemy.attackState = 'chasing';
			} else {
				continue; // do not move while recovering
			}
			// fall through to chasing/idle logic below
		}

		// ── Wind-up: wait, then revalidate range before striking ──
		if (enemy.attackState === 'windup') {
			const elapsed = Date.now() - enemy.windupStartTime;
			if (elapsed >= attackWindupMs) {
				const target = resolveWindupTarget(enemy);
				// A player who became concealed by smoke during the wind-up is no
				// longer a valid target — cancel the strike and return to chasing.
				const targetConcealed = target && enemy.windupTargetType !== 'minion'
					&& isPlayerConcealed(target, Date.now());
				if (target && !targetConcealed && isEntityInEnemyAttack(enemy, target)) {
					if (enemy.windupTargetType === 'minion') {
						damageMinion(target, enemy.attackDamage);
					} else {
						damagePlayer(enemy.windupTargetId, enemy.attackDamage, { attackerEnemyId: enemy.id });
					}
					enemy.attackState = 'recovering';
					enemy.recoverUntil = Date.now() + ENEMY_ATTACK_RECOVERY_MS;
					continue;
				}
				// Target out of range or dead — cancel attack, return to chasing
				enemy.attackState = 'chasing';
				continue;
			} else {
				continue; // still winding up, do not move
			}
		}

		// ── Spawner: periodically spawn adds ──
		if (enemy.type === 'spawner' && enemy.hp > 0) {
			const spawnInterval = enemy.spawnIntervalMs || 4000;
			const spawnMaxAlive = enemy.spawnMaxAlive || 3;
			const spawnType = enemy.spawnType || 'skirmisher';
			const now = Date.now();

			if (now - enemy.lastSpawnTime >= spawnInterval) {
				// Count living adds belonging to this spawner
				const aliveAdds = _gameState.enemies.filter(
					e => e.spawnedBy === enemy.id && e.hp > 0
				).length;

				if (aliveAdds < spawnMaxAlive) {
					// Place add within ~3 units of spawner
					const addPos = nearbySpawnPosition(enemy.x, enemy.z, 3);
					const add = _progression().spawnEnemy(addPos.x, addPos.z, spawnType, enemy.id);
					add.wanderTarget = randomWanderTarget();
					enemy.lastSpawnTime = now;
				}
			}
		}

		// ── Find nearest living player or taunt minion ──
		const tauntMinion = findTauntMinionNear(enemy.x, enemy.z, DETECTION_RADIUS);
		if (tauntMinion) {
			enemy.state = 'chasing';
			const dist = Math.hypot(tauntMinion.x - enemy.x, tauntMinion.z - enemy.z);
			if (dist <= ENEMY_ATTACK_RANGE) {
				damageMinion(tauntMinion, enemy.attackDamage);
			} else {
				moveEntityToward(enemy, tauntMinion, chaseSpeed * dt);
			}
			continue;
		}

		let nearestTarget = null;
		let nearestTargetType = null;
		let nearestDist = Infinity;

		const nearestMinion = findNearestMinionNear(enemy.x, enemy.z, DETECTION_RADIUS);
		if (nearestMinion && nearestMinion.dist < nearestDist) {
			nearestTarget = nearestMinion.minion;
			nearestTargetType = 'minion';
			nearestDist = nearestMinion.dist;
		}

		const nowConceal = Date.now();
		for (const player of players) {
			// Players hidden inside an active smoke zone cannot be acquired.
			if (isPlayerConcealed(player, nowConceal)) continue;
			const dx = player.x - enemy.x;
			const dz = player.z - enemy.z;
			const dist = Math.hypot(dx, dz);
			if (dist < DETECTION_RADIUS && dist < nearestDist) {
				nearestDist = dist;
				nearestTarget = player;
				nearestTargetType = 'player';
			}
		}

		// ── Chasing: move toward target, transition to windup in range ──
		if (nearestTarget && nearestDist < DETECTION_RADIUS) {
			enemy.state = 'chasing';

			// If in chasing (not mid-windup/recover) and within attack range, start wind-up
			if (enemy.attackState === 'chasing' || enemy.attackState === 'idle') {
				if (nearestDist <= (enemy.attackRange ?? ENEMY_ATTACK_RANGE)) {
					enemy.attackState = 'windup';
					enemy.windupTargetType = nearestTargetType;
					enemy.windupTargetId = nearestTarget.id;
					enemy.windupStartTime = Date.now();
					lockWindupDirection(enemy, nearestTarget);
					continue; // do not move during wind-up
				}
				enemy.attackState = 'chasing';
			}

			const chaseResult = moveEntityToward(enemy, nearestTarget, chaseSpeed * dt);
			// If blocked while chasing, enemy stops at wall edge (wall-slide handles sliding)
			void chaseResult;
			continue;
		}

		// ── No target in detection range — revert to idle and wander ──
		enemy.state = 'idle';
		enemy.attackState = 'idle';
		const wdx = enemy.wanderTarget.x - enemy.x;
		const wdz = enemy.wanderTarget.z - enemy.z;
		const wdist = Math.hypot(wdx, wdz);

		// Reached wander target — pick a new one
		if (wdist < 0.5) {
			enemy.wanderTarget = randomWanderTarget();
			enemy.blockedTicks = 0;
			continue;
		}

		// Move toward wander target using wall-aware movement
		const wanderResult = moveEntityToward(enemy, enemy.wanderTarget, enemy.wanderSpeed * dt);

		// Track consecutive blocked ticks — pick a new target after too many blocks
		if (wanderResult.blocked) {
			if (!enemy.blockedTicks) enemy.blockedTicks = 0;
			enemy.blockedTicks += 1;
			if (enemy.blockedTicks > 10) {
				enemy.wanderTarget = randomWanderTarget();
				enemy.blockedTicks = 0;
			}
		} else {
			enemy.blockedTicks = 0;
		}
	}
}

// ── Minion AI Tick ──

function updateMinions() {
  const dt = 1 / TICK_RATE;
  const runTerminal = _gameState.run && (_gameState.run.status === 'victory' || _gameState.run.status === 'failed');
  const now = Date.now();

  for (const minion of _gameState.minions) {
    const owner = _gameState.players[minion.ownerId];
    if (!owner || owner.dead) continue;

    if (minion.type === 'mana_prism') {
      const interval = minion.pulseIntervalMs || 2000;
      const lastPulseAt = minion.lastPulseAt ?? now;
      if (now - lastPulseAt >= interval) {
        const pulses = Math.floor((now - lastPulseAt) / interval);
        _progression().addMagicStones(owner, pulses * (minion.magicStonePulse || 10));
        minion.lastPulseAt = lastPulseAt + pulses * interval;
      }
    }

    if (minion.type === 'battery_automaton') {
      const interval = minion.chargePulseIntervalMs || 6000;
      const lastPulseAt = minion.lastChargePulseAt ?? now;
      if (now - lastPulseAt >= interval) {
        const pulses = Math.floor((now - lastPulseAt) / interval);
        for (let i = 0; i < pulses; i++) {
          _progression().restoreHandCharges(owner, minion.chargeRestore || 1, {
            maxTargets: 1,
            selection: 'random',
          });
        }
        minion.lastChargePulseAt = lastPulseAt + pulses * interval;
      }
    }
  }

  // AI: each living minion seeks nearest enemy, chases, and attacks
  // If no enemy is nearby, follows its owner.
  // Skipped entirely when the run is terminal (victory or failed)
  if (!runTerminal) {
    for (const minion of _gameState.minions) {
      if (minion.type === 'mana_prism') continue;

      let nearestDist = Infinity;
      let nearestEnemy = null;

      for (const enemy of _gameState.enemies) {
        const dx = enemy.x - minion.x;
        const dz = enemy.z - minion.z;
        const dist = Math.hypot(dx, dz);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      }

      if (minion.type === 'astral_guardian' || minion.type === 'aegis_sentinel') {
        const attackDamage = minion.attackDamage != null ? minion.attackDamage : 10;
        const attackIntervalMs = minion.attackIntervalMs || Math.floor(1000 / TICK_RATE);
        const lastAttackAt = minion.lastAttackAt || 0;

        if (nearestEnemy && nearestDist < DETECTION_RADIUS) {
          if (nearestDist <= ATTACK_RANGE) {
            if (now - lastAttackAt >= attackIntervalMs) {
              nearestEnemy.lastDamagedBy = minion.ownerId;
              damageEnemy(nearestEnemy, attackDamage);
              minion.lastAttackAt = now;
            }
          } else {
            moveEntityToward(minion, nearestEnemy, MINION_CHASE_SPEED_GRUNT * dt);
          }
        } else {
          const owner = _gameState.players[minion.ownerId];
          if (owner && !owner.dead) {
            const dx = owner.x - minion.x;
            const dz = owner.z - minion.z;
            const distToOwner = Math.hypot(dx, dz);
            if (distToOwner > MINION_FOLLOW_DISTANCE) {
              moveEntityToward(minion, owner, MINION_FOLLOW_SPEED * dt, { stopDistance: MINION_FOLLOW_DISTANCE });
            }
          }
        }
        continue;
      }

      if (minion.type === 'storm_eagle' || minion.type === 'thunderbird') {
        const attackRange = minion.attackRange || (minion.type === 'thunderbird' ? 11 : 7);
        const attackDamage = minion.attackDamage || (minion.type === 'thunderbird' ? 18 : 12);

        if (nearestEnemy && nearestDist < DETECTION_RADIUS) {
          if (nearestDist <= attackRange) {
            nearestEnemy.lastDamagedBy = minion.ownerId;
            damageEnemy(nearestEnemy, attackDamage);
            if (minion.type === 'thunderbird') {
              const chainRadius = minion.chainRadius || 5;
              const maxChainTargets = minion.maxChainTargets || 2;
              const hitIds = new Set([nearestEnemy.id]);
              let current = nearestEnemy;
              let chains = 0;
              while (chains < maxChainTargets) {
                let next = null;
                let nextDist = Infinity;
                for (const enemy of _gameState.enemies) {
                  if (hitIds.has(enemy.id) || enemy.hp <= 0) continue;
                  const dist = Math.hypot(enemy.x - current.x, enemy.z - current.z);
                  if (dist <= chainRadius && dist < nextDist) {
                    nextDist = dist;
                    next = enemy;
                  }
                }
                if (!next) break;
                next.lastDamagedBy = minion.ownerId;
                damageEnemy(next, attackDamage);
                hitIds.add(next.id);
                current = next;
                chains++;
              }
            }
          } else {
            moveEntityToward(minion, nearestEnemy, MINION_CHASE_SPEED_SKIRMISHER * dt);
          }
        } else {
          const owner = _gameState.players[minion.ownerId];
          if (owner && !owner.dead) {
            const dx = owner.x - minion.x;
            const dz = owner.z - minion.z;
            const distToOwner = Math.hypot(dx, dz);
            if (distToOwner > MINION_FOLLOW_DISTANCE) {
              moveEntityToward(minion, owner, MINION_FOLLOW_SPEED * dt, { stopDistance: MINION_FOLLOW_DISTANCE });
            }
          }
        }
        continue;
      }

      if (minion.type === 'null_crawler') {
        const attackRange = minion.attackRange || 14;
        const attackDamage = minion.attackDamage || 22;
        const attackIntervalMs = minion.attackIntervalMs || 2000;
        const attackWindupMs = minion.attackWindupMs || 1000;
        const projectileHitWidth = minion.projectileHitWidth || 0.8;
        const lastAttackAt = minion.lastAttackAt ?? 0;

        if (minion.attackState === 'windup') {
          const elapsed = now - (minion.windupStartTime || 0);
          if (elapsed >= attackWindupMs) {
            const dirX = minion.windupDirX ?? 1;
            const dirZ = minion.windupDirZ ?? 0;
            const { hits } = collectPhaseBeamHits(
              minion.x,
              minion.z,
              dirX,
              dirZ,
              attackRange,
              attackDamage,
              {
                attackerId: minion.ownerId,
                hitWidth: projectileHitWidth,
                excludeMinionId: minion.id,
              }
            );
            minion.lastAttackAt = now;
            minion.attackState = 'idle';
            delete minion.windupStartTime;
            delete minion.windupDirX;
            delete minion.windupDirZ;
            _gameState._pendingMinionBreaths.push({
              playerId: minion.ownerId,
              cardId: 'null_crawler',
              specialEffect: 'phase_beam',
              origin: { x: minion.x, z: minion.z },
              direction: { x: dirX, z: dirZ },
              attackRange,
              hitWidth: projectileHitWidth,
              hits,
              minionId: minion.id,
            });
          }
          continue;
        }

        if (nearestEnemy && nearestDist < DETECTION_RADIUS) {
          if (nearestDist <= attackRange) {
            if (now - lastAttackAt >= attackIntervalMs) {
              minion.attackState = 'windup';
              minion.windupStartTime = now;
              lockMinionWindupDirection(minion, nearestEnemy);
            }
          } else {
            moveEntityToward(minion, nearestEnemy, MINION_CHASE_SPEED_SKIRMISHER * dt);
          }
        } else {
          const owner = _gameState.players[minion.ownerId];
          if (owner && !owner.dead) {
            const dx = owner.x - minion.x;
            const dz = owner.z - minion.z;
            const distToOwner = Math.hypot(dx, dz);
            if (distToOwner > MINION_FOLLOW_DISTANCE) {
              moveEntityToward(minion, owner, MINION_FOLLOW_SPEED * dt, { stopDistance: MINION_FOLLOW_DISTANCE });
            }
          }
        }
        continue;
      }

      if (minion.type === 'bulkhead_mauler') {
        const attackRange = minion.attackRange || 4;
        const attackConeAngle = minion.attackConeAngle || ((Math.PI * 2) / 3);
        const attackDamage = minion.attackDamage || 9;

        if (nearestEnemy && nearestDist < DETECTION_RADIUS) {
          if (nearestDist <= attackRange) {
            const dist = nearestDist || 1;
            const dirX = (nearestEnemy.x - minion.x) / dist;
            const dirZ = (nearestEnemy.z - minion.z) / dist;
            const { hits } = collectConeHits(
              minion.x,
              minion.z,
              dirX,
              dirZ,
              attackRange,
              attackConeAngle,
              attackDamage,
              { attackerId: minion.ownerId }
            );
            if (hits.length > 0) {
              _gameState._pendingMinionBreaths.push({
                playerId: minion.ownerId,
                cardId: 'bulkhead_mauler',
                specialEffect: 'shockwave_sweep',
                origin: { x: minion.x, z: minion.z },
                direction: { x: dirX, z: dirZ },
                attackRange,
                attackConeAngle,
                hits,
                minionId: minion.id,
              });
            }
          } else {
            moveEntityToward(minion, nearestEnemy, MINION_CHASE_SPEED_GRUNT * 0.75 * dt);
          }
        } else {
          const owner = _gameState.players[minion.ownerId];
          if (owner && !owner.dead) {
            const dx = owner.x - minion.x;
            const dz = owner.z - minion.z;
            const distToOwner = Math.hypot(dx, dz);
            if (distToOwner > MINION_FOLLOW_DISTANCE) {
              moveEntityToward(minion, owner, MINION_FOLLOW_SPEED * dt, { stopDistance: MINION_FOLLOW_DISTANCE });
            }
          }
        }
        continue;
      }

      if (minion.type === 'dungeon_drake' || minion.type === 'ancient_wyrm') {
        const isAncient = minion.type === 'ancient_wyrm';
        updateWyrmMinionAI(minion, nearestEnemy, nearestDist, dt, {
          cardId: isAncient ? 'ancient_wyrm' : 'dungeon_drake',
          specialEffect: isAncient ? 'fire_breath' : undefined,
          breathRange: minion.breathRange ?? (isAncient ? 10 : 6),
          breathHoldDistance: minion.breathHoldDistance ?? Math.max(2.5, (minion.breathRange ?? (isAncient ? 10 : 6)) * 0.58),
          breathConeAngle: minion.breathConeAngle ?? (isAncient ? (Math.PI / 3) : (Math.PI / 4)),
          breathDamage: minion.breathDamage ?? (isAncient ? 4 : 3),
          breathDurationMs: minion.breathDurationMs ?? (isAncient ? 2500 : 2000),
          breathTickMs: minion.breathTickMs ?? 500,
          breathIntervalMs: minion.breathIntervalMs ?? (isAncient ? 3000 : 2500),
          chaseSpeed: MINION_CHASE_SPEED_GRUNT,
        });
        continue;
      }

      // Chase if an enemy is within detection range
      if (nearestEnemy && nearestDist < DETECTION_RADIUS) {
        // Attack if within attack range
        if (nearestDist <= ATTACK_RANGE) {
          nearestEnemy.lastDamagedBy = minion.ownerId;
          damageEnemy(nearestEnemy, 5);
        } else {
          // Move toward enemy using moveEntityToward (wall-aware)
          moveEntityToward(minion, nearestEnemy, MINION_CHASE_SPEED_GRUNT * dt);
        }
      } else {
        // No enemy in range — follow owner
        const owner = _gameState.players[minion.ownerId];
        if (owner && !owner.dead) {
          const dx = owner.x - minion.x;
          const dz = owner.z - minion.z;
          const distToOwner = Math.hypot(dx, dz);
          if (distToOwner > MINION_FOLLOW_DISTANCE) {
            moveEntityToward(minion, owner, MINION_FOLLOW_SPEED * dt, { stopDistance: MINION_FOLLOW_DISTANCE });
          }
          // Within follow distance — stay put
        }
        // Owner missing, disconnected, or dead — stay stationary
      }
    }
  }

  // Process lingering area effects (e.g. Dragon's Breath DoT)
  updateAreaEffects();

  // Apply due Echo Strike second-hit packets
  processPendingEchoes();

  // Ground enchantments (Spike Trap, etc.)
  updateEnchantments();

  // Cleanup dead enemies after minion attacks
  _progression().cleanupAfterDamage();

  // Cleanup expired revealedUntil on enemies (flare_beacon)
  const nowTick = Date.now();
  for (const enemy of _gameState.enemies) {
    if (enemy.revealedUntil && nowTick >= enemy.revealedUntil) {
      delete enemy.revealedUntil;
    }
  }

  // Decrement TTL and remove expired/dead minions
  for (const minion of _gameState.minions) {
    minion.ttl -= dt;
  }

  const survivingMinions = [];
  const progression = _progression();
  for (const minion of _gameState.minions) {
    if (minion.ttl > 0 && minion.hp > 0) {
      survivingMinions.push(minion);
      continue;
    }
    const owner = _gameState.players[minion.ownerId];
    if (owner) {
      progression.releaseBurningCreatureCard(owner, minion);
    }
  }
  _gameState.minions = survivingMinions;
}

// ── Magic Stone Regen ──

function regenMagicStones() {
  for (const p of Object.values(_gameState.players)) {
    if (p.debugScenario === 'summon-low-mana') {
      p.magicStones = 0;
    } else {
      p.magicStones = Math.min(MAX_MAGIC_STONES, p.magicStones + MAGIC_STONES_REGEN_PER_TICK);
    }
    if (p.pendingSummons) p.pendingSummons.clear();
  }
}

// ── Stale Player Cleanup ──

/**
 * Remove stale players (no activity for STALE_THRESHOLD ms).
 */
function cleanupStalePlayers() {
  for (const playerId in _gameState.players) {
    const player = _gameState.players[playerId];
    if (Date.now() - player.lastActivity > STALE_THRESHOLD) {
      // Persist latest state before removing
      if (_savePlayerData) {
        _savePlayerData(playerId);
      }
      if (_findSocketByPlayerId) {
        const socket = _findSocketByPlayerId(playerId);
        if (socket && socket.connected) {
          socket.disconnect();
        }
      }
      delete _gameState.players[playerId];
      console.log(`Player disconnected due to inactivity: ${playerId}`);
    }
  }
}

// ── Exports ──

module.exports = {
  // Setup (called by index.js after both modules are loaded)
  setGameState,
  setTerminalCheckCallback,
  setFindSocketCallback,
  setSavePlayerCallback,

  // Collision
  buildWallColliders,
  rebuildWallColliders,
  getWallColliders,
  wallAABB,
  checkWallCollision,
  resolveWallCollision,
  checkSweptCollision,
  tryPlayerMove,
  applyPlayerKnockback,
  applyPlayerMovement,
  flushDirtyPlayerSaves,
  segmentAABBEntryT,
  segmentIntersectsAABB,
  isEntityPositionBlocked,
  moveEntityToward,
  ENTITY_RADIUS,
  PLAYER_RADIUS,

  // Dungeon position helpers
  computeDungeonBounds,
  computeWalkableAABBs,
  isInsideDungeon,
  firstRoomPosition,
  randomRoomPosition,
  pickFloorSpawnPosition,
  clampToDungeon,
  nearbySpawnPosition,
  randomWanderTarget,

  // Enemy definitions
  ENEMY_DEFS,
  enemyDefFor,
  MINION_FOLLOW_DISTANCE,
  MINION_FOLLOW_SPEED,

  // Enemy AI
  updateEnemies,
  isPlayerConcealed,

  // Minion AI
  updateMinions,

  // Player damage / heal
  damagePlayer,
  damageEnemy,
  damageMinion,
  healPlayer,
  addDebuff,

  // Card combat helpers
  collectConeHits,
  collectRadialHits,
  collectProjectileHits,
  collectPhaseBeamHits,
  collectReturningProjectileHits,
  applyFreezeInRadius,
  pullEnemiesToward,
  applyKnockback,
  applyEventHorizon,
  spawnDragonsBreathEffect,
  spawnFireTrailEffect,
  spawnInfernoPillarEffect,
  spawnVolatileExplosion,
  updateAreaEffects,
  processPendingEchoes,
  updateEnchantments,
  spawnGroundEnchantment,
  armSelfEnchantment,
  countGroundEnchantmentsForPlayer,
  isEnemyFrozen,

  // Magic stones
  regenMagicStones,

  // Stale player cleanup
  cleanupStalePlayers
};
