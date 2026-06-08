// ── Card-Use Dispatch Module ──
// Houses the weapon / spell / creature / enchantment branches and the
// per-`effect` handling that previously lived inline inside the
// socket.on('useCard') closure in index.js. This is a behavior-preserving
// extraction: branch evaluation order and all emitted payload shapes match
// the original handler exactly.
//
// ── Circular-dependency resolution ──
// Like simulation.js, this module must NOT require('./index') (circular).
// Plain helpers come from the leaf modules (simulation/progression/config) via
// direct require; the handful of index.js-local helpers (io, emitCardError,
// findSacrificeTarget, resolveAttackRotation) are supplied via setCallbacks()
// after both modules are loaded.

const { SERVER_TO_CLIENT } = require('../shared/events.js');
const crypto = require('crypto');
const { isPlayingPhase } = require('./lobbies');
const { THEME } = require('./theme');
const {
  TICK_RATE,
  SUMMON_RADIUS,
  ATTACK_RANGE,
  ATTACK_CONE_ANGLE,
  PROJECTILE_HIT_WIDTH,
  COOLDOWN_MS,
  MAX_GROUND_ENCHANTMENTS_PER_PLAYER,
} = require('./config');
const {
  collectConeHits,
  collectRadialHits,
  collectProjectileHits,
  collectChainLightningHits,
  collectReturningProjectileHits,
  applyBurning,
  applySlow,
  applyFreezeInRadius,
  pullEnemiesToward,
  applyKnockback,
  applyEventHorizon,
  spawnDragonsBreathEffect,
  spawnFireTrailEffect,
  spawnInfernoPillarEffect,
  damagePlayer,
  healPlayer,
  healPlayersInRadius,
  spawnGroundEnchantment,
  armSelfEnchantment,
  countGroundEnchantmentsForPlayer,
} = require('./simulation');
const {
  getCardDef,
  getKeyItemDef,
  validateUseCardHand,
  replaceConsumedCard,
  exhaustHandSlot,
  drawCardIntoHand,
  ensurePassiveDrawScheduled,
  canDrawIntoHand,
  scaledGrindStat,
  addMagicStones,
  restoreHandCharges,
  pickRandomExhaustedCard,
  createEchoCard,
  releaseBurningCreatureCard,
  beginCreatureBurnDown,
  applyWyrmMinionBreathStats,
  stateSnapshot,
  cleanupAfterDamage,
  emitPlayerDeckUpdate,
} = require('./progression');

// Delay before an armed Echo Strike's second packet lands (a few ticks later).
const ECHO_STRIKE_DELAY_MS = 150;

// index.js-local helpers, injected after both modules are loaded.
let io = null;
let emitCardError = null;
let findSacrificeTarget = null;
let resolveAttackRotation = null;

function setCallbacks(deps) {
  io = deps.io;
  emitCardError = deps.emitCardError;
  findSacrificeTarget = deps.findSacrificeTarget;
  resolveAttackRotation = deps.resolveAttackRotation;
}

// Helper: apply slot cooldown, consuming an overclock charge when available.
function applySlotCooldown(player, slotIndex, hasOverclock, now, cooldownMs) {
  if (hasOverclock) {
    player.overclockChargesRemaining -= 1;
  } else {
    player.slotCooldowns[slotIndex] = now + cooldownMs;
  }
}

