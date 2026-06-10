// Run/dungeon lifecycle: objectives, spawning, rewards, telepipe, snapshots, deploy.
// Lobby-scoped functions take `state` as the first parameter (no module-level game state).

const { SERVER_TO_CLIENT } = require('../../shared/events.js');
const crypto = require('crypto');
const {
  DECK_MIN_SIZE,
  DECK_MAX_SIZE,
  MAX_HP,
  MAX_MAGIC_STONES,
  STARTING_MAGIC_STONES,
  SPAWN_PADDING,
  LOOT_SPAWN_CHANCE,
  VICTORY_REWARD_ROTATION,
  ENEMY_CARD_DROPS,
  ENEMY_MS_DROPS,
  ENEMY_CURRENCY_DROP_CHANCE,
  ENEMY_CURRENCY_DROP_PCT_MIN,
  ENEMY_CURRENCY_DROP_PCT_MAX,
  LOOT_DROP_OFFSET_MS,
  LOOT_DROP_OFFSET_CURRENCY,
  MAX_CARD_CHOICES,
  TICK_RATE,
  PORTAL_RADIUS,
  PORTAL_ENTER_COOLDOWN_MS,
  PORTAL_PLACEMENT_GRACE_MS,
  MAX_HAND_SLOTS,
  DIFFICULTY_MINIBOSS_HP_PER_PLAYER,
  difficultyScaleFactor,
  runPlayerCount,
} = require('../config');
const {
  mulberry32,
  roomsByRole,
  randomRoomPositionByRole,
  sampleFloorY,
  resolveFloorY,
  generateHub,
} = require('../dungeon');
const {
  enemyDefFor,
  firstRoomPosition,
  hubSpawnPosition,
  pickFloorSpawnPosition,
  randomWanderTarget,
  spawnVolatileExplosion,
  clearPlayerCardCommitment,
} = require('../simulation');
const HUB_LAYOUT = generateHub(0);
const { applyVariant, getVariantBonusDrop, resolveVariantRollTier, VARIANT_DEFS } = require('../enemyVariants');
const {
  getQuest,
  getSelectedQuest,
  getEnemyPool,
  getGuaranteedEnemyType,
  pickWeightedEnemyType,
  DEFAULT_QUEST_TIER,
} = require('../quests');
const { unlockQuestTier, isQuestTierUnlocked } = require('../users');
const { getObjectiveDef } = require('../objectives');
const { THEME } = require('../theme');
const { DEFAULT_COSMETIC } = require('../cosmetic');
const CARD_IDENTITY = require('../../shared/cardDefs.json');
const CARD_STATS = require('../../shared/cardStats.json');
const { PHASES, setGamePhase, isLobbyPhase, isPlayingPhase } = require('../lobbies');
const {
  createEncounterState,
  setEncounterBoss,
  ensureEncounterSpawnAnchor,
  isEncounterLocked,
  tryActivateEncounter,
  getEncounterBossId,
  onStageBossDefeated,
} = require('../encounters');
const { grantCard, inventoryToOwnedCards } = require('./inventory');
const {
  createDrawDeckFromSelectedDeck,
  initPlayerHand,
  isPlayerOutOfCards,
  resetPlayerDesperationState,
} = require('./hand');
const { revivePlayerInLobby, refreshShopOffer, ensureShopOffer } = require('./economy');
const { savePlayerData } = require('./persistence');
const {
  getIoTarget,
  emitLobbyDeploy,
  maybeEmitPlayerDeckUpdate,
  getBroadcastLobbyUpdate,
  getRebuildWallColliders,
} = require('./io');

const CARD_STAT_OVERLAY = {
  dungeon_drake: { breathConeAngle: Math.PI / 4 },
  bulkhead_mauler: { attackConeAngle: (Math.PI * 2) / 3 },
  ancient_wyrm: { breathConeAngle: Math.PI / 3 },
  harvesting_scythe: { attackConeAngle: Math.PI },
  reapers_scythe: { attackConeAngle: Math.PI },
  dragons_breath: { attackConeAngle: Math.PI / 3 },
  astral_guardian: { attackIntervalMs: Math.floor(1000 / TICK_RATE) },
};

const CARD_DEFS = Object.fromEntries(
  Object.keys(CARD_IDENTITY).map((id) => [
    id,
    { ...CARD_IDENTITY[id], ...CARD_STATS[id], ...CARD_STAT_OVERLAY[id] },
  ])
);

function createRunState(state) {
  const quest = getSelectedQuest(state);
  const def = getObjectiveDef(quest.objectiveType);
  if (!def) {
    throw new Error(`Unknown objective type: ${quest.objectiveType}`);
  }

  const run = {
    id: crypto.randomUUID(),
    status: 'playing',
    questId: quest.id,
    questTier: quest.tier ?? DEFAULT_QUEST_TIER,
    questName: quest.name,
    questDescription: quest.description,
    rewardCurrency: quest.rewardCurrency,
    objective: def.createObjective(quest, { enemyCount: state.enemies.length }),
    startedAt: Date.now(),
  };

  if (quest.encounter) {
    run.encounter = createEncounterState({
      spawnAnchor: quest.encounter.spawnAnchor ?? null,
    });
  }

  return run;
}

function startDungeonRun(state) {
  state.run = createRunState(state);
  if (state._pendingEncounterBossId != null && state.run.encounter) {
    setEncounterBoss(state.run, state._pendingEncounterBossId);
    delete state._pendingEncounterBossId;
  }
  if (state.run.encounter) {
    ensureEncounterSpawnAnchor(state.run, state.enemies);
  }
  for (const p of Object.values(state.players)) {
    p.currencyEarnedThisRun = 0;
    p.runRewards = null;
    p.runCardDropIds = [];
    p.pendingCardChoices = null;
    p.claimedCardRewardId = null;
  }
}

function applyTelepipeReadyHand(state, player) {
  if (!player || !Array.isArray(player.hand)) return;
  const def = CARD_DEFS.telepipe;
  if (!def) return;

  const telepipeCard = {
    id: 'telepipe',
    name: def.name,
    type: def.type,
    charges: 1,
    remainingCharges: 1,
    magicStoneCost: def.magicStoneCost || 0,
    effect: 'telepipe',
  };

  if (player.debugScenario === 'fire-telepipe-ready') {
    const freshSortie = !!player._telepipeFreshSortie;
    if (freshSortie) {
      delete player._telepipeFreshSortie;
    }
    const ironCharges = 30;
    player.hand[0] = {
      id: 'iron_sword',
      name: 'Rust-Forged Saber',
      type: 'weapon',
      damage: 17,
      charges: ironCharges,
      remainingCharges: freshSortie ? ironCharges : 25,
      grind: 0,
    };
    player.hand[1] = telepipeCard;
    const fireballCharges = 5;
    player.hand[2] = {
      id: 'fireball',
      name: 'Fireball',
      type: 'spell',
      magicStoneCost: 15,
      charges: fireballCharges,
      remainingCharges: fireballCharges,
      grind: 0,
    };
    maybeEmitPlayerDeckUpdate(state, player);
    return;
  }

  player.hp = MAX_HP;
  player.magicStones = MAX_MAGIC_STONES;

  const replaceSlot = player.hand.findIndex((c) => c);
  if (replaceSlot < 0) return;

  player.hand[replaceSlot] = telepipeCard;
  maybeEmitPlayerDeckUpdate(state, player);
}

const RUN_SPAWN_OFFSETS = [
  { x: 0, z: 0 },
  { x: 3, z: 0 },
  { x: -3, z: 0 },
  { x: 0, z: 3 },
];

