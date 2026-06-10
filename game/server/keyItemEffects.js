// ── Key-Item Dispatch Module ──
// Houses the per-`keyItemId` branches and shared guard checks that previously
// lived inline inside the socket.on('useKeyItem') closure in index.js. This is
// a behavior-preserving extraction: guard order, branch evaluation order, and
// all emitted payload shapes match the original handler exactly.
//
// ── Circular-dependency resolution ──
// Like simulation.js / cardEffects.js, this module must NOT require('./index')
// (circular). Plain helpers come from the leaf modules (config / simulation /
// dungeon / progression) via direct require; the one index.js-local handle the
// handler needs (io) is supplied via setCallbacks() after both modules load.

const { SERVER_TO_CLIENT } = require('../shared/events.js');
const { isPlayingPhase } = require('./lobbies');
const {
  MOVE_SPEED,
  LOOT_PICKUP_RADIUS,
} = require('./config');
const {
  getWallColliders,
  tryPlayerMove,
  clampToDungeon,
  isEntityPositionBlocked,
  isInsideDungeon,
  nearbySpawnPosition,
  isPlayerCardCommitted,
  ENTITY_RADIUS,
  PLAYER_RADIUS,
  healPlayer,
  getEntityWorldY,
  distance3D,
} = require('./simulation');
const {
  sampleFloorY,
  resolveFloorY,
} = require('./dungeon');
const {
  getKeyItemDef,
  addMagicStones,
  recordCrystalCollected,
  checkRunTerminalState,
  savePlayerData,
  stateSnapshot,
} = require('./progression');

// index.js-local handle, injected after both modules are loaded.
let io = null;

function setCallbacks(deps) {
  io = deps.io;
}