function applyAstralShieldCast(ctx) {
  const {
    socket, state, lobby, data, cardDef, handCard, player,
    originX, originZ, now, hasOverclock,
  } = ctx;

  const grind = handCard.grind || 0;
  const summonDamage = handCard.echoDamage != null
    ? handCard.echoDamage
    : scaledGrindStat(cardDef.damage || 0, grind);
  const radial = collectRadialHits(originX, originZ, SUMMON_RADIUS, summonDamage, {
    magicStoneOnHit: cardDef.magicStoneOnHit,
    magicStoneOnKill: cardDef.magicStoneOnKill,
    attackerId: socket.playerId,
  });
  const hits = radial.hits;
  const appliedMagicStones = addMagicStones(player, radial.magicStonesGained);

  const shieldHp = cardDef.shieldHp || 15;
  const shieldDurationMs = cardDef.shieldDurationMs || 8000;
  player.shieldHp = shieldHp;
  player.shieldExpiresAt = now + shieldDurationMs;

  const minionHp = scaledGrindStat(cardDef.minionHp || 60, grind);
  const minionTtl = scaledGrindStat(cardDef.minionTtl || 30, grind);
  const minion = {
    id: crypto.randomUUID(),
    ownerId: socket.playerId,
    type: data.cardId,
    x: originX,
    z: originZ,
    hp: minionHp,
    maxHp: minionHp,
    specialEffect: cardDef.specialEffect,
    ttl: minionTtl,
    maxTtl: minionTtl,
    createdAt: now,
    attackDamage: cardDef.attackDamage != null ? cardDef.attackDamage : 10,
    attackIntervalMs: cardDef.attackIntervalMs || Math.floor(1000 / TICK_RATE),
    lastAttackAt: 0,
  };
  if (cardDef.taunt) {
    minion.taunt = true;
  }
  state.minions.push(minion);

  cleanupAfterDamage();

  applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
  replaceConsumedCard(player, data.slotIndex, handCard);

  io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
  io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
    playerId: socket.playerId,
    cardId: data.cardId,
    slotIndex: data.slotIndex,
    specialEffect: cardDef.specialEffect,
    origin: { x: originX, z: originZ },
    radius: SUMMON_RADIUS,
    hits,
    magicStonesGained: appliedMagicStones,
    shieldGranted: shieldHp,
    minionId: minion.id,
  });
}