function assignRunSpawnPositions(state, players) {
  const base = firstRoomPosition();
  const list = Array.isArray(players) ? players : Object.values(players);
  list.forEach((player, index) => {
    if (!player) return;
    const offset = RUN_SPAWN_OFFSETS[index % RUN_SPAWN_OFFSETS.length];
    player.x = base.x + offset.x;
    player.z = base.z + offset.z;
    player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
  });
}

function repositionPlayersAwayFromPortal(state, players) {
  const telepipe = state && state.telepipe;
  if (!telepipe) return;

  const list = Array.isArray(players) ? players.filter(Boolean) : Object.values(players).filter(Boolean);
  list.forEach((player, index) => {
    if (!isPlayerActive(player)) return;
    const dist = Math.hypot(player.x - telepipe.x, player.z - telepipe.z);
    if (dist > PORTAL_RADIUS) return;
    // Skip the (0,0) offset so resumed players are not left inside the portal radius.
    const offset = RUN_SPAWN_OFFSETS[(index + 1) % RUN_SPAWN_OFFSETS.length];
    player.x = telepipe.x + offset.x;
    player.z = telepipe.z + offset.z;
    player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
  });
}

function isPortalEntryGraceActive(state) {
  const telepipe = state && state.telepipe;
  if (!telepipe || !telepipe.placedAt) return false;
  return Date.now() - telepipe.placedAt < PORTAL_PLACEMENT_GRACE_MS;
}

function cardChoiceDescription(def) {
  if (!def) return '';
  const windUpMs = def.windUpMs || 0;
  if (windUpMs > 0 && def.damage > 0) {
    const template = def.type === 'weapon'
      ? THEME.cardDescriptions.damageWeaponWindup
      : THEME.cardDescriptions.damageSpellWindup;
    return template
      .replace('{damage}', String(def.damage))
      .replace('{windUpMs}', String(windUpMs));
  }
  if (def.specialEffect) return def.specialEffect.replace(/_/g, ' ');
  if (def.type === 'weapon') {
    return THEME.cardDescriptions.damageWeapon.replace('{damage}', String(def.damage || 0));
  }
  if (def.type === 'spell') return THEME.cardDescriptions.summonAlly;
  if (def.type === 'creature') return THEME.cardDescriptions.spawnMinion;
  return `${def.type} card`;
}

function getEnemyCardDrop(enemy) {
  if (!enemy) return null;
  if (typeof enemy.cardDrop === 'string' && CARD_DEFS[enemy.cardDrop]) {
    return enemy.cardDrop;
  }
  if (!enemy.type) return null;
  const cardId = ENEMY_CARD_DROPS[enemy.type];
  return cardId && CARD_DEFS[cardId] ? cardId : null;
}

function recordEnemyCardDrop(state, enemy) {
  const cardId = getEnemyCardDrop(enemy);
  if (!cardId) return;

  const playerId = enemy.lastDamagedBy;
  const player = playerId ? state.players[playerId] : null;
  if (!player) return;

  if (!Array.isArray(player.runCardDropIds)) {
    player.runCardDropIds = [];
  }
  player.runCardDropIds.push(cardId);

  // Variant enemies guarantee a bonus card drop on top of their normal one.
  // The normal type→card mapping is reused; the variant just adds the bonus.
  const bonus = getVariantBonusDrop(enemy);
  if (bonus && bonus.card) {
    player.runCardDropIds.push(cardId);
  }
}

function getEnemyMagicStoneDrop(enemy) {
  if (!enemy || !enemy.type) return 0;
  return ENEMY_MS_DROPS[enemy.type] ?? 15;
}

function getEnemyCurrencyDrop(enemy) {
  if (!enemy || !enemy.type) return 0;
  const msDrop = getEnemyMagicStoneDrop(enemy);
  if (msDrop <= 0) return 0;
  const pctRange = (ENEMY_CURRENCY_DROP_PCT_MAX - ENEMY_CURRENCY_DROP_PCT_MIN) / 100;
  const pct = (ENEMY_CURRENCY_DROP_PCT_MIN / 100) + Math.random() * pctRange;
  return Math.max(1, Math.floor(msDrop * pct));
}

function spawnMagicStoneDrop(state, enemy) {
  const value = getEnemyMagicStoneDrop(enemy);
  if (value > 0) {
    const id = crypto.randomUUID();
    state.loot.push({
      id,
      x: enemy.x + LOOT_DROP_OFFSET_MS.x,
      z: enemy.z + LOOT_DROP_OFFSET_MS.z,
      value,
      kind: 'magic_stone',
      createdAt: Date.now(),
    });
    console.log(`[loot] magic stone drop id=${id} value=${value} at (${enemy.x.toFixed(1)}, ${enemy.z.toFixed(1)})`);
  }

  // Variant enemies drop a guaranteed bonus magic stone beyond the normal one.
  // Magnitude comes from the variant registry def, not a hard-coded value here.
  const bonus = getVariantBonusDrop(enemy);
  const bonusValue = bonus ? Number(bonus.magicStone) : 0;
  if (bonusValue > 0) {
    const bonusId = crypto.randomUUID();
    state.loot.push({
      id: bonusId,
      x: enemy.x - LOOT_DROP_OFFSET_MS.x,
      z: enemy.z - LOOT_DROP_OFFSET_MS.z,
      value: bonusValue,
      kind: 'magic_stone',
      createdAt: Date.now(),
    });
    console.log(`[loot] variant bonus magic stone drop id=${bonusId} value=${bonusValue} at (${enemy.x.toFixed(1)}, ${enemy.z.toFixed(1)})`);
  }
}

function spawnCurrencyDrop(state, enemy) {
  if (Math.random() >= ENEMY_CURRENCY_DROP_CHANCE) return;

  const value = getEnemyCurrencyDrop(enemy);
  if (value <= 0) return;

  const id = crypto.randomUUID();
  state.loot.push({
    id,
    x: enemy.x + LOOT_DROP_OFFSET_CURRENCY.x,
    z: enemy.z + LOOT_DROP_OFFSET_CURRENCY.z,
    value,
    kind: 'currency',
    createdAt: Date.now(),
  });
  console.log(`[loot] currency drop id=${id} value=${value} at (${enemy.x.toFixed(1)}, ${enemy.z.toFixed(1)})`);
}

function buildCardChoices(state, playerId) {
  const player = state.players[playerId];
  if (!player || !Array.isArray(player.runCardDropIds)) return [];

  const uniqueIds = [];
  for (const cardId of player.runCardDropIds) {
    if (!CARD_DEFS[cardId]) continue;
    if (!uniqueIds.includes(cardId)) uniqueIds.push(cardId);
    if (uniqueIds.length >= MAX_CARD_CHOICES) break;
  }

  return uniqueIds.map((cardId) => {
    const def = CARD_DEFS[cardId];
    return {
      id: cardId,
      name: def.name,
      type: def.type,
      description: cardChoiceDescription(def),
    };
  });
}

function claimCardReward(state, playerId, cardId) {
  const player = state.players[playerId];
  if (!player || typeof cardId !== 'string') {
    return { ok: false, reason: 'invalid' };
  }
  if (player.claimedCardRewardId) {
    return { ok: false, reason: 'already_claimed' };
  }

  const choices = player.pendingCardChoices || [];
  if (!choices.some((choice) => choice.id === cardId)) {
    return { ok: false, reason: 'invalid_choice' };
  }

  if (!grantCard(player, cardId)) {
    return { ok: false, reason: 'grant_failed' };
  }

  player.claimedCardRewardId = cardId;
  return {
    ok: true,
    cardId,
    ownedCards: player.ownedCards,
    inventory: player.inventory,
  };
}

function clampObjectiveProgress(run) {
  if (!run?.objective) return;
  const def = getObjectiveDef(run.objective.type);
  if (def?.clampProgress) {
    def.clampProgress(run);
    return;
  }
  if (run.objective.totalEnemies != null && run.objective.defeatedEnemies != null) {
    run.objective.defeatedEnemies = Math.min(run.objective.defeatedEnemies, run.objective.totalEnemies);
  }
}