// Dispatch a useKeyItem event. Called from socket.on('useKeyItem') inside the
// active lobby context (gameState already pointed at lobby.state by
// withLobbyContext).
function handleUseKeyItem(socket, state, lobby, data) {
    if (!isPlayingPhase(state)) {
      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'not_in_dungeon' });
      return;
    }

    const player = state.players[socket.playerId];
    if (!player) return;
    if (player.dead) {
      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'dead' });
      return;
    }
    if (player.extracted) {
      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'extracted' });
      return;
    }
    if (isPlayerCardCommitted(player)) {
      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'card_commitment' });
      return;
    }

    const keyItemId = data && typeof data.keyItemId === 'string' ? data.keyItemId : null;
    if (!keyItemId) {
      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'missing_key_item_id' });
      return;
    }

    const def = getKeyItemDef(keyItemId);
    if (!def) {
      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'unknown_item' });
      return;
    }

    // Cooldown check
    const now = Date.now();
    const cooldownUntil = player.keyItemCooldownUntil || 0;
    if (now < cooldownUntil) {
      const remainingMs = cooldownUntil - now;
      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'on_cooldown', remainingMs });
      return;
    }

    // Only dodge_roll, summon_recall, field_medic_kit, guard_block, flare_beacon, loot_magnet, overclock, phase_step, barrier_dome, purge_charm, echo_strike, rally_cry, smoke_bomb, and ground_anchor are implemented; all other key items return not_implemented.
    if (keyItemId !== 'dodge_roll' && keyItemId !== 'summon_recall' && keyItemId !== 'field_medic_kit' && keyItemId !== 'guard_block' && keyItemId !== 'flare_beacon' && keyItemId !== 'loot_magnet' && keyItemId !== 'overclock' && keyItemId !== 'phase_step' && keyItemId !== 'barrier_dome' && keyItemId !== 'purge_charm' && keyItemId !== 'echo_strike' && keyItemId !== 'rally_cry' && keyItemId !== 'smoke_bomb' && keyItemId !== 'ground_anchor') {
      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'not_implemented' });
      return;
    }

    if (keyItemId === 'field_medic_kit') {
      // --- field_medic_kit: AoE HP heal for nearby living players ---
      const healRadius = def.healRadius != null ? def.healRadius : 5;
      const hpRestore = def.hpRestore != null ? def.hpRestore : 8;
      const casterX = player.x;
      const casterY = getEntityWorldY(player);
      const casterZ = player.z;
      let alliesHealed = 0;

      for (const p of Object.values(state.players)) {
        if (!p || p.dead || p.extracted) continue;
        const dist = Math.hypot(p.x - casterX, getEntityWorldY(p) - casterY, p.z - casterZ);
        if (dist <= healRadius) {
          healPlayer(p.id, hpRestore);
          alliesHealed++;
        }
      }

      player.keyItemCooldownUntil = now + (def.cooldownMs || 7000);
      player.persistenceDirty = true;

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, cooldownUntil: player.keyItemCooldownUntil, alliesRestored: alliesHealed });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.KEY_ITEM_HEAL_PULSE, {
        playerId: socket.playerId,
        x: casterX,
        z: casterZ,
        healRadius,
      });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'guard_block') {
      // --- guard_block: set a blocking window + slow movement to 20% ---
      const durationMs = def.durationMs != null ? def.durationMs : 700;
      player.blockingUntil = now + durationMs;
      player.blockingYaw = player.rotation || 0;
      player.keyItemCooldownUntil = now + (def.cooldownMs || 3500);
      player.persistenceDirty = true;

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, blockingUntil: player.blockingUntil, cooldownUntil: player.keyItemCooldownUntil });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'barrier_dome') {
      // --- barrier_dome: project a short-lived protective dome at the caster's
      // position. Projectile blocking itself is handled in sub-ticket 02; here
      // we only set the transient dome state, burn cooldown, and broadcast. ---
      const durationMs = def.durationMs != null ? def.durationMs : 1000;
      const radius = def.radius != null ? def.radius : 3;
      player.barrierDomeUntil = now + durationMs;
      player.barrierDomeRadius = radius;
      player.barrierDomeX = player.x;
      player.barrierDomeZ = player.z;
      player.keyItemCooldownUntil = now + (def.cooldownMs || 14000);
      player.persistenceDirty = true;

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, barrierDomeUntil: player.barrierDomeUntil, cooldownUntil: player.keyItemCooldownUntil });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'smoke_bomb') {
      // --- smoke_bomb: drop a short-lived smoke zone fixed at the caster's
      // position. While any living player stands inside an active smoke zone,
      // enemies cannot target them (see isPlayerConcealed in simulation.js).
      // The zone stays at the cast point — the player may walk out of it. ---
      const durationMs = def.durationMs != null ? def.durationMs : 2000;
      const radius = def.radius != null ? def.radius : 4;
      player.smokeBombUntil = now + durationMs;
      player.smokeBombRadius = radius;
      player.smokeBombX = player.x;
      player.smokeBombY = getEntityWorldY(player);
      player.smokeBombZ = player.z;
      player.keyItemCooldownUntil = now + (def.cooldownMs || 8000);
      player.persistenceDirty = true;

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, smokeBombUntil: player.smokeBombUntil, cooldownUntil: player.keyItemCooldownUntil });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'purge_charm') {
      // --- purge_charm: remove the single OLDEST active debuff from the caster.
      // Debuffs are stored oldest-first, so shift() drops the oldest and leaves
      // any remaining debuffs intact. When the caster has NO active debuffs, the
      // charm instead grants a one-hit shield (shieldHitsRemaining: 1) that fully
      // absorbs the next incoming damage instance (see damagePlayer). ---
      if (!Array.isArray(player.debuffs)) player.debuffs = [];
      player.keyItemCooldownUntil = now + (def.cooldownMs || 7000);
      player.persistenceDirty = true;

      if (player.debuffs.length > 0) {
        const removed = player.debuffs.shift();
        const cleared = removed && removed.type != null ? removed.type : null;
        socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, cleared, cooldownUntil: player.keyItemCooldownUntil });
      } else {
        // No debuffs to clear — fall back to a one-hit absorb shield.
        player.shieldHitsRemaining = 1;
        socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, shielded: true, cooldownUntil: player.keyItemCooldownUntil });
      }
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'echo_strike') {
      // --- echo_strike: arm a pending echo so the caster's next weapon hit
      // strikes a second time for `echoFraction` of the damage. The actual
      // second-hit damage is applied in sub-ticket 02; here we only set the
      // transient pending flag, burn cooldown, and broadcast. ---
      player.echoStrikePending = true;
      player.keyItemCooldownUntil = now + (def.cooldownMs || 10000);
      player.persistenceDirty = true;

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, echoStrikePending: true, cooldownUntil: player.keyItemCooldownUntil });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'rally_cry') {
      // --- rally_cry: grant a short party-wide move-speed buff to the caster and
      // every living, non-extracted ally in the same run within `radius`. The buff
      // is assigned (not multiplied) so re-using it never compounds — the effective
      // multiplier stays at ~1.1. No heal effect. ---
      const radius = def.radius != null ? def.radius : 8;
      const durationMs = def.durationMs != null ? def.durationMs : 4000;
      const multiplier = def.speedMultiplier != null ? def.speedMultiplier : 1.1;
      const rallyUntil = now + durationMs;
      const casterY = getEntityWorldY(player);
      let affected = 0;

      for (const p of Object.values(state.players)) {
        if (!p || p.dead || p.extracted) continue;
        if (distance3D(player.x, casterY, player.z, p) > radius) continue;
        p.rallyUntil = rallyUntil;
        p.rallySpeedMultiplier = multiplier;
        p.persistenceDirty = true;
        affected++;
      }

      player.keyItemCooldownUntil = now + (def.cooldownMs || 10000);
      player.persistenceDirty = true;

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, rallyUntil, cooldownUntil: player.keyItemCooldownUntil, affected });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'ground_anchor') {
      // --- ground_anchor: become immune to knockback/displacement for a short
      // window while moving at reduced speed. The immunity is enforced in
      // applyPlayerKnockback (simulation.js) and the slow in the movement step;
      // here we only set the transient anchor state, burn cooldown, and broadcast. ---
      const durationMs = def.durationMs != null ? def.durationMs : 1500;
      const cooldownMs = def.cooldownMs != null ? def.cooldownMs : 6000;
      player.anchorUntil = now + durationMs;
      player.anchorSpeedMultiplier = def.speedMultiplier != null ? def.speedMultiplier : 0.7;
      player.keyItemCooldownUntil = now + cooldownMs;
      player.persistenceDirty = true;

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, anchorUntil: player.anchorUntil, cooldownUntil: player.keyItemCooldownUntil });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'flare_beacon') {
      // --- flare_beacon: reveal all living enemies within revealRadius ---
      const revealRadius = def.revealRadius != null ? def.revealRadius : 25;
      const revealDurationMs = def.revealDurationMs != null ? def.revealDurationMs : 3000;
      const revealUntil = now + revealDurationMs;
      const casterY = getEntityWorldY(player);
      let revealed = 0;

      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        if (distance3D(player.x, casterY, player.z, enemy) > revealRadius) continue;
        enemy.revealedUntil = revealUntil;
        revealed++;
      }

      player.keyItemCooldownUntil = now + (def.cooldownMs || 10000);
      player.persistenceDirty = true;

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, revealed, cooldownUntil: player.keyItemCooldownUntil });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'loot_magnet') {
      // --- loot_magnet: pull all uncollected ground loot within attractRadius toward player ---
      const attractRadius = def.attractRadius != null ? def.attractRadius : 8;
      const colliders = getWallColliders();
      let pulled = 0;
      let collected = 0;

      // Iterate backwards so splicing collected loot doesn't mess up indices
      for (let i = state.loot.length - 1; i >= 0; i--) {
        const loot = state.loot[i];
        const dist = Math.hypot(loot.x - player.x, loot.z - player.z);
        if (dist > attractRadius) continue;

        // Compute direction toward player
        let dirX = player.x - loot.x;
        let dirZ = player.z - loot.z;
        const mag = Math.hypot(dirX, dirZ);
        if (mag < 1e-8) {
          // Loot is exactly on player — auto-collect
          dirX = 0;
          dirZ = 0;
        } else {
          dirX /= mag;
          dirZ /= mag;
        }

        // Use tryPlayerMove for wall-aware displacement
        const result = tryPlayerMove(loot.x, loot.z, dirX, dirZ, dist, colliders);
        loot.x = result.x;
        loot.z = result.z;
        pulled++;

        // Check if loot is now within pickup radius — auto-collect
        const finalDist = Math.hypot(loot.x - player.x, loot.z - player.z);
        if (finalDist <= LOOT_PICKUP_RADIUS) {
          const isCrystal = loot.kind === 'crystal';
          const isMagicStone = loot.kind === 'magic_stone';
          if (isMagicStone) {
            addMagicStones(player, loot.value);
          } else if (isCrystal) {
            recordCrystalCollected(1);
          } else {
            player.currency += loot.value;
            player.currencyEarnedThisRun += loot.value;
          }
          state.loot.splice(i, 1);
          collected++;

          if (isCrystal) {
            checkRunTerminalState();
          }
        }
      }

      player.keyItemCooldownUntil = now + (def.cooldownMs || 8000);
      player.persistenceDirty = true;
      savePlayerData(socket.playerId);

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, pulled, collected, cooldownUntil: player.keyItemCooldownUntil });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'summon_recall') {
      // --- summon_recall: teleport all owned minions to ring positions around player ---
      const myMinions = state.minions.filter(m => m.ownerId === socket.playerId);
      if (myMinions.length === 0) {
        socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'no_minions' });
        return; // No cooldown burn on soft-fail
      }

      const ringRadiusMin = def.ringRadiusMin != null ? def.ringRadiusMin : 2;
      const ringRadiusMax = def.ringRadiusMax != null ? def.ringRadiusMax : 2;
      // Minimum separation between caster and a repositioned minion. Clamping a
      // wall-hugged ring point can pull it inward, so candidate acceptance must
      // explicitly enforce this floor, not just wall/dungeon checks.
      const minDist = 1;
      const isFarEnough = (x, z) => Math.hypot(x - player.x, z - player.z) >= minDist;

      for (let i = 0; i < myMinions.length; i++) {
        const minion = myMinions[i];
        const angle = (2 * Math.PI * i) / myMinions.length;
        // Vary each minion's radius across the [min, max] band so the ring has a
        // ~1.5–2.5m spread rather than every minion sitting at a single midpoint.
        // Deterministic interpolation: spread slots evenly across the band; a lone
        // minion lands at the band midpoint.
        const t = myMinions.length > 1 ? i / (myMinions.length - 1) : 0.5;
        const ringRadius = ringRadiusMin + (ringRadiusMax - ringRadiusMin) * t;
        let targetX = player.x + Math.cos(angle) * ringRadius;
        let targetZ = player.z + Math.sin(angle) * ringRadius;

        // Clamp to dungeon bounds
        const clamped = clampToDungeon(targetX, targetZ);
        targetX = clamped.x;
        targetZ = clamped.z;

        // Check wall collision and the separation floor; if blocked or pulled too
        // close to the caster, find a nearby valid position.
        if (isEntityPositionBlocked(targetX, targetZ, ENTITY_RADIUS) || !isInsideDungeon(targetX, targetZ) || !isFarEnough(targetX, targetZ)) {
          const nearby = nearbySpawnPosition(player.x + Math.cos(angle) * ringRadius, player.z + Math.sin(angle) * ringRadius, 3);
          // Only accept the nearby point if it also clears the separation floor;
          // otherwise leave it to the spiral search to find a farther spot.
          if (nearby && isFarEnough(nearby.x, nearby.z)) {
            targetX = nearby.x;
            targetZ = nearby.z;
          }
        }

        // Final safety check: if still blocked or too close, spiral outward to
        // find a valid spot. Start at the minimum distance and keep probing
        // outward so a clamped-inward candidate is rejected, not committed.
        if (isEntityPositionBlocked(targetX, targetZ, ENTITY_RADIUS) || !isInsideDungeon(targetX, targetZ) || !isFarEnough(targetX, targetZ)) {
          let found = false;
          for (let r = minDist; r <= 6 && !found; r += 0.5) {
            // Try the primary angle, then offsets if blocked
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
              const tryAngle = angle + a;
              const sx = player.x + Math.cos(tryAngle) * r;
              const sz = player.z + Math.sin(tryAngle) * r;
              const sc = clampToDungeon(sx, sz);
              if (!isEntityPositionBlocked(sc.x, sc.z, ENTITY_RADIUS) && isInsideDungeon(sc.x, sc.z) && isFarEnough(sc.x, sc.z)) {
                targetX = sc.x;
                targetZ = sc.z;
                found = true;
                break;
              }
            }
          }
        }

        minion.x = targetX;
        minion.z = targetZ;

        // Update Y to match floor
        if (state.layout) {
          minion.y = resolveFloorY(sampleFloorY(state.layout, minion.x, minion.z));
        }
      }

      player.keyItemCooldownUntil = now + (def.cooldownMs || 10000);
      player.persistenceDirty = true;

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, cooldownUntil: player.keyItemCooldownUntil, recalled: myMinions.length });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'overclock') {
      // --- overclock: grant charges to bypass slot cooldown on next card plays ---
      const charges = def.charges != null ? def.charges : 2;
      player.overclockChargesRemaining = charges;
      player.keyItemCooldownUntil = now + (def.cooldownMs || 13000);
      player.persistenceDirty = true;

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, charges: player.overclockChargesRemaining, cooldownUntil: player.keyItemCooldownUntil });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    if (keyItemId === 'phase_step') {
      // --- phase_step: swap positions with a targeted (or nearest) living ally ---
      const range = def.range != null ? def.range : 6;
      const targetPlayerId = data && typeof data.targetPlayerId === 'string' ? data.targetPlayerId : null;

      // Candidate allies: other living, non-extracted players in the same run.
      const candidates = Object.values(state.players).filter(
        (p) => p && p !== player && !p.dead && !p.extracted
      );

      let ally = null;
      if (targetPlayerId) {
        ally = candidates.find((p) => p.id === targetPlayerId) || null;
      } else {
        // Pick the nearest candidate by horizontal distance.
        let bestDist = Infinity;
        for (const p of candidates) {
          const d = Math.hypot(p.x - player.x, p.z - player.z);
          if (d < bestDist) {
            bestDist = d;
            ally = p;
          }
        }
      }

      if (!ally) {
        socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'no_ally' });
        return; // No cooldown burn on soft-fail
      }

      const dist = Math.hypot(ally.x - player.x, ally.z - player.z);
      if (dist > range) {
        socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'out_of_range' });
        return; // No cooldown burn on soft-fail
      }

      // Both endpoints must be inside the dungeon AND clear of wall colliders
      // before we trade positions. isInsideDungeon only validates the walkable
      // room/passage AABBs, so a point can be "inside" yet still overlap a wall.
      if (
        !isInsideDungeon(player.x, player.z) || !isInsideDungeon(ally.x, ally.z) ||
        isEntityPositionBlocked(player.x, player.z, PLAYER_RADIUS) ||
        isEntityPositionBlocked(ally.x, ally.z, PLAYER_RADIUS)
      ) {
        socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'invalid_position' });
        return; // No cooldown burn on soft-fail
      }

      // Swap x, y, z between the caster and the ally.
      const swapX = player.x;
      const swapY = player.y;
      const swapZ = player.z;
      player.x = ally.x;
      player.y = ally.y;
      player.z = ally.z;
      ally.x = swapX;
      ally.y = swapY;
      ally.z = swapZ;

      player.persistenceDirty = true;
      ally.persistenceDirty = true;
      player.keyItemCooldownUntil = now + (def.cooldownMs || 12000);

      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, {
        ok: true,
        keyItemId,
        targetPlayerId: ally.id,
        x: player.x,
        y: player.y,
        z: player.z,
        cooldownUntil: player.keyItemCooldownUntil,
      });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      return;
    }

    // --- dodge_roll: dash movement with wall collision ---
    // Resolve direction from player input or fall back to facing yaw
    let dx = player.inputDx || 0;
    let dz = player.inputDz || 0;
    const mag = Math.hypot(dx, dz);
    if (mag < 1e-8) {
      // rotation = atan2(z, x), so facing direction is (cos, sin) — see angleFromPlayerTo
      const yaw = player.rotation || 0;
      dx = Math.cos(yaw);
      dz = Math.sin(yaw);
    } else {
      dx /= mag;
      dz /= mag;
    }

    // Dash distance: MOVE_SPEED * 3 * (rollDistanceMs / 1000)
    const dashDistance = MOVE_SPEED * 3 * ((def.rollDistanceMs || 200) / 1000);
    const colliders = getWallColliders();
    const result = tryPlayerMove(player.x, player.z, dx, dz, dashDistance, colliders);

    // Only update position if we actually moved (handles fully enclosed edge case)
    if (result.moved) {
      player.x = result.x;
      player.z = result.z;

      // Follow floor slope after displacement
      if (state.layout) {
        player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      }
    }

    // Set invulnerability and cooldown
    player.invulnerableUntil = now + (def.invincibleDurationMs || 300);
    player.keyItemCooldownUntil = now + (def.cooldownMs || 800);
    player.persistenceDirty = true;

    socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: true, keyItemId, cooldownUntil: player.keyItemCooldownUntil, invulnerableUntil: player.invulnerableUntil, x: player.x, y: player.y, z: player.z });
    io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
}

module.exports = {
  setCallbacks,
  handleUseKeyItem,
};
