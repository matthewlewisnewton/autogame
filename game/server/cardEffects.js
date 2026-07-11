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
  isPlayerCardCommitted,
  clearPlayerCardCommitment,
  getEntityWorldY,
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
  emitLobbyHotState,
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
let resolveProjectileAim = null;

function setCallbacks(deps) {
  io = deps.io;
  emitCardError = deps.emitCardError;
  findSacrificeTarget = deps.findSacrificeTarget;
  resolveAttackRotation = deps.resolveAttackRotation;
  resolveProjectileAim = deps.resolveProjectileAim;
}

function aimForProjectile(player, data, state) {
  if (resolveProjectileAim) {
    return resolveProjectileAim(player, data, state);
  }
  const rotation = resolveAttackRotation
    ? resolveAttackRotation(player, data)
    : (Number.isFinite(data?.rotation) ? data.rotation : (player.rotation || 0));
  return {
    rotation,
    dirX: Math.cos(rotation),
    dirY: 0,
    dirZ: Math.sin(rotation),
    originY: 0,
  };
}

function projectileCollectorVertical(aim) {
  const opts = { originY: aim.originY };
  if (aim.dirY !== 0) opts.dirY = aim.dirY;
  return opts;
}

function directionPayload(dirX, dirY, dirZ) {
  const direction = { x: dirX, z: dirZ };
  if (dirY !== 0) direction.y = dirY;
  return direction;
}

// Helper: resolve a card's effective attack reach for a given grind level.
// Base reach is the card's explicit `attackRange` (falling back to ATTACK_RANGE).
// Cards that opt in via `aoeGrindScale` get a small, conservative per-grind
// widening: base * (1 + grind * aoeGrindScale). Kept as a float (no rounding)
// so the growth stays smooth and gentle. Cards without the field are unchanged.
function effectiveAttackRange(cardDef, grind) {
  const base = (cardDef && cardDef.attackRange) || ATTACK_RANGE;
  const scale = cardDef && cardDef.aoeGrindScale;
  if (!scale) return base;
  const level = Number.isFinite(grind) ? Math.max(0, grind) : 0;
  return base * (1 + level * scale);
}

// Helper: apply slot cooldown, consuming an overclock charge when available.
function applySlotCooldown(player, slotIndex, hasOverclock, now, cooldownMs) {
  if (hasOverclock) {
    player.overclockChargesRemaining -= 1;
  } else {
    player.slotCooldowns[slotIndex] = now + cooldownMs;
  }
}

function tryBeginCardWindup(ctx) {
  const {
    socket, lobby, player, data, cardDef, handCard, hasOverclock, now,
    magicStoneCost = 0,
  } = ctx;
  const windUpMs = cardDef.windUpMs || 0;
  if (windUpMs <= 0) return false;

  if (magicStoneCost > 0) {
    player.magicStones -= magicStoneCost;
  }

  // Creature cards link to the spawned minion at resolution via beginCreatureBurnDown.
  if (cardDef.type !== 'creature') {
    handCard.remainingCharges -= 1;
  }

  let rotation = player.rotation || 0;
  if (resolveAttackRotation) {
    rotation = resolveAttackRotation(player, data);
    player.rotation = rotation;
  } else if (Number.isFinite(data.rotation)) {
    rotation = data.rotation;
    player.rotation = rotation;
  }

  applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);

  if (cardDef.type !== 'creature' && handCard.remainingCharges <= 0) {
    replaceConsumedCard(player, data.slotIndex, handCard);
  }

  player.cardUseState = 'windup';
  player.cardWindupStartTime = now;
  player.cardWindupMs = windUpMs;
  // Origin and facing are locked at commit; deferred resolution uses these values
  // rather than the player's live position after wind-up ends.
  player.pendingCardUse = {
    slotIndex: data.slotIndex,
    cardId: data.cardId,
    rotation,
    originX: player.x,
    originY: getEntityWorldY(player),
    originZ: player.z,
    grind: handCard.grind || 0,
    echoDamage: handCard.echoDamage,
  };

  emitLobbyHotState(lobby.id, { playerId: socket.playerId });
  return true;
}