function syncRunObjectiveToEnemies(state) {
  if (!state.run) return;
  const def = getObjectiveDef(state.run.objective.type);
  if (!def?.syncToEnemyCount) return;
  def.syncToEnemyCount(state.run, state.enemies.length);
}

function recordEnemyDefeated(state, count = 1) {
  if (!state.run) return;
  const def = getObjectiveDef(state.run.objective.type);
  if (!def?.onEnemyDefeated) return;
  def.onEnemyDefeated(state.run, count);
}

function recordCrystalCollected(state, count = 1) {
  if (!state.run) return;
  const def = getObjectiveDef(state.run.objective.type);
  if (!def?.onCrystalCollected) return;
  def.onCrystalCollected(state.run, count);
}

function isRunObjectiveComplete(state, objective) {
  const def = getObjectiveDef(objective.type);
  if (!def) {
    throw new Error(`Unknown objective type: ${objective.type}`);
  }
  return def.isComplete(objective, state.run);
}

function buildRunSummary(state, status) {
  const run = state.run;
  if (!run) return null;

  const players = Object.entries(state.players).map(([id, p]) => ({
    id,
    hp: p.hp,
    dead: p.dead,
    currency: p.currency,
    rewards: buildPlayerRewardSummary(state, id),
    cardChoices: p.pendingCardChoices || [],
  }));

  return {
    runId: run.id,
    status,
    durationMs: Date.now() - run.startedAt,
    questId: run.questId,
    questTier: run.questTier ?? DEFAULT_QUEST_TIER,
    questName: run.questName,
    objective: { ...run.objective },
    players,
    defeatedEnemies: run.objective.defeatedEnemies ?? 0,
    currencyCollected: players.reduce((sum, p) => sum + p.currency, 0),
    rewards: {
      currency: run.rewardCurrency ?? 0
    }
  };
}

function grantRunRewards(state, playerId, summary) {
  const player = state.players[playerId];
  if (!player) return;

  const lootCurrency = player.currencyEarnedThisRun || 0;

  if (summary.status === 'victory') {
    const quest = state.run && state.run.questId
      ? getQuest(state.run.questId, state.run.questTier)
      : getSelectedQuest(state);
    const currencyBonus = (quest && quest.rewardCurrency) || 10;
    player.currency += currencyBonus;

    const cardChoices = buildCardChoices(state, playerId);
    player.pendingCardChoices = cardChoices;

    const cards = [];
    if (cardChoices.length === 0) {
      if (!state._victoryCounters) state._victoryCounters = {};
      const idx = state._victoryCounters[playerId] || 0;
      const cardId = VICTORY_REWARD_ROTATION[idx % VICTORY_REWARD_ROTATION.length];
      state._victoryCounters[playerId] = idx + 1;

      if (grantCard(player, cardId)) {
        const cardDef = CARD_DEFS[cardId];
        cards.push({ id: cardId, name: cardDef.name, count: 1 });
      }
    }

    player.runRewards = {
      currency: currencyBonus + lootCurrency,
      cards,
      cardChoices,
    };
  } else {
    player.pendingCardChoices = [];
    player.runRewards = {
      currency: lootCurrency,
      cards: [],
      cardChoices: [],
    };
  }
}

function buildPlayerRewardSummary(state, playerId) {
  const player = state.players[playerId];
  if (!player || !player.runRewards) return { currency: 0, cards: [] };
  return player.runRewards;
}

/** Non-mutating preview of rewards if the player returns to guild with the current run state. */
function previewReturnRewards(state, playerId) {
  const player = state.players[playerId];
  if (!player || !state.run || !isPlayingPhase(state) || !state.run.objective) {
    return null;
  }

  const run = state.run;
  const lootCurrency = player.currencyEarnedThisRun || 0;
  const objectiveComplete = isRunObjectiveComplete(state, run.objective);
  const quest = run.questId
    ? getQuest(run.questId, run.questTier)
    : getSelectedQuest(state);
  const questBonus = (quest && quest.rewardCurrency) || run.rewardCurrency || 10;

  const base = {
    lootCurrency,
    objectiveComplete,
    runStatus: run.status,
    questBonus,
    giveUpForfeitsCurrency: lootCurrency,
  };

  if (player.runRewards) {
    const rewards = player.runRewards;
    return {
      ...base,
      granted: true,
      currency: rewards.currency || 0,
      cards: (rewards.cards || []).map((c) => ({
        id: c.id,
        name: c.name,
        count: c.count > 1 ? c.count : 1,
      })),
      cardChoices: (rewards.cardChoices || []).map((c) => ({
        id: c.id,
        name: c.name,
      })),
    };
  }

  if (objectiveComplete) {
    const cardChoices = buildCardChoices(state, playerId);
    const cards = [];
    if (cardChoices.length === 0) {
      cards.push({ id: null, name: 'Bonus card' });
    }
    return {
      ...base,
      granted: false,
      currency: questBonus + lootCurrency,
      cards,
      cardChoices: cardChoices.map((c) => ({ id: c.id, name: c.name })),
    };
  }

  return {
    ...base,
    granted: false,
    currency: lootCurrency,
    cards: [],
    cardChoices: [],
  };
}

function spawnEnemy(state, x, z, type = 'grunt', spawnedBy, opts = {}) {
  const def = enemyDefFor(type);
  const { hp, name, description, surfacedStats, ...statFieldsFromDef } = def;
  const enemy = {
    id: crypto.randomUUID(),
    x,
    z,
    type,
    ...statFieldsFromDef,
    hp: def.hp,
    maxHp: def.hp,
    state: 'idle',
    attackState: 'idle',
    wanderTarget: { x, z }
  };
  if (type === 'spawner') {
    enemy.lastSpawnTime = Date.now();
  }
  if (spawnedBy !== undefined) {
    enemy.spawnedBy = spawnedBy;
  }
  // Variant seam, centralized so every spawned enemy exposes `variant` (a tag or
  // null — never undefined). Callers pass the spawn room's encounterTier via
  // opts.tier; quest-tier scaling is resolved here from the active run (or lobby
  // selection). Ad-hoc spawns with no room default encounterTier 0. Rolled once.
  const encounterTier = Number.isFinite(opts.tier) ? opts.tier : 0;
  const questTier = state.run?.questTier ?? state.selectedQuestTier ?? DEFAULT_QUEST_TIER;
  const rollTier = resolveVariantRollTier(questTier, encounterTier);
  applyVariant(enemy, rollTier, opts.rng);
  // Difficulty scaling: miniboss-tier bosses get more HP the larger the party is at spawn.
  // Fixed once here from the live player count — never re-applied retroactively
  // when players later join or leave. 1–4 players stay at baseline (factor 1.0).
  if (type === 'miniboss' || type === 'annex_overseer' || type === 'spire_warden') {
    const factor = difficultyScaleFactor(runPlayerCount(state), DIFFICULTY_MINIBOSS_HP_PER_PLAYER);
    enemy.hp = Math.round(enemy.hp * factor);
    enemy.maxHp = Math.round(enemy.maxHp * factor);
  }
  state.enemies.push(enemy);
  return enemy;
}

