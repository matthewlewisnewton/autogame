// ── Server Simulation Module ──
// Tick-based entity AI, collision, player damage, magic stone regen, stale cleanup.
// Imported by index.js; re-exported from index.js for test compatibility.

const crypto = require('crypto');
const {
  TICK_RATE,
  MOVE_SPEED,
  DETECTION_RADIUS,
  ENEMY_ATTACK_RANGE,
  ENEMY_ATTACK_RECOVERY_MS,
  MAX_MAGIC_STONES,
  MAGIC_STONES_REGEN_PER_TICK,
  SUMMON_RADIUS,
  ATTACK_RANGE,
  STALE_THRESHOLD,
  BOUNDS_MARGIN,
  SPAWN_PADDING,
  MAX_HP,
  RESPAWN_DELAY_MS,
  COOLDOWN_MS
} = require('./config');

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
      colliders.push(wallAABB({ ...wall, length: passage.corridorLength }, PASSAGE_WALL_THICKNESS / 2));
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
function checkWallCollision(px, pz, colliders = getWallColliders()) {
  const pr = PLAYER_RADIUS;

  for (const w of colliders) {
    if (px + pr <= w.minX || px - pr >= w.maxX) continue;
    if (pz + pr <= w.minZ || pz - pr >= w.maxZ) continue;
    return true; // overlap
  }

  return false;
}

/**
 * Resolve a proposed player position against wall colliders.
 * When the previous position is provided, push back to that side of the wall
 * so a client cannot tunnel through by landing inside the wall volume.
 */