function applyAstralShieldCast(ctx) {
  const {
    socket, state, lobby, data, cardDef, handCard, player,
    originX, originY = null, originZ, now, hasOverclock, fromWindup = false,
  } = ctx;

  const grind = handCard.grind || 0;
  const summonDamage = handCard.echoDamage != null
    ? handCard.echoDamage
    : scaledGrindStat(cardDef.damage || 0, grind, data.cardId);
  const radial = collectRadialHits(originX, originY, originZ, SUMMON_RADIUS, summonDamage, {
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

  const minionHp = scaledGrindStat(cardDef.minionHp || 60, grind, data.cardId);
  const minionTtl = scaledGrindStat(cardDef.minionTtl || 30, grind, data.cardId);
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
    attackIntervalMs: cardDef.attackIntervalMs || 1500,
    lastAttackAt: 0,
  };
  if (cardDef.taunt) {
    minion.taunt = true;
  }
  state.minions.push(minion);

  cleanupAfterDamage();

  if (!ctx.fromWindup) {
    applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
    replaceConsumedCard(player, data.slotIndex, handCard);
  }

  emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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

  if (!data || typeof data.slotIndex !== 'number' || !data.cardId) return;

  const cardDef = getCardDef(data.cardId);
  if (!cardDef) {
    socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Unknown card' });
    return;
  }

  const player = state.players[socket.playerId];
  if (!player || player.dead || player.extracted) return;
  if (!player.pendingSummons) {
    player.pendingSummons = new Set();
  }

  const cardProbeActive = !!player.debugHooks?.cardProbe;
  if (!state.run || (state.run.status !== 'playing' && !cardProbeActive)) return;
  if (cardProbeActive && state.run.status !== 'playing') {
    state.run.status = 'playing';
  }

  if (isPlayerCardCommitted(player)) {
    socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Card commitment in progress' });
    return;
  }

  const handValidation = validateUseCardHand(player, data.slotIndex, data.cardId);
  if (!handValidation.valid) {
    socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: handValidation.reason });
    return;
  }

  const now = Date.now();
  const hasOverclock = (player.overclockChargesRemaining || 0) > 0;
  if (!cardProbeActive
    && !hasOverclock
    && player.slotCooldowns
    && player.slotCooldowns[data.slotIndex]
    && now < player.slotCooldowns[data.slotIndex]) {
    socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Slot on cooldown' });
    return;
  }

  executeUseCard(socket, state, lobby, data, {
    now,
    hasOverclock,
    handCard: handValidation.handCard,
    player,
    cardDef,
    originX: player.x,
    originY: getEntityWorldY(player),
    originZ: player.z,
  });
}