// Dispatch a useCard event. Called from socket.on('useCard') inside the active
// lobby context (gameState already pointed at lobby.state by withLobbyContext).
function handleUseCard(socket, state, lobby, data) {
    if (!isPlayingPhase(state)) return;
    if (!state.run || state.run.status !== 'playing') return;

    if (!data || typeof data.slotIndex !== 'number' || !data.cardId) return;

    // (1) Look up card definition
    const cardDef = getCardDef(data.cardId);
    if (!cardDef) {
      socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Unknown card' });
      return;
    }

    // (2) Get player
    const player = state.players[socket.playerId];
    if (!player || player.dead || player.extracted) return;

    // (3) Authoritative hand validation: slot must hold the requested card
    const handValidation = validateUseCardHand(player, data.slotIndex, data.cardId);
    if (!handValidation.valid) {
      socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: handValidation.reason });
      return;
    }

    // (4) Cooldown check: reject if slot is still cooling down (bypassed by overclock charges)
    const now = Date.now();
    const hasOverclock = (player.overclockChargesRemaining || 0) > 0;
    if (!hasOverclock && player.slotCooldowns && player.slotCooldowns[data.slotIndex] && now < player.slotCooldowns[data.slotIndex]) {
      socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Slot on cooldown' });
      return;
    }

    const handCard = handValidation.handCard;
    const originX = player.x;
    const originZ = player.z;

    // ── Weapon branch (forward cone attack) ──
    if (cardDef.type === 'weapon') {
      if (cardDef.effect === 'draw_card') {
        if (!canDrawIntoHand(player)) {
          socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Hand full' });
          return;
        }

        handCard.remainingCharges -= 1;
        drawCardIntoHand(player);
        ensurePassiveDrawScheduled(player);

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);

        if (handCard.remainingCharges <= 0) {
          exhaustHandSlot(player, data.slotIndex, handCard);
        }

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          effect: 'draw_card',
        });
        return;
      }

      handCard.remainingCharges -= 1;

      const rotation = resolveAttackRotation(player, data);
      player.rotation = rotation;
      const attackRange = cardDef.attackRange || ATTACK_RANGE;
      const attackConeAngle = cardDef.attackConeAngle || ATTACK_CONE_ANGLE;
      const grind = handCard.grind || 0;
      const damage = handCard.echoDamage != null
        ? handCard.echoDamage
        : scaledGrindStat(cardDef.damage || 0, grind);
      const dirX = Math.cos(rotation);
      const dirZ = Math.sin(rotation);
      const cooldownMs = cardDef.cooldownMs || COOLDOWN_MS;

      const swingsPerUse = cardDef.swingsPerUse || 1;
      let hits = [];
      let magicStonesGained = 0;

      for (let swing = 0; swing < swingsPerUse; swing++) {
        let swingResult;
        if (cardDef.effect === 'throw_rock' || cardDef.effect === 'projectile' || cardDef.effect === 'fireball') {
          swingResult = collectProjectileHits(originX, originZ, dirX, dirZ, attackRange, damage, {
            magicStoneOnHit: cardDef.magicStoneOnHit,
            magicStoneOnKill: cardDef.magicStoneOnKill,
            attackerId: socket.playerId,
            pierces: cardDef.projectile?.pierces === true,
          });
        } else if (cardDef.effect === 'returning_projectile' || cardDef.effect === 'triple_returning_projectile') {
          const returnPasses = cardDef.returnPasses
            || (cardDef.effect === 'triple_returning_projectile' ? 3 : 1);
          swingResult = collectReturningProjectileHits(originX, originZ, dirX, dirZ, attackRange, damage, {
            returnPasses,
            magicStoneOnHit: cardDef.magicStoneOnHit,
            magicStoneOnKill: cardDef.magicStoneOnKill,
            attackerId: socket.playerId,
          });
        } else {
          swingResult = collectConeHits(originX, originZ, dirX, dirZ, attackRange, attackConeAngle, damage, {
            magicStoneOnHit: cardDef.magicStoneOnHit,
            magicStoneOnKill: cardDef.magicStoneOnKill,
            attackerId: socket.playerId,
          });
        }
        for (const hit of swingResult.hits) {
          hits.push({ ...hit, swing: swing + 1 });
        }
        magicStonesGained += swingResult.magicStonesGained;
      }

      // Fireball: every enemy struck by the projectile catches fire (BURNING).
      // Resolve each hit's enemyId back to its live entity in game state and
      // ignite it for the card's configured burning duration.
      if (cardDef.effect === 'fireball') {
        const burnDurationMs = cardDef.burningDurationMs || 0;
        if (burnDurationMs > 0) {
          const ignited = new Set();
          for (const hit of hits) {
            if (!hit.enemyId || ignited.has(hit.enemyId)) continue;
            const enemy = state.enemies.find(e => e.id === hit.enemyId);
            if (enemy) {
              applyBurning(enemy, burnDurationMs);
              ignited.add(hit.enemyId);
            }
          }
        }
      }

      let knockbackMoved = [];
      if (cardDef.specialEffect === 'knockback' || data.cardId === 'steel_claymore') {
        knockbackMoved = applyKnockback(
          originX,
          originZ,
          dirX,
          dirZ,
          hits,
          cardDef.knockbackStrength || 3
        );
      }

      let shockwaveHits = [];
      if (cardDef.shockwaveEvery) {
        if (!player.weaponComboCounts) player.weaponComboCounts = {};
        const comboKey = data.cardId;
        const nextCount = (player.weaponComboCounts[comboKey] || 0) + 1;
        player.weaponComboCounts[comboKey] = nextCount;
        if (nextCount % cardDef.shockwaveEvery === 0) {
          const shockwave = collectRadialHits(
            originX,
            originZ,
            cardDef.shockwaveRadius || SUMMON_RADIUS,
            cardDef.shockwaveDamage || damage,
            { attackerId: socket.playerId }
          );
          shockwaveHits = shockwave.hits;
        }
      }

      if (cardDef.specialEffect === 'fire_trail') {
        spawnFireTrailEffect(originX, originZ, dirX, dirZ, cardDef, socket.playerId);
      }

      if (cardDef.selfDamage) {
        damagePlayer(socket.playerId, cardDef.selfDamage);
      }

      // ── Echo Strike: arm a delayed 50% second packet on this one weapon use ──
      // The primary damage above lands immediately; if echoStrikePending is armed
      // we enqueue a second packet against the same struck enemies, applied a few
      // ticks later by simulation.processPendingEchoes(). The flag is consumed by
      // any weapon use (spell/creature branches never reach here), regardless of
      // whether an enemy was actually hit.
      if (player.echoStrikePending) {
        const echoDef = getKeyItemDef('echo_strike');
        const echoFraction = echoDef && echoDef.echoFraction != null ? echoDef.echoFraction : 0.5;
        const echoDamage = Math.max(1, Math.round(damage * echoFraction));
        const struckEnemyIds = [...new Set(hits.map(h => h.enemyId).filter(Boolean))];
        if (struckEnemyIds.length > 0) {
          if (!state.pendingEchoes) state.pendingEchoes = [];
          state.pendingEchoes.push({
            attackerId: socket.playerId,
            targets: struckEnemyIds.map(enemyId => ({ enemyId, damage: echoDamage })),
            applyAt: now + ECHO_STRIKE_DELAY_MS,
          });
        }
        player.echoStrikePending = false;
      }

      const appliedMagicStones = addMagicStones(player, magicStonesGained);
      cleanupAfterDamage();

      applySlotCooldown(player, data.slotIndex, hasOverclock, now, cooldownMs);

      if (handCard.remainingCharges <= 0) {
        replaceConsumedCard(player, data.slotIndex, handCard);
      }

      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
      io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
        playerId: socket.playerId,
        cardId: data.cardId,
        specialEffect: cardDef.specialEffect,
        effect: cardDef.effect,
        origin: { x: originX, z: originZ },
        direction: { x: dirX, z: dirZ },
        attackRange,
        attackConeAngle,
        projectileHitWidth: PROJECTILE_HIT_WIDTH,
        returnPasses: cardDef.returnPasses
          || (cardDef.effect === 'triple_returning_projectile' ? 3 : undefined),
        hits,
        shockwaveHits,
        knockbackMoved,
        magicStonesGained: appliedMagicStones,
        swingCount: swingsPerUse,
        comboCount: player.weaponComboCounts ? player.weaponComboCounts[data.cardId] : undefined,
        ...(cardDef.specialEffect === 'fire_trail' ? {
          dotTicks: cardDef.dotTicks || 4,
          dotIntervalMs: cardDef.dotIntervalMs || 500,
        } : {}),
      });

      return;
    }

    // ── Summon branch (radial AoE) ──
    if (cardDef.type === 'spell') {
      const summonKey = `${data.slotIndex}:${data.cardId}`;

      // Guard: reject duplicate activation while previous summon is still resolving
      if (player.pendingSummons.has(summonKey)) {
        socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Summon already resolving' });
        return;
      }

      const magicStoneCost = cardDef.magicStoneCost || 0;

      // Validate Magic Stones
      if (player.magicStones < magicStoneCost) {
        socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: THEME.resource.insufficient });
        return;
      }

      if (cardDef.effect === 'telepipe') {
        if (state.telepipe) {
          emitCardError(socket, 'Telepipe already active');
          return;
        }

        state.telepipe = {
          x: originX,
          z: originZ,
          placedBy: socket.playerId,
          placedAt: now,
        };
        console.log(`[telepipe] placed at (${originX.toFixed(1)}, ${originZ.toFixed(1)}) by ${socket.playerId}`);

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: 'portal',
          effect: 'telepipe',
          origin: { x: originX, z: originZ },
        });

        return;
      }

      if (cardDef.effect === 'memory_shard') {
        player.pendingSummons.add(summonKey);
        player.magicStones -= magicStoneCost;
        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);

        const exhausted = pickRandomExhaustedCard(player);
        const echo = exhausted ? createEchoCard(exhausted) : null;
        if (echo) {
          player.hand[data.slotIndex] = echo;
          emitPlayerDeckUpdate(socket.playerId);
        } else {
          const fallbackDamage = cardDef.fallbackDamage || 3;
          const radial = collectRadialHits(
            originX,
            originZ,
            SUMMON_RADIUS,
            fallbackDamage,
            { attackerId: socket.playerId }
          );
          cleanupAfterDamage();
          replaceConsumedCard(player, data.slotIndex, handCard);
          io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
          io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
            playerId: socket.playerId,
            cardId: data.cardId,
            slotIndex: data.slotIndex,
            specialEffect: 'memory_shard_fizzle',
            origin: { x: originX, z: originZ },
            radius: SUMMON_RADIUS,
            hits: radial.hits,
          });
          return;
        }

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: 'memory_shard',
          origin: { x: originX, z: originZ },
          echoCardId: echo.id,
        });
        return;
      }

      if (cardDef.effect === 'sacrificial_altar') {
        const sacrificeRadius = cardDef.sacrificeRadius || SUMMON_RADIUS;
        const target = findSacrificeTarget(socket.playerId, originX, originZ, sacrificeRadius);
        if (!target) {
          socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'No friendly summon to sacrifice' });
          return;
        }

        player.pendingSummons.add(summonKey);
        player.magicStones -= magicStoneCost;
        releaseBurningCreatureCard(player, target.minion);
        state.minions.splice(target.index, 1);
        const magicStonesGained = addMagicStones(player, cardDef.magicStoneGain || 0);
        const restoredCharges = restoreHandCharges(player, cardDef.chargeRestore || 0, {
          types: ['weapon'],
          maxTargets: 1,
          selection: 'random',
        });

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          origin: { x: originX, z: originZ },
          radius: sacrificeRadius,
          sacrificedMinionId: target.minion.id,
          magicStonesGained,
          restoredCharges,
        });

        return;
      }

      // Mark as pending before any side effects
      player.pendingSummons.add(summonKey);

      // Deduct cost
      player.magicStones -= magicStoneCost;

      if (cardDef.effect === 'chrono_trigger') {
        const restoredCharges = restoreHandCharges(player, cardDef.adjacentChargeRestore || 0, {
          slots: [data.slotIndex - 1, data.slotIndex + 1],
        });

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          origin: { x: originX, z: originZ },
          restoredCharges,
        });

        return;
      }

      if (cardDef.effect === 'frost_nova' || cardDef.effect === 'glacier_collapse') {
        const radius = cardDef.radius || SUMMON_RADIUS;
        const hits = applyFreezeInRadius(
          originX,
          originZ,
          radius,
          cardDef.freezeDurationMs || 2500,
          cardDef.damage || 0,
          cardDef.frozenBonusDamage || 0
        );
        cleanupAfterDamage();

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: cardDef.specialEffect,
          origin: { x: originX, z: originZ },
          radius,
          hits,
          frozen: true,
        });

        return;
      }

      if (cardDef.effect === 'healing_font') {
        const hpGained = healPlayer(socket.playerId, cardDef.healAmount || 0);

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: cardDef.specialEffect,
          origin: { x: originX, z: originZ },
          radius: SUMMON_RADIUS,
          hpGained,
        });

        return;
      }

      if (cardDef.effect === 'divine_grace') {
        const hpGained = healPlayer(socket.playerId, cardDef.healAmount || 0);

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: cardDef.specialEffect,
          origin: { x: originX, z: originZ },
          radius: SUMMON_RADIUS,
          hpGained,
        });

        return;
      }

      if (cardDef.effect === 'purifying_pulse') {
        const radius = cardDef.radius || SUMMON_RADIUS;
        const healedTargets = healPlayersInRadius(
          originX,
          originZ,
          radius,
          cardDef.healAmount || 0
        );

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: 'heal_and_cleanse',
          origin: { x: originX, z: originZ },
          radius,
          healedTargets,
        });

        return;
      }

      if (cardDef.effect === 'gravity_well') {
        const radius = cardDef.pullRadius || SUMMON_RADIUS;
        const pulled = pullEnemiesToward(originX, originZ, radius, cardDef.pullStrength || 4);

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: cardDef.specialEffect,
          origin: { x: originX, z: originZ },
          radius,
          pulled,
        });

        return;
      }

      if (cardDef.effect === 'event_horizon') {
        const radius = cardDef.pullRadius || SUMMON_RADIUS;
        const { pulled, crushed } = applyEventHorizon(
          originX,
          originZ,
          cardDef,
          socket.playerId
        );
        cleanupAfterDamage();

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: cardDef.specialEffect,
          origin: { x: originX, z: originZ },
          radius,
          pulled,
          crushed,
          centerRadius: cardDef.centerRadius,
          hits: crushed,
        });

        return;
      }

      if (cardDef.effect === 'dragons_breath') {
        const rotation = resolveAttackRotation(player, data);
        player.rotation = rotation;
        const dirX = Math.cos(rotation);
        const dirZ = Math.sin(rotation);
        const range = cardDef.attackRange || 7;
        const coneAngle = cardDef.attackConeAngle || Math.PI / 3;
        const { hits, magicStonesGained } = collectConeHits(
          originX,
          originZ,
          dirX,
          dirZ,
          range,
          coneAngle,
          cardDef.damage || 0,
          { attackerId: socket.playerId }
        );
        spawnDragonsBreathEffect(originX, originZ, dirX, dirZ, cardDef, socket.playerId);
        cleanupAfterDamage();

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: cardDef.specialEffect,
          origin: { x: originX, z: originZ },
          direction: { x: dirX, z: dirZ },
          radius: range,
          hits,
          magicStonesGained,
          dotTicks: cardDef.dotTicks || 4,
        });

        return;
      }

      if (cardDef.effect === 'inferno_pillar') {
        const range = cardDef.attackRange || 7;
        const { hits, magicStonesGained } = collectRadialHits(
          originX,
          originZ,
          range,
          cardDef.damage || 12,
          { attackerId: socket.playerId }
        );
        spawnInfernoPillarEffect(originX, originZ, cardDef, socket.playerId);
        cleanupAfterDamage();

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: cardDef.specialEffect,
          origin: { x: originX, z: originZ },
          radius: range,
          radialBurst: true,
          hits,
          magicStonesGained,
          dotTicks: cardDef.dotTicks || 4,
        });

        return;
      }

      if (cardDef.effect === 'mana_prism') {
        const prism = {
          id: crypto.randomUUID(),
          ownerId: socket.playerId,
          type: 'mana_prism',
          x: originX,
          z: originZ,
          hp: 1,
          maxHp: 1,
          ttl: cardDef.durationSeconds || 12,
          maxTtl: cardDef.durationSeconds || 12,
          createdAt: now,
          lastPulseAt: now,
          pulseIntervalMs: cardDef.pulseIntervalMs || 2000,
          magicStonePulse: cardDef.magicStonePulse || 10,
        };
        state.minions.push(prism);

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          origin: { x: originX, z: originZ },
          radius: 1,
        });

        return;
      }

      if (cardDef.effect === 'astral_guardian' || cardDef.specialEffect === 'astral_shield') {
        applyAstralShieldCast({
          socket, state, lobby, data, cardDef, handCard, player,
          originX, originZ, now, hasOverclock,
        });
        return;
      }

      if (cardDef.effect === 'ice_ball') {
        const rotation = resolveAttackRotation(player, data);
        player.rotation = rotation;
        const dirX = Math.cos(rotation);
        const dirZ = Math.sin(rotation);
        const attackRange = cardDef.attackRange || ATTACK_RANGE;
        const grind = handCard.grind || 0;
        const damage = handCard.echoDamage != null
          ? handCard.echoDamage
          : scaledGrindStat(cardDef.damage || 0, grind);

        const { hits, magicStonesGained: rawMagicStones } = collectProjectileHits(
          originX,
          originZ,
          dirX,
          dirZ,
          attackRange,
          damage,
          {
            magicStoneOnHit: cardDef.magicStoneOnHit,
            magicStoneOnKill: cardDef.magicStoneOnKill,
            attackerId: socket.playerId,
            pierces: false,
          }
        );
        const appliedMagicStones = addMagicStones(player, rawMagicStones);

        const slowChance = cardDef.slowChance ?? 1;
        const slowDurationMs = cardDef.slowDurationMs || 0;
        if (slowDurationMs > 0 && slowChance > 0) {
          const slowed = new Set();
          for (const hit of hits) {
            if (!hit.enemyId || slowed.has(hit.enemyId)) continue;
            const enemy = state.enemies.find(e => e.id === hit.enemyId);
            if (enemy && Math.random() < slowChance) {
              applySlow(enemy, slowDurationMs, cardDef.slowFactor);
              slowed.add(hit.enemyId);
            }
          }
        }

        cleanupAfterDamage();

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          effect: 'ice_ball',
          specialEffect: cardDef.specialEffect,
          origin: { x: originX, z: originZ },
          direction: { x: dirX, z: dirZ },
          attackRange,
          hits,
          projectileTravelMs: cardDef.projectileTravelMs,
          magicStonesGained: appliedMagicStones,
        });

        return;
      }

      if (cardDef.effect === 'chain_lightning') {
        const rotation = resolveAttackRotation(player, data);
        player.rotation = rotation;
        const dirX = Math.cos(rotation);
        const dirZ = Math.sin(rotation);
        const attackRange = cardDef.attackRange || ATTACK_RANGE;
        const chainRadius = cardDef.chainRadius || 5;
        const grind = handCard.grind || 0;
        const damage = handCard.echoDamage != null
          ? handCard.echoDamage
          : scaledGrindStat(cardDef.damage || 0, grind);

        const { hits: rawHits, magicStonesGained: rawMagicStones } = collectChainLightningHits(
          originX,
          originZ,
          dirX,
          dirZ,
          attackRange,
          damage,
          {
            chainRadius,
            maxChainTargets: cardDef.maxChainTargets ?? 2,
            magicStoneOnHit: cardDef.magicStoneOnHit,
            magicStoneOnKill: cardDef.magicStoneOnKill,
            attackerId: socket.playerId,
          }
        );
        const appliedMagicStones = addMagicStones(player, rawMagicStones);

        const chainSegments = [];
        let from = { x: originX, z: originZ };
        const hits = [];
        for (const hit of rawHits) {
          const to = { x: hit.x, z: hit.z };
          chainSegments.push({ from, to });
          from = to;
          hits.push({
            enemyId: hit.enemyId,
            hp: hit.hp,
            damageDealt: hit.damageDealt,
            ...(hit.magicStonesGained ? { magicStonesGained: hit.magicStonesGained } : {}),
          });
        }

        cleanupAfterDamage();

        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);

        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: 'chain_lightning',
          origin: { x: originX, z: originZ },
          direction: { x: dirX, z: dirZ },
          attackRange,
          chainRadius,
          hits,
          chainSegments,
          magicStonesGained: appliedMagicStones,
        });

        return;
      }

      // Radial AoE: apply damage to every enemy within SUMMON_RADIUS
      const grind = handCard.grind || 0;
      const summonDamage = handCard.echoDamage != null
        ? handCard.echoDamage
        : scaledGrindStat(cardDef.damage || 0, grind);
      const radial = collectRadialHits(originX, originZ, SUMMON_RADIUS, summonDamage, {
        magicStoneOnHit: cardDef.magicStoneOnHit,
        magicStoneOnKill: cardDef.magicStoneOnKill,
        attackerId: socket.playerId,
      });
      const hits = radial.hits;
      const appliedMagicStones = addMagicStones(player, radial.magicStonesGained);

      cleanupAfterDamage();

      applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);

      // Remove card from hand and draw replacement
      replaceConsumedCard(player, data.slotIndex, handCard);

      // Broadcast updated hand to all clients
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());

      // Broadcast result to all clients
      io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
        playerId: socket.playerId,
        cardId: data.cardId,
        slotIndex: data.slotIndex,
        specialEffect: cardDef.specialEffect,
        origin: { x: originX, z: originZ },
        radius: SUMMON_RADIUS,
        hits: hits,
        magicStonesGained: appliedMagicStones,
      });

      // Do NOT delete pendingSummons here — leave the entry so any duplicate
      // useCard events arriving in the same event-loop turn are rejected.
      // The per-tick clear() below will purge it on the next stateUpdate.

      return;
    }

    // ── Enchantment branch (lingering ground/self effects) ──
    if (cardDef.type === 'enchantment') {
      const enchantKey = `${data.slotIndex}:${data.cardId}`;

      if (player.pendingSummons.has(enchantKey)) {
        socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Enchantment already resolving' });
        return;
      }

      const magicStoneCost = cardDef.magicStoneCost || 0;
      if (player.magicStones < magicStoneCost) {
        socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: THEME.resource.insufficient });
        return;
      }

      if (cardDef.effect === 'spike_trap' || cardDef.effect === 'cinder_snare') {
        if (countGroundEnchantmentsForPlayer(socket.playerId) >= MAX_GROUND_ENCHANTMENTS_PER_PLAYER) {
          socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Too many ground enchantments active' });
          return;
        }
      }

      if (cardDef.effect === 'mirror_ward' && player.activeEnchantment && player.activeEnchantment.armed) {
        socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Enchantment already active' });
        return;
      }

      player.pendingSummons.add(enchantKey);
      player.magicStones -= magicStoneCost;
      applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
      replaceConsumedCard(player, data.slotIndex, handCard);

      if (cardDef.effect === 'spike_trap' || cardDef.effect === 'cinder_snare') {
        spawnGroundEnchantment(originX, originZ, cardDef, socket.playerId);
        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: cardDef.specialEffect,
          effect: cardDef.effect,
          target: cardDef.target,
          origin: { x: originX, z: originZ },
          radius: cardDef.radius || 2.5,
        });
        return;
      }

      if (cardDef.effect === 'mirror_ward') {
        armSelfEnchantment(player, cardDef);
        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: cardDef.specialEffect,
          effect: cardDef.effect,
          target: cardDef.target,
          origin: { x: originX, z: originZ },
        });
        return;
      }

      socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Unknown enchantment effect' });
      return;
    }

    // ── Monster branch (spawn persistent minion) ──
    if (cardDef.type === 'creature') {
      const magicStoneCost = cardDef.magicStoneCost || 0;
      if (player.magicStones < magicStoneCost) {
        socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: THEME.resource.insufficient });
        return;
      }

      if (cardDef.effect === 'astral_guardian' || cardDef.specialEffect === 'astral_shield') {
        player.magicStones -= magicStoneCost;
        applyAstralShieldCast({
          socket, state, lobby, data, cardDef, handCard, player,
          originX, originZ, now, hasOverclock,
        });
        return;
      }

      player.magicStones -= magicStoneCost;

      const grind = handCard.grind || 0;
      const minionHp = scaledGrindStat(cardDef.minionHp || 50, grind);
      const minionTtl = scaledGrindStat(cardDef.minionTtl || 30, grind);
      const minion = {
        id: crypto.randomUUID(),
        ownerId: socket.playerId,
        type: cardDef.effect || data.cardId,
        x: originX,
        z: originZ,
        hp: minionHp,
        maxHp: minionHp,
        specialEffect: cardDef.specialEffect,
        ttl: minionTtl,
        maxTtl: minionTtl,
        createdAt: now
      };
      if (cardDef.taunt) {
        minion.taunt = true;
      }
      if (cardDef.effect === 'storm_eagle' || cardDef.effect === 'thunderbird') {
        minion.attackRange = cardDef.attackRange || 7;
        minion.attackDamage = cardDef.attackDamage || 12;
        if (cardDef.effect === 'thunderbird') {
          minion.chainRadius = cardDef.chainRadius || 5;
          minion.maxChainTargets = cardDef.maxChainTargets || 2;
        }
      }
      if (cardDef.effect === 'battery_automaton') {
        minion.lastChargePulseAt = now;
        minion.chargePulseIntervalMs = cardDef.chargePulseIntervalMs || 6000;
        minion.chargeRestore = cardDef.chargeRestore || 1;
      }
      if (cardDef.effect === 'null_crawler') {
        const attackIntervalMs = cardDef.attackIntervalMs || 2000;
        minion.attackRange = cardDef.attackRange || 14;
        minion.attackDamage = cardDef.attackDamage || 22;
        minion.attackIntervalMs = attackIntervalMs;
        minion.attackWindupMs = cardDef.attackWindupMs || 1000;
        minion.projectileHitWidth = cardDef.projectileHitWidth || 0.8;
        minion.lastAttackAt = now - attackIntervalMs;
      }
      if (cardDef.effect === 'bulkhead_mauler') {
        minion.attackRange = cardDef.attackRange || 4;
        minion.attackConeAngle = cardDef.attackConeAngle || ((Math.PI * 2) / 3);
        minion.attackDamage = cardDef.attackDamage || 9;
      }
      if (data.cardId === 'dungeon_drake' || cardDef.effect === 'ancient_wyrm') {
        applyWyrmMinionBreathStats(minion, cardDef, grind, now);
      }
      state.minions.push(minion);

      const summonedMinions = [];
      if (cardDef.effect === 'undead_commander') {
        const skeletonCount = cardDef.summonSkeletonCount || 2;
        const skeletonHp = scaledGrindStat(cardDef.summonSkeletonHp || 60, grind);
        const skeletonOffsets = [
          { x: -1.5, z: 0 },
          { x: 1.5, z: 0 },
          { x: 0, z: -1.5 },
          { x: 0, z: 1.5 },
        ];
        for (let i = 0; i < skeletonCount; i++) {
          const offset = skeletonOffsets[i % skeletonOffsets.length];
          const skeleton = {
            id: crypto.randomUUID(),
            ownerId: socket.playerId,
            type: 'skeleton_knight',
            x: originX + offset.x,
            z: originZ + offset.z,
            hp: skeletonHp,
            maxHp: skeletonHp,
            ttl: minionTtl,
            maxTtl: minionTtl,
            createdAt: now,
          };
          state.minions.push(skeleton);
          summonedMinions.push({
            id: skeleton.id,
            x: skeleton.x,
            z: skeleton.z,
          });
        }
      }

      // Set slot cooldown and keep the card in hand while the minion is active.
      applySlotCooldown(player, data.slotIndex, hasOverclock, now, COOLDOWN_MS);
      beginCreatureBurnDown(player, data.slotIndex, handCard, minion);

      // Broadcast updated hand to all clients
      io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());

      io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
        playerId: socket.playerId,
        cardId: data.cardId,
        slotIndex: data.slotIndex,
        specialEffect: cardDef.specialEffect,
        origin: { x: originX, z: originZ },
        minionId: minion.id,
        summonedMinions: summonedMinions.length > 0 ? summonedMinions : undefined,
      });

      return;
    }
}

module.exports = {
  setCallbacks,
  handleUseCard,
};