function resolveWallCollision(newX, newZ, colliders = getWallColliders(), fromX = newX, fromZ = newZ) {
  let resolvedX = newX;
  let resolvedZ = newZ;

  for (let pass = 0; pass < 2; pass++) {
    let adjusted = false;

    for (const w of colliders) {
      const pMinX = resolvedX - PLAYER_RADIUS;
      const pMaxX = resolvedX + PLAYER_RADIUS;
      const pMinZ = resolvedZ - PLAYER_RADIUS;
      const pMaxZ = resolvedZ + PLAYER_RADIUS;

      if (pMaxX <= w.minX || pMinX >= w.maxX || pMaxZ <= w.minZ || pMinZ >= w.maxZ) continue;

      const overlapX = Math.min(pMaxX - w.minX, w.maxX - pMinX);
      const overlapZ = Math.min(pMaxZ - w.minZ, w.maxZ - pMinZ);

      if (overlapX < overlapZ) {
        if (fromX + PLAYER_RADIUS <= w.minX) {
          resolvedX = w.minX - PLAYER_RADIUS;
        } else if (fromX - PLAYER_RADIUS >= w.maxX) {
          resolvedX = w.maxX + PLAYER_RADIUS;
        } else {
          const wallCX = (w.minX + w.maxX) / 2;
          resolvedX += resolvedX < wallCX ? -overlapX : overlapX;
        }
      } else {
        if (fromZ + PLAYER_RADIUS <= w.minZ) {
          resolvedZ = w.minZ - PLAYER_RADIUS;
        } else if (fromZ - PLAYER_RADIUS >= w.maxZ) {
          resolvedZ = w.maxZ + PLAYER_RADIUS;
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
  const pr = PLAYER_RADIUS;

  for (const w of colliders) {
    // Expand AABB by player radius
    const aabb = {
      minX: w.minX - pr,
      maxX: w.maxX + pr,
      minZ: w.minZ - pr,
      maxZ: w.maxZ + pr,
    };

    if (options.allowEndpointTouch) {
      const entryT = segmentAABBEntryT(fromX, fromZ, toX, toZ, aabb);
      if (entryT != null && entryT < 1 - 1e-8) return true;
    } else if (segmentIntersectsAABB(fromX, fromZ, toX, toZ, aabb)) {
      return true;
    }
  }

  return false;
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
	grunt:      { hp: 50,  chaseSpeed: 2.5, wanderSpeed: 1.0, attackDamage: 10, attackWindupMs: 800 },
	skirmisher: { hp: 20,  chaseSpeed: 4.5, wanderSpeed: 1.5, attackDamage: 6,  attackWindupMs: 500 },
	miniboss:   { hp: 150, chaseSpeed: 1.2, wanderSpeed: 0.6, attackDamage: 18, attackWindupMs: 1200 },
	spawner:    { hp: 60,  chaseSpeed: 1.8, wanderSpeed: 0.9, attackDamage: 8,  attackWindupMs: 900,
		spawnIntervalMs: 4000, spawnMaxAlive: 3, spawnType: 'skirmisher' },
};

// Minion behavior constants
const MINION_FOLLOW_DISTANCE = 3;
const MINION_FOLLOW_SPEED = ENEMY_DEFS.grunt.chaseSpeed;
const PROJECTILE_HIT_WIDTH = 1.2;

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

    const hpBefore = enemy.hp;
    if (attackerId) enemy.lastDamagedBy = attackerId;
    enemy.hp -= damage;
    const killed = hpBefore > 0 && enemy.hp <= 0;
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

    const hpBefore = enemy.hp;
    if (attackerId) enemy.lastDamagedBy = attackerId;
    enemy.hp -= damage;
    const killed = hpBefore > 0 && enemy.hp <= 0;
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

function collectReturningProjectileHits(originX, originZ, dirX, dirZ, range, damage, options = {}) {
  const hits = [];
  let magicStonesGained = 0;
  const magicStoneOnHit = options.magicStoneOnHit || 0;
  const magicStoneOnKill = options.magicStoneOnKill || 0;
  const attackerId = options.attackerId;
  const sampleCount = Math.max(4, Math.ceil(range * 2));

  for (let pass = 0; pass < 2; pass++) {
    const hitEnemyIds = new Set();
    const start = pass === 0 ? 0 : range;
    const end = pass === 0 ? range : 0;
    for (let i = 0; i <= sampleCount; i++) {
      const t = start + (end - start) * (i / sampleCount);
      const px = originX + dirX * t;
      const pz = originZ + dirZ * t;

      for (const enemy of _gameState.enemies) {
        if (hitEnemyIds.has(enemy.id)) continue;
        const dist = Math.hypot(enemy.x - px, enemy.z - pz);
        if (dist > PROJECTILE_HIT_WIDTH) continue;

        const hpBefore = enemy.hp;
        if (attackerId) enemy.lastDamagedBy = attackerId;
        enemy.hp -= damage;
        const killed = hpBefore > 0 && enemy.hp <= 0;
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

function applyFreezeInRadius(originX, originZ, radius, durationMs, damage = 0) {
  const now = Date.now();
  const frozenUntil = now + durationMs;
  const hits = [];

  for (const enemy of _gameState.enemies) {
    const dist = Math.hypot(enemy.x - originX, enemy.z - originZ);
    if (dist > radius) continue;
    if (damage > 0) {
      enemy.hp -= damage;
      hits.push({ enemyId: enemy.id, hp: enemy.hp });
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
    enemy.x += (dx / dist) * pull;
    enemy.z += (dz / dist) * pull;
    moved.push({ enemyId: enemy.id, x: enemy.x, z: enemy.z });
  }
  return moved;
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

function updateAreaEffects() {
  if (!_gameState.areaEffects || _gameState.areaEffects.length === 0) return;
  const now = Date.now();

  for (const effect of _gameState.areaEffects) {
    if (now >= effect.expiresAt || effect.ticksRemaining <= 0) continue;
    if (now - effect.lastTickAt < effect.intervalMs) continue;

    const { hits } = collectConeHits(
      effect.originX,
      effect.originZ,
      effect.dirX,
      effect.dirZ,
      effect.range,
      effect.coneAngle,
      effect.damagePerTick
    );
    effect.lastTickAt = now;
    effect.ticksRemaining -= 1;
    effect.lastHits = hits;
  }

  _gameState.areaEffects = _gameState.areaEffects.filter(
    effect => effect.ticksRemaining > 0 && now < effect.expiresAt
  );
  _progression().cleanupAfterDamage();
}

function findTauntMinionNear(enemyX, enemyZ, detectionRadius) {
  let nearestDist = Infinity;
  let nearestMinion = null;

  for (const minion of _gameState.minions) {
    if (!minion.taunt || minion.hp <= 0) continue;
    const dist = Math.hypot(minion.x - enemyX, minion.z - enemyZ);
    if (dist <= detectionRadius && dist < nearestDist) {
      nearestDist = dist;
      nearestMinion = minion;
    }
  }

  return nearestMinion;
}

// ── Player Damage / Respawn ──

function damagePlayer(playerId, amount) {
  const player = _gameState.players[playerId];
  if (!player) return;

  player.hp = Math.max(0, player.hp - amount);

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
      p.lastMoveTime = Date.now();
      p.x = spawn.x;
      p.y = 0.5;
      p.z = spawn.z;
    }, RESPAWN_DELAY_MS);
    _timeouts.push(respawnId);
  }
}

// ── Enemy AI Tick ──

function updateEnemies() {
	if (_gameState.run && (_gameState.run.status === 'victory' || _gameState.run.status === 'failed')) return;

	const dt = 1 / TICK_RATE;
	const players = Object.values(_gameState.players).filter(p => !p.dead);

	for (const enemy of _gameState.enemies) {
		const def = ENEMY_DEFS[enemy.type] || ENEMY_DEFS.grunt;

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
			if (elapsed >= def.attackWindupMs) {
				// Revalidate: find the target player and check range + alive
				const target = _gameState.players[enemy.windupTargetId];
				if (target && !target.dead) {
					const dist = Math.hypot(target.x - enemy.x, target.z - enemy.z);
					if (dist <= ENEMY_ATTACK_RANGE) {
						// Strike!
						damagePlayer(enemy.windupTargetId, def.attackDamage);
						enemy.attackState = 'recovering';
						enemy.recoverUntil = Date.now() + ENEMY_ATTACK_RECOVERY_MS;
						continue;
					}
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
			const spawnInterval = def.spawnIntervalMs || 4000;
			const spawnMaxAlive = def.spawnMaxAlive || 3;
			const spawnType = def.spawnType || 'skirmisher';
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
				tauntMinion.hp -= def.attackDamage;
			} else {
				moveEntityToward(enemy, tauntMinion, def.chaseSpeed * dt);
			}
			continue;
		}

		let nearestDist = Infinity;
		let nearestPlayer = null;
		for (const player of players) {
			const dx = player.x - enemy.x;
			const dz = player.z - enemy.z;
			const dist = Math.hypot(dx, dz);
			if (dist < nearestDist) {
				nearestDist = dist;
				nearestPlayer = player;
			}
		}

		// ── Chasing: move toward player, transition to windup in range ──
		if (nearestPlayer && nearestDist < DETECTION_RADIUS) {
			enemy.state = 'chasing';

			// If in chasing (not mid-windup/recover) and within attack range, start wind-up
			if (enemy.attackState === 'chasing' || enemy.attackState === 'idle') {
				if (nearestDist <= ENEMY_ATTACK_RANGE) {
					enemy.attackState = 'windup';
					enemy.windupTargetId = nearestPlayer.id;
					enemy.windupStartTime = Date.now();
					continue; // do not move during wind-up
				}
				enemy.attackState = 'chasing';
			}

			const chaseResult = moveEntityToward(enemy, nearestPlayer, def.chaseSpeed * dt);
			// If blocked while chasing, enemy stops at wall edge (wall-slide handles sliding)
			void chaseResult;
			continue;
		}

		// ── No player in detection range — revert to idle and wander ──
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
		const wanderResult = moveEntityToward(enemy, enemy.wanderTarget, def.wanderSpeed * dt);

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

      if (minion.type === 'storm_eagle') {
        const attackRange = minion.attackRange || 7;
        const attackDamage = minion.attackDamage || 12;

        if (nearestEnemy && nearestDist < DETECTION_RADIUS) {
          if (nearestDist <= attackRange) {
            nearestEnemy.hp -= attackDamage;
          } else {
            moveEntityToward(minion, nearestEnemy, ENEMY_DEFS.skirmisher.chaseSpeed * dt);
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

      // Chase if an enemy is within detection range
      if (nearestEnemy && nearestDist < DETECTION_RADIUS) {
        // Attack if within attack range
        if (nearestDist <= ATTACK_RANGE) {
          nearestEnemy.lastDamagedBy = minion.ownerId;
          nearestEnemy.hp -= 5;
        } else {
          // Move toward enemy using moveEntityToward (wall-aware)
          moveEntityToward(minion, nearestEnemy, ENEMY_DEFS.grunt.chaseSpeed * dt);
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

  // Cleanup dead enemies after minion attacks
  _progression().cleanupAfterDamage();

  // Decrement TTL and remove expired/dead minions
  for (const minion of _gameState.minions) {
    minion.ttl -= dt;
  }
  _gameState.minions = _gameState.minions.filter(m => m.ttl > 0 && m.hp > 0);
}

// ── Magic Stone Regen ──

function regenMagicStones() {
  for (const p of Object.values(_gameState.players)) {
    if (p.debugScenario === 'summon-low-mana') {
      p.magicStones = 0;
    } else {
      p.magicStones = Math.min(MAX_MAGIC_STONES, p.magicStones + MAGIC_STONES_REGEN_PER_TICK);
    }
    p.pendingSummons.clear();
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
  segmentAABBEntryT,
  segmentIntersectsAABB,
  isEntityPositionBlocked,
  moveEntityToward,
  ENTITY_RADIUS,
  PLAYER_RADIUS,

  // Dungeon position helpers
  computeDungeonBounds,
  firstRoomPosition,
  randomRoomPosition,
  clampToDungeon,
  nearbySpawnPosition,
  randomWanderTarget,

  // Enemy definitions
  ENEMY_DEFS,
  MINION_FOLLOW_DISTANCE,
  MINION_FOLLOW_SPEED,

  // Enemy AI
  updateEnemies,

  // Minion AI
  updateMinions,

  // Player damage / heal
  damagePlayer,
  healPlayer,

  // Card combat helpers
  collectConeHits,
  collectRadialHits,
  collectReturningProjectileHits,
  applyFreezeInRadius,
  pullEnemiesToward,
  spawnDragonsBreathEffect,
  updateAreaEffects,
  isEnemyFrozen,

  // Magic stones
  regenMagicStones,

  // Stale player cleanup
  cleanupStalePlayers
};