// Shared card-effect dispatch for instant use and deferred wind-up resolution.
// When options.fromWindupResolution is true, costs were paid at commit and
// pendingCardUse origin/rotation are authoritative for the strike.
function executeUseCard(socket, state, lobby, data, precomputed = {}, options = {}) {
    const fromWindup = options.fromWindupResolution === true;
    const now = precomputed.now ?? Date.now();
    const player = precomputed.player ?? state.players[socket.playerId];
    const cardDef = precomputed.cardDef ?? getCardDef(data.cardId);
    if (!player || !cardDef) return;

    const hasOverclock = fromWindup ? false : (precomputed.hasOverclock ?? false);
    const handCard = fromWindup
      ? {
        grind: options.handCardSnapshot?.grind || 0,
        echoDamage: options.handCardSnapshot?.echoDamage,
      }
      : precomputed.handCard;
    const originX = fromWindup ? options.originX : precomputed.originX;
    const originY = fromWindup
      ? (options.originY ?? null)
      : (precomputed.originY ?? getEntityWorldY(player));
    const originZ = fromWindup ? options.originZ : precomputed.originZ;

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

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          effect: 'draw_card',
          origin: { x: originX, z: originZ },
        });
        return;
      }

      if (!fromWindup && tryBeginCardWindup({
        socket, state, lobby, player, data, cardDef, handCard, hasOverclock, now,
      })) {
        return;
      }

      if (!fromWindup) {
        handCard.remainingCharges -= 1;
      }

      const aimPlayer = fromWindup
        ? { ...player, x: originX, z: originZ }
        : player;
      const aim = aimForProjectile(aimPlayer, data, state);
      if (!fromWindup) {
        player.rotation = aim.rotation;
      }
      const { dirX, dirY, dirZ } = aim;
      const attackConeAngle = cardDef.attackConeAngle || ATTACK_CONE_ANGLE;
      const grind = handCard.grind || 0;
      const attackRange = effectiveAttackRange(cardDef, grind);
      const damage = handCard.echoDamage != null
        ? handCard.echoDamage
        : scaledGrindStat(cardDef.damage || 0, grind);
      const cooldownMs = cardDef.cooldownMs || COOLDOWN_MS;

      const swingsPerUse = cardDef.swingsPerUse || 1;
      let hits = [];
      let magicStonesGained = 0;
      let totalHpHealed = 0;
      let totalCurrencyGained = 0;

      for (let swing = 0; swing < swingsPerUse; swing++) {
        let swingResult;
        if (cardDef.effect === 'throw_rock' || cardDef.effect === 'projectile' || cardDef.effect === 'fireball') {
          swingResult = collectProjectileHits(originX, originZ, dirX, dirZ, attackRange, damage, {
            magicStoneOnHit: cardDef.magicStoneOnHit,
            magicStoneOnKill: cardDef.magicStoneOnKill,
            attackerId: socket.playerId,
            pierces: cardDef.projectile?.pierces === true,
            ...projectileCollectorVertical(aim),
          });
        } else if (cardDef.effect === 'returning_projectile' || cardDef.effect === 'triple_returning_projectile') {
          const returnPasses = cardDef.returnPasses
            || (cardDef.effect === 'triple_returning_projectile' ? 3 : 1);
          swingResult = collectReturningProjectileHits(originX, originZ, dirX, dirZ, attackRange, damage, {
            returnPasses,
            magicStoneOnHit: cardDef.magicStoneOnHit,
            magicStoneOnKill: cardDef.magicStoneOnKill,
            attackerId: socket.playerId,
            ...projectileCollectorVertical(aim),
          });
        } else {
          swingResult = collectConeHits(originX, originZ, dirX, dirZ, attackRange, attackConeAngle, damage, {
            magicStoneOnHit: cardDef.magicStoneOnHit,
            magicStoneOnKill: cardDef.magicStoneOnKill,
            healOnKill: cardDef.healOnKill,
            currencyOnKill: cardDef.currencyOnKill,
            attackerId: socket.playerId,
            ...projectileCollectorVertical(aim),
          });
        }
        for (const hit of swingResult.hits) {
          hits.push({ ...hit, swing: swing + 1 });
        }
        magicStonesGained += swingResult.magicStonesGained;
        totalHpHealed += swingResult.hpHealed || 0;
        totalCurrencyGained += swingResult.currencyGained || 0;
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
            originY,
            originZ,
            cardDef.shockwaveRadius || SUMMON_RADIUS,
            cardDef.shockwaveDamage || damage,
            { attackerId: socket.playerId }
          );
          shockwaveHits = shockwave.hits;
        }
      }

      if (cardDef.specialEffect === 'fire_trail') {
        // The lingering trail ticks from the same 3D ray as the swing itself.
        spawnFireTrailEffect(originX, originZ, dirX, dirZ, cardDef, socket.playerId, {
          originY: aim.originY,
          dirY: aim.dirY,
        });
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
      const appliedHpHealed = totalHpHealed > 0 ? healPlayer(socket.playerId, totalHpHealed) : 0;
      if (totalCurrencyGained > 0) {
        player.currency = (player.currency || 0) + totalCurrencyGained;
        player.currencyEarnedThisRun = (player.currencyEarnedThisRun || 0) + totalCurrencyGained;
      }
      cleanupAfterDamage();

      if (!fromWindup) {
        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cooldownMs);
        if (handCard.remainingCharges <= 0) {
          replaceConsumedCard(player, data.slotIndex, handCard);
        }
      }

      emitLobbyHotState(lobby.id, { playerId: socket.playerId });
      io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
        playerId: socket.playerId,
        cardId: data.cardId,
        specialEffect: cardDef.specialEffect,
        effect: cardDef.effect,
        origin: { x: originX, z: originZ },
        direction: directionPayload(dirX, dirY, dirZ),
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
        ...(appliedHpHealed > 0 ? { hpHealed: appliedHpHealed } : {}),
        ...(totalCurrencyGained > 0 ? { currencyGained: totalCurrencyGained } : {}),
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
      const spellCooldownMs = cardDef.cooldownMs || COOLDOWN_MS;
      const consumeSpellSlot = (cooldownMs = spellCooldownMs) => {
        if (fromWindup) return;
        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cooldownMs);
        replaceConsumedCard(player, data.slotIndex, handCard);
      };

      const magicStoneCost = cardDef.magicStoneCost || 0;

      if (!fromWindup) {
        if (player.pendingSummons.has(summonKey)) {
          socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Summon already resolving' });
          return;
        }
        if (player.magicStones < magicStoneCost) {
          socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: THEME.resource.insufficient });
          return;
        }
        if (tryBeginCardWindup({
          socket, state, lobby, player, data, cardDef, handCard, hasOverclock, now, magicStoneCost,
        })) {
          return;
        }
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
        if (player.debugHooks?.pinMsOnTelepipePlace
          && Number.isFinite(player.magicStones)) {
          player._telepipeDeployMagicStones = player.magicStones;
          player._msRegenGraceUntil = now + 60000;
        }
        console.log(`[telepipe] placed at (${originX.toFixed(1)}, ${originZ.toFixed(1)}) by ${socket.playerId}`);

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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
        // tryBeginCardWindup already paid at commit for windup spells — match the
        // generic spell/creature branches and don't double-charge.
        if (!fromWindup) player.magicStones -= magicStoneCost;
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
            originY,
            originZ,
            SUMMON_RADIUS,
            fallbackDamage,
            { attackerId: socket.playerId }
          );
          cleanupAfterDamage();
          replaceConsumedCard(player, data.slotIndex, handCard);
          emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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
        const target = findSacrificeTarget(socket.playerId, originX, originY, originZ, sacrificeRadius);
        if (!target) {
          socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'No friendly summon to sacrifice' });
          return;
        }

        player.pendingSummons.add(summonKey);
        // tryBeginCardWindup already paid at commit for windup spells — match the
        // generic spell/creature branches and don't double-charge.
        if (!fromWindup) player.magicStones -= magicStoneCost;
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

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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

      if (!fromWindup) {
        player.pendingSummons.add(summonKey);
        player.magicStones -= magicStoneCost;
      }

      if (cardDef.effect === 'chrono_trigger') {
        const restoredCharges = restoreHandCharges(player, cardDef.adjacentChargeRestore || 0, {
          slots: [data.slotIndex - 1, data.slotIndex + 1],
        });

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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
        let freezeDurationMs = cardDef.freezeDurationMs || 2500;
        // Debug-only: headless card-mechanics probes need a longer slow/freeze window
        // than the default 2s because the driver emits by slot before client hand sync.
        if (player.debugHooks?.extendedFreezeDurationMs) {
          freezeDurationMs = Math.max(freezeDurationMs, player.debugHooks.extendedFreezeDurationMs);
        }
        const hits = applyFreezeInRadius(
          originX,
          originY,
          originZ,
          radius,
          freezeDurationMs,
          cardDef.damage || 0,
          cardDef.frozenBonusDamage || 0,
          { attackerId: socket.playerId }
        );
        cleanupAfterDamage();

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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
          originY,
          originZ,
          radius,
          cardDef.healAmount || 0
        );

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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
        const pulled = pullEnemiesToward(originX, originY, originZ, radius, cardDef.pullStrength || 4);

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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
          originY,
          originZ,
          cardDef,
          socket.playerId
        );
        cleanupAfterDamage();

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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
        const aim = aimForProjectile(player, data, state);
        player.rotation = aim.rotation;
        const { dirX, dirY, dirZ } = aim;
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
          {
            attackerId: socket.playerId,
            ...projectileCollectorVertical(aim),
          }
        );
        spawnDragonsBreathEffect(originX, originZ, dirX, dirZ, cardDef, socket.playerId, {
          originY: aim.originY,
          dirY,
        });
        cleanupAfterDamage();

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: cardDef.specialEffect,
          origin: { x: originX, z: originZ },
          direction: directionPayload(dirX, dirY, dirZ),
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
          originY,
          originZ,
          range,
          cardDef.damage || 12,
          { attackerId: socket.playerId }
        );
        spawnInfernoPillarEffect(originX, originZ, cardDef, socket.playerId, originY);
        cleanupAfterDamage();

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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

        consumeSpellSlot(COOLDOWN_MS);

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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
          originX, originY, originZ, now, hasOverclock, fromWindup,
        });
        return;
      }

      if (cardDef.effect === 'ice_ball') {
        const aim = aimForProjectile(player, data, state);
        player.rotation = aim.rotation;
        const { dirX, dirY, dirZ } = aim;
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
            ...projectileCollectorVertical(aim),
          }
        );
        const appliedMagicStones = addMagicStones(player, rawMagicStones);

        const slowChance = cardDef.slowChance ?? 1;
        const slowDurationMs = cardDef.slowDurationMs || 0;
        const forceSlowRoll = process.env.ALLOW_DEBUG_SCENARIOS === '1'
          && player.debugHooks?.forceStatusRoll === 'slow';
        if (slowDurationMs > 0 && slowChance > 0) {
          const slowed = new Set();
          for (const hit of hits) {
            if (!hit.enemyId || slowed.has(hit.enemyId)) continue;
            const enemy = state.enemies.find(e => e.id === hit.enemyId);
            if (enemy && (forceSlowRoll || Math.random() < slowChance)) {
              applySlow(enemy, slowDurationMs, cardDef.slowFactor);
              slowed.add(hit.enemyId);
            }
          }
        }
        if (forceSlowRoll && player.debugHooks) {
          player.debugHooks.forceStatusRoll = null;
        }

        cleanupAfterDamage();

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          effect: 'ice_ball',
          specialEffect: cardDef.specialEffect,
          origin: { x: originX, z: originZ },
          direction: directionPayload(dirX, dirY, dirZ),
          attackRange,
          hits,
          projectileTravelMs: cardDef.projectileTravelMs,
          magicStonesGained: appliedMagicStones,
        });

        return;
      }

      if (cardDef.effect === 'chain_lightning') {
        const aim = aimForProjectile(player, data, state);
        player.rotation = aim.rotation;
        const { dirX, dirY, dirZ } = aim;
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
            ...projectileCollectorVertical(aim),
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

        consumeSpellSlot();

        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
        io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: 'chain_lightning',
          origin: { x: originX, z: originZ },
          direction: directionPayload(dirX, dirY, dirZ),
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
        : scaledGrindStat(cardDef.damage || 0, grind, data.cardId);
      const radial = collectRadialHits(originX, originY, originZ, SUMMON_RADIUS, summonDamage, {
        magicStoneOnHit: cardDef.magicStoneOnHit,
        magicStoneOnKill: cardDef.magicStoneOnKill,
        healOnHit: cardDef.healOnHit,
        healOnKill: cardDef.healOnKill,
        attackerId: socket.playerId,
      });
      const hits = radial.hits;
      const appliedMagicStones = addMagicStones(player, radial.magicStonesGained);
      const appliedHpHealed = radial.hpHealed ? healPlayer(socket.playerId, radial.hpHealed) : 0;

      cleanupAfterDamage();

      consumeSpellSlot();

      // Broadcast updated hand to all clients
      emitLobbyHotState(lobby.id, { playerId: socket.playerId });

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
        hpHealed: appliedHpHealed,
      });

      // Do NOT delete pendingSummons here — leave the entry so any duplicate
      // useCard events arriving in the same event-loop turn are rejected.
      // The per-tick clear() below will purge it on the next stateUpdate.

      return;
    }

    // ── Enchantment branch (lingering ground/self effects) ──
    if (cardDef.type === 'enchantment') {
      const enchantKey = `${data.slotIndex}:${data.cardId}`;
      const magicStoneCost = cardDef.magicStoneCost || 0;

      if (!fromWindup) {
        if (player.pendingSummons.has(enchantKey)) {
          socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: 'Enchantment already resolving' });
          return;
        }

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

        if (tryBeginCardWindup({
          socket, state, lobby, player, data, cardDef, handCard, hasOverclock, now, magicStoneCost,
        })) {
          return;
        }

        player.pendingSummons.add(enchantKey);
        player.magicStones -= magicStoneCost;
        applySlotCooldown(player, data.slotIndex, hasOverclock, now, cardDef.cooldownMs || COOLDOWN_MS);
        replaceConsumedCard(player, data.slotIndex, handCard);
      }

      if (cardDef.effect === 'spike_trap' || cardDef.effect === 'cinder_snare') {
        spawnGroundEnchantment(originX, originZ, cardDef, socket.playerId, originY);
        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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
        emitLobbyHotState(lobby.id, { playerId: socket.playerId });
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
      if (!fromWindup) {
        if (player.magicStones < magicStoneCost) {
          socket.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason: THEME.resource.insufficient });
          return;
        }
        if (tryBeginCardWindup({
          socket, state, lobby, player, data, cardDef, handCard, hasOverclock, now, magicStoneCost,
        })) {
          return;
        }
      }

      if (cardDef.effect === 'astral_guardian' || cardDef.specialEffect === 'astral_shield') {
        if (!fromWindup) {
          player.magicStones -= magicStoneCost;
        }
        applyAstralShieldCast({
          socket, state, lobby, data, cardDef, handCard, player,
          originX, originY, originZ, now, hasOverclock, fromWindup,
        });
        return;
      }

      if (!fromWindup) {
        player.magicStones -= magicStoneCost;
      }

      const grind = handCard.grind || 0;
      const minionHp = scaledGrindStat(cardDef.minionHp || 50, grind, data.cardId);
      const minionTtl = scaledGrindStat(cardDef.minionTtl || 30, grind, data.cardId);
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
        // Aerial minions hover: resolveEntityY() lifts them to floorY + altitude
        // each tick. The thunderbird flies a touch higher than the storm eagle.
        minion.flying = true;
        minion.altitude = cardDef.altitude || (cardDef.effect === 'thunderbird' ? 4.5 : 3.5);
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
        minion.attackDamage = scaledGrindStat(cardDef.attackDamage || 22, grind, 'null_crawler');
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
        if (cardDef.effect === 'ancient_wyrm') {
          // Archive Wyrm hovers like storm_eagle / thunderbird aerial minions.
          minion.flying = true;
          minion.altitude = cardDef.altitude;
        }
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

      if (!fromWindup) {
        applySlotCooldown(player, data.slotIndex, hasOverclock, now, COOLDOWN_MS);
      }
      const burnCard = fromWindup ? player.hand[data.slotIndex] : handCard;
      beginCreatureBurnDown(player, data.slotIndex, burnCard, minion);

      // Broadcast updated hand to all clients
      emitLobbyHotState(lobby.id, { playerId: socket.playerId });

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

function resolvePendingCardUse(socket, state, lobby, player) {
  const pending = player.pendingCardUse;
  if (!pending) return;

  executeUseCard(socket, state, lobby, {
    cardId: pending.cardId,
    slotIndex: pending.slotIndex,
    rotation: pending.rotation,
  }, {
    now: Date.now(),
    player,
    cardDef: getCardDef(pending.cardId),
  }, {
    fromWindupResolution: true,
    originX: pending.originX,
    originY: pending.originY ?? null,
    originZ: pending.originZ,
    rotation: pending.rotation,
    handCardSnapshot: {
      grind: pending.grind || 0,
      echoDamage: pending.echoDamage,
    },
  });

  clearPlayerCardCommitment(player);
  emitLobbyHotState(lobby.id, { playerId: socket.playerId });
}

module.exports = {
  setCallbacks,
  handleUseCard,
  executeUseCard,
  resolvePendingCardUse,
  effectiveAttackRange,
};