function removeDeadEnemies(state) {
  const dying = state.enemies.filter((e) => e.hp <= 0);
  for (const enemy of dying) {
    recordEnemyCardDrop(state, enemy);
    spawnMagicStoneDrop(state, enemy);
    spawnCurrencyDrop(state, enemy);
    // Volatile-variant enemies detonate a radial blast where they fall before
    // being filtered out of the enemy list.
    const variantDef = enemy.variant ? VARIANT_DEFS[enemy.variant] : null;
    if (variantDef && variantDef.id === 'volatile') {
      spawnVolatileExplosion(enemy.x, enemy.z, variantDef);
    }
  }

  const bossId = getEncounterBossId(state.run);
  if (bossId) {
    const bossDying = dying.find((e) => e.id === bossId);
    if (bossDying) {
      onStageBossDefeated(state, bossDying);
    }
  }

  const before = state.enemies.length;
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  const removed = before - state.enemies.length;
  if (removed > 0) {
    recordEnemyDefeated(state, removed);
  }
  return removed;
}

function cleanupAfterDamage(state) {
  if (removeDeadEnemies(state) > 0) {
    checkRunTerminalState(state);
  }
}

/**
 * True for the open-plaza / single-room arena: no room carries a 'combat' or
 * 'treasure' role, so room-relative placement has no role rooms to target and
 * spawning must instead scatter across the open floor with cover-aware sampling.
 */
function isOpenFloorLayout(layout) {
  return roomsByRole(layout, 'combat').length === 0 &&
         roomsByRole(layout, 'treasure').length === 0;
}

function isSunkenCanyonLayout(layout) {
  return !!(layout && layout.profile === 'sunken-canyon');
}

function sunkenCanyonRoomsByBand(layout, band) {
  return layout.rooms.filter(r => r.band === band);
}

function isSpireAscentLayout(layout) {
  return !!(layout && layout.profile === 'spire-ascent');
}

function spireAscentRoomsByTier(layout, tierIndex) {
  return layout.rooms.filter(r => r.band === 'tier' && r.tierIndex === tierIndex);
}

function spireAscentMaxTierIndex(layout) {
  const tiers = layout.rooms.filter(r => r.band === 'tier');
  if (tiers.length === 0) return 0;
  return Math.max(...tiers.map(r => r.tierIndex));
}

function spireAscentTopTierRooms(layout) {
  return spireAscentRoomsByTier(layout, spireAscentMaxTierIndex(layout));
}

function spawnCrystals(state, layout, rng, count) {
  const itemCount = Math.max(1, count | 0);
  const treasureRooms = roomsByRole(layout, 'treasure');
  const eligibleRooms = layout.rooms.filter(r => r.role !== 'start');
  // Open-plaza / no-role layouts have no treasure/combat room to target, so
  // place objectives across the open floor with the cover-aware helper.
  const openFloor = isOpenFloorLayout(layout);
  const sunkenCanyon = isSunkenCanyonLayout(layout);
  const spireAscent = isSpireAscentLayout(layout);
  const roomPool = [];

  if (spireAscent) {
    const topRooms = spireAscentTopTierRooms(layout);
    if (topRooms.length > 0) {
      roomPool.push(...topRooms);
    } else if (treasureRooms.length > 0) {
      roomPool.push(treasureRooms[0]);
    }
  } else if (sunkenCanyon) {
    const canyonRooms = sunkenCanyonRoomsByBand(layout, 'canyon');
    if (canyonRooms.length > 0) {
      roomPool.push(...canyonRooms);
    } else if (treasureRooms.length > 0) {
      roomPool.push(treasureRooms[0]);
    }
  } else if (treasureRooms.length > 0) {
    roomPool.push(treasureRooms[0]);
  }

  if (!sunkenCanyon && !spireAscent) {
    const others = eligibleRooms.filter(r => !roomPool.includes(r));
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    roomPool.push(...others);
  }

  if (roomPool.length === 0 && layout.rooms.length > 0) {
    roomPool.push(layout.rooms[0]);
  }

  for (let i = 0; i < itemCount; i++) {
    let pos;
    if (openFloor) {
      pos = pickFloorSpawnPosition(layout, rng);
    } else {
      const room = roomPool[i % roomPool.length];
      const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
      const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
      pos = {
        x: room.x + (rng() * 2 - 1) * halfW,
        z: room.z + (rng() * 2 - 1) * halfD,
      };
    }
    const id = crypto.randomUUID();
    state.loot.push({
      id,
      x: pos.x,
      z: pos.z,
      value: 0,
      kind: 'crystal',
      createdAt: Date.now(),
    });
    console.log(`[crystal] spawned id=${id} at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
  }
}

function randomPositionInRoom(room, rng) {
  const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
  const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
  return {
    x: room.x + (rng() * 2 - 1) * halfW,
    z: room.z + (rng() * 2 - 1) * halfD,
  };
}

function nearestCombatRoom(layout) {
  const startRoom = layout.rooms.find(r => r.role === 'start') || layout.rooms[0];
  const combatRooms = roomsByRole(layout, 'combat');
  if (!startRoom || combatRooms.length === 0) return null;

  let nearest = combatRooms[0];
  let nearestDist = Infinity;
  for (const room of combatRooms) {
    const dist = Math.hypot(room.x - startRoom.x, room.z - startRoom.z);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = room;
    }
  }
  return nearest;
}

function pickSunkenCanyonEnemySpawn(layout, rng, spawnIndex, enemyCount) {
  const plateauRooms = sunkenCanyonRoomsByBand(layout, 'plateau');
  const canyonRooms = sunkenCanyonRoomsByBand(layout, 'canyon');
  const plateauSlots = enemyCount >= 2 ? 2 : 1;

  if (spawnIndex < plateauSlots && plateauRooms.length > 0) {
    const room = plateauRooms[Math.floor(rng() * plateauRooms.length)];
    return randomPositionInRoom(room, rng);
  }

  if (canyonRooms.length > 0) {
    const room = canyonRooms[Math.floor(rng() * canyonRooms.length)];
    return randomPositionInRoom(room, rng);
  }

  if (plateauRooms.length > 0) {
    const room = plateauRooms[Math.floor(rng() * plateauRooms.length)];
    return randomPositionInRoom(room, rng);
  }

  return pickFloorSpawnPosition(layout, rng);
}

function pickSpireAscentEnemySpawn(layout, rng, spawnIndex, enemyCount) {
  const tierRooms = layout.rooms.filter(r => r.band === 'tier');
  const maxTier = spireAscentMaxTierIndex(layout);
  const bottomRooms = spireAscentRoomsByTier(layout, 0);
  const topRooms = spireAscentRoomsByTier(layout, maxTier);
  const middleRooms = tierRooms.filter(r => r.tierIndex > 0 && r.tierIndex < maxTier);
  const forceBottom = 1;
  const forceTop = enemyCount >= 2 ? 1 : 0;

  if (spawnIndex < forceBottom && bottomRooms.length > 0) {
    const room = bottomRooms[Math.floor(rng() * bottomRooms.length)];
    return randomPositionInRoom(room, rng);
  }

  if (spawnIndex < forceBottom + forceTop && topRooms.length > 0) {
    const room = topRooms[Math.floor(rng() * topRooms.length)];
    return randomPositionInRoom(room, rng);
  }

  const fillPool = middleRooms.length > 0
    ? [...middleRooms, ...bottomRooms]
    : [...bottomRooms, ...topRooms];
  if (fillPool.length > 0) {
    const room = fillPool[Math.floor(rng() * fillPool.length)];
    return randomPositionInRoom(room, rng);
  }

  return pickFloorSpawnPosition(layout, rng);
}

function pickEnemySpawnPosition(layout, rng, preferNearestCombat, spawnIndex = 0, enemyCount = 1) {
  if (isSunkenCanyonLayout(layout)) {
    return pickSunkenCanyonEnemySpawn(layout, rng, spawnIndex, enemyCount);
  }

  if (isSpireAscentLayout(layout)) {
    return pickSpireAscentEnemySpawn(layout, rng, spawnIndex, enemyCount);
  }

  if (preferNearestCombat) {
    const nearest = nearestCombatRoom(layout);
    if (nearest) return randomPositionInRoom(nearest, rng);
  }

  const combatRooms = roomsByRole(layout, 'combat');

  if (combatRooms.length > 0) {
    return randomRoomPositionByRole(layout, 'combat', rng);
  }
  // Open-plaza / no-role layouts: place enemies across the open floor with a
  // seeded, cover-aware sampler so they never land inside a pillar or wall.
  if (isOpenFloorLayout(layout)) {
    return pickFloorSpawnPosition(layout, rng);
  }
  const nonStartRooms = layout.rooms.filter(r => r.role !== 'start');
  if (nonStartRooms.length > 0) {
    const room = nonStartRooms[Math.floor(rng() * nonStartRooms.length)];
    return randomPositionInRoom(room, rng);
  }
  return pickFloorSpawnPosition(layout, rng);
}

/**
 * Resolve the encounterTier (0–1) of the room containing point (x, z). Used to
 * scale the enemy-variant roll: start/treasure rooms are tier 0 (never roll a
 * variant). Returns 0 when no containing room is found.
 */
function roomTierAt(layout, x, z) {
  if (!layout || !Array.isArray(layout.rooms)) return 0;
  for (const room of layout.rooms) {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    if (x >= room.x - halfW && x <= room.x + halfW &&
        z >= room.z - halfD && z <= room.z + halfD) {
      return Number.isFinite(room.encounterTier) ? room.encounterTier : 0;
    }
  }
  return 0;
}

function buildObjectiveSpawnCtx(state) {
  return {
    spawnEnemy: (x, z, type, spawnedBy, opts) => spawnEnemy(state, x, z, type, spawnedBy, opts),
    pickEnemySpawnPosition,
    roomTierAt,
    randomWanderTarget,
    spawnCrystals: (layout, rng, count) => spawnCrystals(state, layout, rng, count),
    mulberry32,
  };
}

function spawnCombatEnemies(state, layout, rng, quest) {
  const def = getObjectiveDef(quest.objectiveType);
  if (def?.skipBulkCombatSpawn?.(quest)) return;

  // Draw each enemy's type from the quest's per-level pool so each level spawns
  // only its thematically-appropriate enemies (and level-exclusive types like
  // `spawner` never leak into other levels). Uses the run's seeded `rng` so
  // type selection stays deterministic for a given seed.
  const enemyPool = getEnemyPool(quest.id, quest.tier);
  const enemyCount = Number.isFinite(quest.enemyCount) ? quest.enemyCount : enemyPool.length;
  const preferNearest = def?.preferNearestEnemySpawns?.(quest) ?? false;
  const nearbyCount = preferNearest ? Math.min(2, enemyCount) : 0;
  // Level-scoped signature foe: if the quest declares a guaranteed enemy type,
  // force the first spawn to it and draw the rest from the weighted pool as
  // usual. Quests without one (`getGuaranteedEnemyType` → null) are unchanged.
  const guaranteedType = enemyCount > 0 ? getGuaranteedEnemyType(quest.id) : null;

  for (let i = 0; i < enemyCount; i++) {
    const type = i === 0 && guaranteedType ? guaranteedType : pickWeightedEnemyType(enemyPool, rng);
    const useNearest = preferNearest && i < nearbyCount;
    const pos = pickEnemySpawnPosition(layout, rng, useNearest, i, enemyCount);
    // Variant seam (centralized in spawnEnemy): encounterTier from the spawn
    // room is combined with run.questTier inside spawnEnemy; seeded rng here.
    const enemy = spawnEnemy(state, pos.x, pos.z, type, undefined, {
      tier: roomTierAt(layout, pos.x, pos.z),
      rng,
    });
    enemy.wanderTarget = randomWanderTarget();
  }
}

/**
 * Tick-driven spawner for objective types that stagger enemy release (e.g.
 * `survive`). Delegates to the objective registry's `tickSpawns` hook.
 */
function updateSurviveSpawns(state, now = Date.now()) {
  const run = state.run;
  if (!run?.objective || !isPlayingPhase(state)) return;
  if (isEncounterLocked(run)) return;
  const def = getObjectiveDef(run.objective.type);
  if (!def?.tickSpawns) return;
  def.tickSpawns(now, state, buildObjectiveSpawnCtx(state));
}

function updateEncounterTriggers(state) {
  if (!isPlayingPhase(state)) return;
  tryActivateEncounter(state);
}

function spawnLoot(state, layout, rng) {
  if (Math.random() >= LOOT_SPAWN_CHANCE) return;

  const treasureRooms = roomsByRole(layout, 'treasure');
  const nonStartRooms = layout.rooms.filter(r => r.role !== 'start');
  let pos;

  if (isSpireAscentLayout(layout)) {
    const topRooms = spireAscentTopTierRooms(layout);
    if (topRooms.length > 0) {
      const room = topRooms[Math.floor(rng() * topRooms.length)];
      pos = randomPositionInRoom(room, rng);
    } else {
      pos = pickFloorSpawnPosition(layout, rng);
    }
  } else if (isSunkenCanyonLayout(layout)) {
    const canyonRooms = sunkenCanyonRoomsByBand(layout, 'canyon');
    if (canyonRooms.length > 0) {
      const room = canyonRooms[Math.floor(rng() * canyonRooms.length)];
      pos = randomPositionInRoom(room, rng);
    } else {
      pos = pickFloorSpawnPosition(layout, rng);
    }
  } else if (treasureRooms.length > 0) {
    const room = treasureRooms[Math.floor(rng() * treasureRooms.length)];
    const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
    const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
    pos = {
      x: room.x + (rng() * 2 - 1) * halfW,
      z: room.z + (rng() * 2 - 1) * halfD,
    };
  } else if (isOpenFloorLayout(layout)) {
    // Open-plaza fallback: seeded, cover-aware placement across the open floor
    // (no unseeded Math.random() for the position).
    pos = pickFloorSpawnPosition(layout, rng);
  } else if (nonStartRooms.length > 0) {
    const room = nonStartRooms[Math.floor(rng() * nonStartRooms.length)];
    const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
    const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
    pos = {
      x: room.x + (rng() * 2 - 1) * halfW,
      z: room.z + (rng() * 2 - 1) * halfD,
    };
  } else {
    pos = pickFloorSpawnPosition(layout, rng);
  }

  const value = Math.floor(Math.random() * 16) + 5;
  const id = crypto.randomUUID();
  state.loot.push({ id, x: pos.x, z: pos.z, value, createdAt: Date.now() });
  console.log(`[loot] spawned id=${id} value=${value}`);
}

function spawnEnemies(state) {
  const layout = state.layout;
  const seed = state.layoutSeed || 42;
  const rng = mulberry32(seed + 1000);
  const quest = getSelectedQuest(state);
  const def = getObjectiveDef(quest.objectiveType);
  const spawnCtx = buildObjectiveSpawnCtx(state);

  if (def?.spawnQuestEntities) {
    def.spawnQuestEntities(layout, rng, quest, state, spawnCtx);
  }

  spawnCombatEnemies(state, layout, rng, quest);
  spawnLoot(state, layout, rng);
}

function isPlayerActive(player) {
  return !!(player && !player.dead && !player.extracted);
}

function hasActivePlayers(state) {
  return Object.values(state.players).some(isPlayerActive);
}

function cloneHandCards(hand) {
  if (!Array.isArray(hand)) return [];
  return hand.map((card) => (card ? { ...card } : card));
}

function capturePlayerCardState(player) {
  return {
    hand: cloneHandCards(player.hand),
    deck: Array.isArray(player.deck) ? [...player.deck] : [],
    inDesperation: !!player.inDesperation,
    nextDrawAt: player.nextDrawAt ?? null,
    desperationDeck: Array.isArray(player.desperationDeck) ? [...player.desperationDeck] : [],
  };
}

function deepCloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function captureWorldState(state) {
  return {
    enemies: deepCloneJson(state.enemies ?? []),
    minions: deepCloneJson(state.minions ?? []),
    loot: deepCloneJson(state.loot ?? []),
    areaEffects: deepCloneJson(state.areaEffects ?? []),
    iceBalls: deepCloneJson(state.iceBalls ?? []),
    enchantments: deepCloneJson(state.enchantments ?? []),
    telepipe: state.telepipe ? deepCloneJson(state.telepipe) : null,
    layout: state.layout ? deepCloneJson(state.layout) : null,
    layoutSeed: state.layoutSeed ?? null,
    dungeonBounds: state.dungeonBounds ? deepCloneJson(state.dungeonBounds) : null,
  };
}

function captureCardCheckpoint(state) {
  const run = state.run;
  if (!run) return null;

  const checkpoint = {
    run: {
      id: run.id,
      questId: run.questId,
      questTier: run.questTier ?? DEFAULT_QUEST_TIER,
      questName: run.questName,
      objective: run.objective ? deepCloneJson(run.objective) : null,
      status: run.status,
      startedAt: run.startedAt,
    },
    playerStates: {},
    worldState: captureWorldState(state),
  };

  if (run.encounter) {
    checkpoint.run.encounter = deepCloneJson(run.encounter);
  }

  for (const [playerId, player] of Object.entries(state.players)) {
    checkpoint.playerStates[playerId] = capturePlayerCardState(player);
  }

  return checkpoint;
}

function buildSuspendedRunSummary(checkpoint) {
  if (!checkpoint?.run) return null;
  const { run } = checkpoint;
  return {
    questId: run.questId,
    questName: run.questName,
    objective: run.objective ? { ...run.objective } : null,
  };
}

function restoreCardCheckpoint(state) {
  const checkpoint = state.suspendedCheckpoint;
  if (!checkpoint?.run) return;

  state.run = JSON.parse(JSON.stringify(checkpoint.run));

  const all = Object.values(state.players);
  for (const [playerId, player] of Object.entries(state.players)) {
    const saved = checkpoint.playerStates[playerId];
    if (saved) {
      player.hand = cloneHandCards(saved.hand);
      player.deck = Array.isArray(saved.deck) ? [...saved.deck] : [];
      player.inDesperation = !!saved.inDesperation;
      player.nextDrawAt = saved.nextDrawAt ?? null;
      player.desperationDeck = Array.isArray(saved.desperationDeck) ? [...saved.desperationDeck] : [];
    }
    player.extracted = false;
    player.ready = false;
    player.lastMoveTime = Date.now();
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    player.overclockChargesRemaining = 0;
    player.currencyEarnedThisRun = 0;
    player.runRewards = null;
    player.runCardDropIds = [];
    player.pendingCardChoices = null;
    player.claimedCardRewardId = null;
    clearPlayerCardCommitment(player);
  }

  const world = checkpoint.worldState;
  if (world) {
    if (world.layout != null) {
      state.layout = deepCloneJson(world.layout);
    }
    if (world.layoutSeed != null) {
      state.layoutSeed = world.layoutSeed;
    }
    if (world.dungeonBounds != null) {
      state.dungeonBounds = deepCloneJson(world.dungeonBounds);
    }
    if (world.layout != null) {
      getRebuildWallColliders()();
    }

    assignRunSpawnPositions(state, all);

    state.enemies = deepCloneJson(world.enemies ?? []);
    state.minions = deepCloneJson(world.minions ?? []);
    state.loot = deepCloneJson(world.loot ?? []);
    state.areaEffects = deepCloneJson(world.areaEffects ?? []);
    state.iceBalls = deepCloneJson(world.iceBalls ?? []);
    state.enchantments = deepCloneJson(world.enchantments ?? []);
    state.telepipe = world.telepipe ? deepCloneJson(world.telepipe) : null;

    if (state.telepipe) {
      repositionPlayersAwayFromPortal(state, all);
    }
  } else {
    assignRunSpawnPositions(state, all);
  }

  setGamePhase(state, PHASES.PLAYING);

  if (state.run.encounter) {
    ensureEncounterSpawnAnchor(state.run, state.enemies);
  }

  state.suspendedCheckpoint = null;
  console.log('[run] checkpoint restored');

  const io = getIoTarget(state);
  emitLobbyDeploy(io, state, SERVER_TO_CLIENT.START_GAME);
  emitLobbyDeploy(io, state, SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot(state));
}

function suspendRunToLobby(state) {
  if (!state.run || state.run.status !== 'playing') return;

  const questName = state.run.questName || 'unknown';

  state.suspendedCheckpoint = captureCardCheckpoint(state);
  console.log('[run] checkpoint captured');
  console.log(`[run] extracted to hub: ${questName}`);

  resetTransientRunState(state);
  delete state.run;
  setGamePhase(state, PHASES.LOBBY);

  const spawn = hubSpawnPosition(HUB_LAYOUT);
  for (const player of Object.values(state.players)) {
    player.ready = false;
    player.extracted = false;
    revivePlayerInLobby(player);
    player.x = spawn.x;
    player.z = spawn.z;
    player.y = resolveFloorY(sampleFloorY(HUB_LAYOUT, player.x, player.z));
    player.lastMoveTime = Date.now();
    player.pendingSummons = new Set();
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    player.hand = [];
    player.deck = [];
    player.inputActive = false;
    player.inputDx = 0;
    player.inputDz = 0;
    player.invulnerableUntil = 0;
    clearPlayerCardCommitment(player);
  }

  refreshShopOffer(state);

  const suspendedRunSummary = buildSuspendedRunSummary(state.suspendedCheckpoint);
  const io = getIoTarget(state);
  if (io) {
    io.emit(SERVER_TO_CLIENT.RUN_SUSPENDED, suspendedRunSummary);
    io.emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot(state));
  }
  getBroadcastLobbyUpdate()();
}

function abandonSuspendedRun(state) {
  if (!state || !state._lobbyId) {
    throw new Error('abandonSuspendedRun requires lobby context');
  }
  if (!isLobbyPhase(state)) {
    return { ok: false, reason: 'not_lobby' };
  }
  if (!state.suspendedCheckpoint) {
    return { ok: false, reason: 'no_suspended_checkpoint' };
  }

  state.suspendedCheckpoint = null;
  if (state.run) {
    delete state.run;
  }

  for (const player of Object.values(state.players)) {
    player.ready = false;
  }

  const io = getIoTarget(state);
  if (io) {
    const lobbyId = state._lobbyId;
    if (lobbyId) {
      io.to(lobbyId).emit(SERVER_TO_CLIENT.RUN_ABANDONED);
      io.to(lobbyId).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot(state));
    } else {
      io.emit(SERVER_TO_CLIENT.RUN_ABANDONED);
      io.emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot(state));
    }
  }
  getBroadcastLobbyUpdate()();
  return { ok: true };
}

function maybeSuspendRun(state) {
  if (!state.run || state.run.status !== 'playing') return;
  if (hasActivePlayers(state)) return;
  suspendRunToLobby(state);
}

function tryEnterTelepipe(state, playerId) {
  if (!state.run || state.run.status !== 'playing') {
    return { ok: false, reason: 'no_run' };
  }
  if (!state.telepipe) {
    return { ok: false, reason: 'no_portal' };
  }

  const player = state.players[playerId];
  if (!player || player.dead || player.extracted) {
    return { ok: false, reason: 'invalid_player' };
  }

  const dist = Math.hypot(player.x - state.telepipe.x, player.z - state.telepipe.z);
  if (dist > PORTAL_RADIUS) {
    return { ok: false, reason: 'too_far' };
  }

  const now = Date.now();
  if (player.lastTelepipeEnterAt && now - player.lastTelepipeEnterAt < PORTAL_ENTER_COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown' };
  }
  player.lastTelepipeEnterAt = now;

  player.extracted = true;
  player.inputActive = false;
  player.inputDx = 0;
  player.inputDz = 0;
  clearPlayerCardCommitment(player);
  savePlayerData(state, playerId);
  console.log(`[telepipe] player ${playerId} extracted`);

  const io = getIoTarget(state);
  if (io) {
    io.emit(SERVER_TO_CLIENT.PLAYER_EXTRACTED, { playerId });
    io.emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot(state));
  }

  maybeSuspendRun(state);
  return { ok: true };
}

function checkTelepipeProximity(state) {
  if (!state.telepipe || !state.run || state.run.status !== 'playing') return;
  if (isPortalEntryGraceActive(state)) return;

  for (const [playerId, player] of Object.entries(state.players)) {
    if (!isPlayerActive(player)) continue;
    const dist = Math.hypot(player.x - state.telepipe.x, player.z - state.telepipe.z);
    if (dist <= PORTAL_RADIUS) {
      tryEnterTelepipe(state, playerId);
    }
  }
}

function checkRunTerminalState(state) {
  if (!state.run || state.run.status !== 'playing') return;

  let status = null;

  if (isRunObjectiveComplete(state, state.run.objective)) {
    status = 'victory';
  }

  if (!status) {
    const inDungeon = Object.values(state.players).filter((p) => p && !p.extracted);
    if (inDungeon.length > 0 && inDungeon.every((p) => p.dead || p.hp <= 0)) {
      status = 'failed';
    }
  }

  if (!status) {
    const inDungeon = Object.values(state.players).filter((p) => p && !p.extracted);
    if (inDungeon.length > 0 && inDungeon.every(isPlayerOutOfCards)) {
      status = 'failed';
    }
  }

  if (!status) return;

  state.run.status = status;

  if (status === 'victory' && (state.run.questTier ?? DEFAULT_QUEST_TIER) === 1) {
    const questId = state.run.questId;
    if (questId) {
      for (const player of Object.values(state.players)) {
        if (player && player.accountId) {
          unlockQuestTier(player.accountId, questId, 2);
        }
      }
    }
  }

  for (const p of Object.values(state.players)) {
    p.overclockChargesRemaining = 0;
  }

  for (const playerId of Object.keys(state.players)) {
    grantRunRewards(state, playerId, { status });
  }

  for (const playerId of Object.keys(state.players)) {
    savePlayerData(state, playerId);
  }

  const summary = buildRunSummary(state, status);
  const io = getIoTarget(state);
  if (io) {
    io.emit(status === 'victory' ? SERVER_TO_CLIENT.RUN_COMPLETE : SERVER_TO_CLIENT.RUN_FAILED, summary);
  }
}

function resetTransientRunState(state) {
  state.enemies = [];
  state.minions = [];
  state.loot = [];
  state.areaEffects = [];
  state.iceBalls = [];
  state.telepipe = null;
}

function buildPlayerHotSnapshot(id, p) {
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    rotation: p.rotation,
    hp: p.hp,
    dead: p.dead,
    ready: p.ready,
    magicStones: p.magicStones,
    currency: p.currency,
    extracted: !!p.extracted,
    equippedKeyItemId: p.equippedKeyItemId || 'dodge_roll',
    keyItemCooldownRemaining: Math.max(0, (p.keyItemCooldownUntil || 0) - Date.now()),
    overclockChargesRemaining: p.overclockChargesRemaining || 0,
    isInvulnerable: Date.now() < (p.invulnerableUntil || 0),
    isBlocking: Date.now() < (p.blockingUntil || 0),
    blockingUntil: p.blockingUntil || 0,
    blockingYaw: p.blockingYaw || 0,
    barrierDomeUntil: p.barrierDomeUntil || 0,
    barrierDomeRadius: p.barrierDomeRadius || 0,
    smokeBombUntil: p.smokeBombUntil || 0,
    smokeBombRadius: p.smokeBombRadius || 0,
    smokeBombX: p.smokeBombX || 0,
    smokeBombZ: p.smokeBombZ || 0,
    slowedUntil: p.slowedUntil || 0,
    slowFactor: p.slowFactor || 1,
    burningUntil: p.burningUntil || 0,
    cardUseState: p.cardUseState || null,
    cardWindupUntil: p.cardUseState === 'windup' && p.cardWindupStartTime && p.cardWindupMs
      ? (p.pendingCardUse
        ? Math.max(Date.now(), p.cardWindupStartTime + p.cardWindupMs)
        : p.cardWindupStartTime + p.cardWindupMs)
      : 0,
    cardWindupCardId: p.pendingCardUse?.cardId || null,
    cosmetic: p.cosmetic ?? { ...DEFAULT_COSMETIC },
    username: p.username,
  };
}

function buildPlayerColdSnapshot(state, id, p) {
  return {
    deck: p.deck,
    desperationDeck: Array.isArray(p.desperationDeck) ? [...p.desperationDeck] : [],
    hand: p.hand,
    inDesperation: !!p.inDesperation,
    nextDrawAt: p.nextDrawAt ?? null,
    ownedCards: p.ownedCards ?? (p.inventory ? inventoryToOwnedCards(p.inventory) : undefined),
    runRewards: p.runRewards,
    currencyEarnedThisRun: p.currencyEarnedThisRun,
    selectedDeck: p.selectedDeck,
    inventory: p.inventory,
    debugScenario: p.debugScenario,
    returnRewardsPreview: previewReturnRewards(state, id),
  };
}

function buildWorldSnapshot(state, shopOffer) {
  return {
    enemies: state.enemies,
    minions: state.minions,
    loot: state.loot,
    iceBalls: state.iceBalls || [],
    enchantments: (state.enchantments || [])
      .filter((e) => e.armed && e.target === 'ground')
      .map((e) => ({
        id: e.id,
        effect: e.effect,
        x: e.x,
        z: e.z,
        radius: e.radius,
        expiresAt: e.expiresAt,
        armed: e.armed,
      })),
    lobby: state.lobby,
    gamePhase: state.gamePhase,
    selectedQuestId: state.selectedQuestId,
    selectedQuestTier: state.selectedQuestTier ?? DEFAULT_QUEST_TIER,
    run: state.run,
    dungeonBounds: state.dungeonBounds,
    layoutSeed: state.layoutSeed,
    currency: state.currency,
    shopOffer,
    telepipe: state.telepipe || null,
    suspendedRunSummary: state.suspendedCheckpoint
      ? buildSuspendedRunSummary(state.suspendedCheckpoint)
      : null,
  };
}

function hotStateSnapshot(state) {
  const shopOffer = ensureShopOffer(state);

  const players = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = buildPlayerHotSnapshot(id, p);
  }

  return {
    players,
    ...buildWorldSnapshot(state, shopOffer),
  };
}

function stateSnapshot(state) {
  const shopOffer = ensureShopOffer(state);

  const players = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = {
      ...buildPlayerHotSnapshot(id, p),
      ...buildPlayerColdSnapshot(state, id, p),
    };
  }

  return {
    players,
    ...buildWorldSnapshot(state, shopOffer),
  };
}

function returnPlayersToLobby(state) {
  if (!state || !state._lobbyId) {
    throw new Error('returnPlayersToLobby requires lobby context');
  }

  resetTransientRunState(state);

  state.suspendedCheckpoint = null;
  setGamePhase(state, PHASES.LOBBY);
  delete state.run;

  const spawn = hubSpawnPosition(HUB_LAYOUT);
  for (const playerId of Object.keys(state.players)) {
    const player = state.players[playerId];
    const preservedCurrency = player.currency;
    const preservedInventory = player.inventory;
    const preservedOwnedCards = player.ownedCards || inventoryToOwnedCards(player.inventory);
    const preservedRunRewards = player.runRewards;

    revivePlayerInLobby(player);
    player.ready = false;
    player.extracted = false;
    player.x = spawn.x;
    player.z = spawn.z;
    player.y = resolveFloorY(sampleFloorY(HUB_LAYOUT, player.x, player.z));
    player.currency = preservedCurrency;
    player.inventory = preservedInventory;
    player.ownedCards = preservedOwnedCards;
    player.runRewards = preservedRunRewards;
    player.currencyEarnedThisRun = 0;
    player.lastMoveTime = Date.now();
    player.pendingSummons.clear();
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    player.invulnerableUntil = 0;
    player.overclockChargesRemaining = 0;
    clearPlayerCardCommitment(player);
  }

  refreshShopOffer(state);

  if (state._pendingMinionBreaths?.length) {
    state._pendingMinionBreaths.length = 0;
  }

  for (const playerId of Object.keys(state.players)) {
    savePlayerData(state, playerId);
  }

  const io = getIoTarget(state);
  if (io) {
    io.emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot(state));
  }
  getBroadcastLobbyUpdate()();
}

function giveUpRun(state) {
  if (!state || !state._lobbyId) {
    throw new Error('giveUpRun requires lobby context');
  }
  if (!isPlayingPhase(state) || !state.run) {
    return { ok: false, reason: 'no_active_run' };
  }

  resetTransientRunState(state);

  state.suspendedCheckpoint = null;
  setGamePhase(state, PHASES.LOBBY);
  delete state.run;

  const spawn = firstRoomPosition();
  for (const playerId of Object.keys(state.players)) {
    const player = state.players[playerId];
    const earned = player.currencyEarnedThisRun || 0;
    if (earned > 0) {
      player.currency = Math.max(0, (player.currency || 0) - earned);
    }

    revivePlayerInLobby(player);
    player.ready = false;
    player.extracted = false;
    player.x = spawn.x;
    player.z = spawn.z;
    player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
    player.currencyEarnedThisRun = 0;
    player.runRewards = null;
    player.hand = [];
    player.deck = [];
    resetPlayerDesperationState(player);
    player.lastMoveTime = Date.now();
    if (!player.pendingSummons) {
      player.pendingSummons = new Set();
    } else {
      player.pendingSummons.clear();
    }
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    player.inputActive = false;
    player.inputDx = 0;
    player.inputDz = 0;
    player.overclockChargesRemaining = 0;
    clearPlayerCardCommitment(player);
  }

  for (const playerId of Object.keys(state.players)) {
    savePlayerData(state, playerId);
  }

  refreshShopOffer(state);

  if (state._pendingMinionBreaths?.length) {
    state._pendingMinionBreaths.length = 0;
  }

  const io = getIoTarget(state);
  if (io) {
    io.emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot(state));
  }
  getBroadcastLobbyUpdate()();
  return { ok: true };
}

function checkAllReady(state) {
  try {
    checkAllReadyInner(state);
  } catch (err) {
    console.error('[checkAllReady] failed:', err && err.stack ? err.stack : err);
  }
}

function checkAllReadyInner(state) {
  if (!isLobbyPhase(state)) return;

  const all = Object.values(state.players);
  const connectedPlayers = all.filter(p => p.connected !== false);
  const allConnectedReady = connectedPlayers.length > 0 && connectedPlayers.every(p => p.ready);
  const noStaleDisconnectReady = all.every(p => p.connected !== false || !p.ready);
  if (allConnectedReady && noStaleDisconnectReady) {
    const selectedTier = state.selectedQuestTier ?? DEFAULT_QUEST_TIER;
    if (selectedTier >= 2) {
      const questId = state.selectedQuestId;
      let clearedAny = false;
      for (const player of connectedPlayers) {
        if (player.ready && !isQuestTierUnlocked(player.accountId, questId, selectedTier)) {
          player.ready = false;
          clearedAny = true;
        }
      }
      if (clearedAny) {
        getBroadcastLobbyUpdate()();
        return;
      }
    }

    if (!isLobbyPhase(state)) return;

    try {
      if (state.suspendedCheckpoint) {
        restoreCardCheckpoint(state);
        return;
      }

      setGamePhase(state, PHASES.PLAYING);

      assignRunSpawnPositions(state, all);
      for (const player of all) {
        const deployHp = Number.isFinite(player.hp) ? player.hp : null;
        const deployMagicStones = Number.isFinite(player.magicStones) ? player.magicStones : null;
        player.extracted = false;
        player.lastMoveTime = Date.now();
        createDrawDeckFromSelectedDeck(player);
        initPlayerHand(state, player);
        if (player.debugScenario === 'telepipe-ready' || player.debugScenario === 'fire-telepipe-ready') {
          applyTelepipeReadyHand(state, player);
        }
        player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
        if (deployMagicStones != null) {
          player.magicStones = deployMagicStones;
        } else {
          player.magicStones = STARTING_MAGIC_STONES;
        }
        if (deployHp != null) {
          player.hp = deployHp;
        } else {
          player.hp = MAX_HP;
          player.dead = false;
        }
        if (player.debugScenario === 'fire-telepipe-ready' && deployMagicStones != null) {
          player._telepipeDeployMagicStones = deployMagicStones;
          player._msRegenGraceUntil = Date.now() + 120000;
        }
        player.overclockChargesRemaining = 0;
      }
      spawnEnemies(state);
      for (const player of connectedPlayers) {
        if (player.debugScenario === 'fire-telepipe-ready') {
          const dummy = spawnEnemy(state, player.x + 2.5, player.z, 'grunt');
          dummy.hp = 500;
          dummy.maxHp = 500;
          dummy.shieldHp = 0;
          dummy.maxShieldHp = 0;
          dummy.wanderTarget = { x: dummy.x, z: dummy.z };
          break;
        }
      }
      startDungeonRun(state);
      const io = getIoTarget(state);
      emitLobbyDeploy(io, state, SERVER_TO_CLIENT.START_GAME);
      emitLobbyDeploy(io, state, SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot(state));
    } catch (err) {
      console.error('[checkAllReady] deploy failed:', err && err.stack ? err.stack : err);
    }
  }
}
module.exports = {
  CARD_DEFS,
  createRunState,
  startDungeonRun,
  applyTelepipeReadyHand,
  assignRunSpawnPositions,
  clampObjectiveProgress,
  syncRunObjectiveToEnemies,
  recordEnemyDefeated,
  recordCrystalCollected,
  isRunObjectiveComplete,
  buildRunSummary,
  grantRunRewards,
  buildPlayerRewardSummary,
  previewReturnRewards,
  getEnemyCardDrop,
  recordEnemyCardDrop,
  getEnemyMagicStoneDrop,
  getEnemyCurrencyDrop,
  spawnMagicStoneDrop,
  spawnCurrencyDrop,
  buildCardChoices,
  claimCardReward,
  spawnEnemy,
  removeDeadEnemies,
  cleanupAfterDamage,
  spawnLoot,
  spawnCrystals,
  spawnEnemies,
  spawnCombatEnemies,
  updateSurviveSpawns,
  updateEncounterTriggers,
  isPlayerActive,
  hasActivePlayers,
  captureCardCheckpoint,
  restoreCardCheckpoint,
  suspendRunToLobby,
  abandonSuspendedRun,
  maybeSuspendRun,
  tryEnterTelepipe,
  checkTelepipeProximity,
  checkRunTerminalState,
  resetTransientRunState,
  returnPlayersToLobby,
  giveUpRun,
  checkAllReady,
  stateSnapshot,
  hotStateSnapshot,
  buildWorldSnapshot,
};
