const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { THEME } = require('./theme');
const {
  QUEST_DEFS,
  DEFAULT_QUEST_ID,
  isValidQuestId,
  getLayoutProfileForQuest,
  buildQuestUpdatePayload
} = require('./quests');
const { InMemoryProvider, FileProvider } = require('./providers');
const { findUserByAccountId, unlockHat: unlockHatForAccount } = require('./users');
const { DEFAULT_COSMETIC, backfillUnlockedHats, HAT_CATALOG } = require('./cosmetic');
const { verifyToken, initAuth, getJWTSecret } = require('./auth');
const {
  mulberry32,
  generateLayout,
  questLayoutSeed,
  roomsByRole,
  randomRoomPositionByRole,
  GRID_COLS,
  GRID_ROWS,
  CELL_SPACING,
  MIN_ROOM_SIZE,
  MAX_ROOM_SIZE_INCLUSIVE,
  PASSAGE_WIDTH,
  sampleFloorY,
  DEFAULT_FLOOR_Y,
  resolveFloorY,
} = require('./dungeon');
const {
  TICK_RATE,
  MOVE_SPEED,
  MAX_ELAPSED_MS,
  DETECTION_RADIUS,
  ENEMY_ATTACK_RANGE,
  ENEMY_ATTACK_RECOVERY_MS,
  MAX_MAGIC_STONES,
  STARTING_MAGIC_STONES,
  MAGIC_STONES_REGEN_PER_TICK,
  SUMMON_RADIUS,
  ATTACK_RANGE,
  ATTACK_CONE_ANGLE,
  PROJECTILE_HIT_WIDTH,
  STALE_THRESHOLD,
  DISCONNECT_GRACE_MS,
  BOUNDS_MARGIN,
  COOLDOWN_MS,
  SPAWN_PADDING,
  DECK_MIN_SIZE,
  DECK_MAX_SIZE,
  MAX_HP,
  RESPAWN_DELAY_MS,
  LOOT_LIFETIME_MS,
  LOOT_PICKUP_RADIUS,
  LOOT_SPAWN_CHANCE,
  STALE_CLEANUP_INTERVAL_MS,
  PERIODIC_SAVE_INTERVAL_MS,
  VICTORY_REWARD_ROTATION,
  PORTAL_RADIUS,
  PORTAL_PLACEMENT_GRACE_MS,
  MAX_GROUND_ENCHANTMENTS_PER_PLAYER,
  MAX_HAND_SLOTS,
} = require('./config');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust later for production
    methods: ["GET", "POST"]
  }
});
server.setMaxListeners(0);

// Game state factory — used by tests to get a fresh state
function createGameState() {
  return {
    players: {},
    enemies: [],
    minions: [],
    loot: [],
    areaEffects: [],
    enchantments: [],
    lobby: [],
    gamePhase: 'lobby',
    selectedQuestId: DEFAULT_QUEST_ID,
    pendingTrades: {},
    shopOffer: null,
    telepipe: null,
    suspendedCheckpoint: null,
    // Pending Echo Strike packets ({ attackerId, targets:[{enemyId,damage}], applyAt }),
    // applied on a later tick by simulation.processPendingEchoes().
    pendingEchoes: [],
    // Per-tick queue of minion cardUsed payloads; flushed after updateMinions each tick.
    _pendingMinionBreaths: [],
  };
}

// Game state (module-level singleton used by production)
const gameState = createGameState();

// Early partial exports for circular dependency with simulation.js.
// simulation.js requires('./index') and reads gameState, _intervals, _timeouts.
// We initialize module.exports here so the require returns a non-empty object.
// The final module.exports block below merges these with all other exports.
const _intervals = [];
const _timeouts = [];
module.exports._gameState = gameState;
module.exports._intervals = _intervals;
module.exports._timeouts = _timeouts;

// Import simulation module (after early exports to resolve circular dependency)
const {
  computeDungeonBounds,
  computeWalkableAABBs,
  isInsideDungeon,
  firstRoomPosition,
  randomRoomPosition,
  pickFloorSpawnPosition,
  clampToDungeon,
  buildWallColliders,
  rebuildWallColliders,
  getWallColliders,
  wallAABB,
  checkWallCollision,
  resolveWallCollision,
  checkSweptCollision,
  tryPlayerMove,
  applyPlayerMovement,
  flushDirtyPlayerSaves,
  segmentAABBEntryT,
  segmentIntersectsAABB,
  isEntityPositionBlocked,
  moveEntityToward,
  ENTITY_RADIUS,
  PLAYER_RADIUS,
  ENEMY_DEFS,
  MINION_FOLLOW_DISTANCE,
  MINION_FOLLOW_SPEED,
  updateEnemies,
  isPlayerConcealed,
  updateMinions,
  processPendingEchoes,
  damagePlayer,
  damageMinion,
  healPlayer,
  collectConeHits,
  collectRadialHits,
  collectProjectileHits,
  collectReturningProjectileHits,
  applyFreezeInRadius,
  pullEnemiesToward,
  applyKnockback,
  applyPlayerKnockback,
  applyEventHorizon,
  spawnDragonsBreathEffect,
  spawnFireTrailEffect,
  spawnInfernoPillarEffect,
  isEnemyFrozen,
  cleanupStalePlayers,
  regenMagicStones,
  randomWanderTarget,
  nearbySpawnPosition,
  setTerminalCheckCallback,
  setFindSocketCallback,
  setSavePlayerCallback,
  updateEnchantments,
  spawnGroundEnchantment,
  armSelfEnchantment,
  countGroundEnchantmentsForPlayer,
} = require('./simulation');

const progression = require('./progression');
const lobbies = require('./lobbies');
const {
  CARD_DEFS,
  getCardDef,
  KEY_ITEM_DEFS,
  getKeyItemDef,
  getUnlockedKeyItems,
  DESPERATION_CARD_DEFS,
  DESPERATION_DECK_TEMPLATE,
  drawCardFromDesperationDeck,
  initDesperationDeck,
  replaceConsumedCard,
  exhaustHandSlot,
  discardHandSlot,
  drawCardIntoHand,
  ensurePassiveDrawScheduled,
  processPassiveDraws,
  canDrawIntoHand,
  countFilledHandSlots,
  validateDiscardHand,
  beginCreatureBurnDown,
  releaseBurningCreatureCard,
  pickRandomExhaustedCard,
  createEchoCard,
  STARTING_DECK_IDS,
  EVOLUTION_GRIND_REQUIRED,
  EVOLUTION_TRANSFORMS,
  GRIND_COST_BASE,
  GRIND_STAT_SCALE,
  getGrindCost,
  getStatMultiplier,
  scaledGrindStat,
  applyWyrmMinionBreathStats,
  grindCard,
  unlockHatForPlayer,
  createCardInstance,
  createInventoryFromCardIds,
  createInventoryFromOwnedCards,
  normalizeInventory,
  inventoryToOwnedCards,
  normalizeSelectedDeck,
  normalizePlayerInventory,
  getInventoryInstance,
  cardIdForDeckEntry,
  findAvailableInventoryInstance,
  evolveCard,
  getCardSellValue,
  getCardBuyValue,
  ensureShopOffer,
  revivePlayerInLobby,
  healAtMedic,
  buyShopCard,
  pickShopOffer,
  canSellCardInstance,
  sellCard,
  cancelTradesForPlayer,
  offerCardTrade,
  respondCardTrade,
  createPlayerProgress,
  extractPersistentData,
  persistenceKey,
  savePlayerData,
  saveAllPlayers,
  setTestProvider,
  getProvider,
  createRunState,
  startDungeonRun,
  clampObjectiveProgress,
  syncRunObjectiveToEnemies,
  recordEnemyDefeated,
  isRunObjectiveComplete,
  getEnemyCardDrop,
  recordEnemyCardDrop,
  getEnemyMagicStoneDrop,
  getEnemyCurrencyDrop,
  spawnMagicStoneDrop,
  spawnCurrencyDrop,
  buildCardChoices,
  claimCardReward,
  buildRunSummary,
  grantCard,
  grantRunRewards,
  buildPlayerRewardSummary,
  validateDeck,
  canAddCardInstanceToDeck,
  canAddCardToDeck,
  createDrawDeckFromSelectedDeck,
  drawCardFromDeck,
  initPlayerHand,
  drawReplacementCard,
  discardCardFromHand,
  isPlayerOutOfCards,
  validateUseCardHand,
  addMagicStones,
  restoreCardCharges,
  restoreHandCharges,
  spawnEnemy,
  spawnEnemies,
  updateSurviveSpawns,
  spawnLoot,
  spawnCrystals,
  recordCrystalCollected,
  removeDeadEnemies,
  cleanupAfterDamage,
  checkRunTerminalState,
  resetTransientRunState,
  returnPlayersToLobby,
  giveUpRun,
  previewReturnRewards,
  checkAllReady,
  assignRunSpawnPositions,
  stateSnapshot,
  checkTelepipeProximity,
  abandonSuspendedRun,
  captureRunCheckpoint,
  restoreRunCheckpoint,
  suspendRunToLobby,
  maybeSuspendRun,
  tryEnterTelepipe,
  isPlayerActive,
  hasActivePlayers,
  buildSuspendedRunSummary,
  clearSuspendedRunData,
  setGameState: setProgressionGameState,
  getGameState: getProgressionGameState,
  setRebuildWallColliders: setProgressionRebuildWallColliders,
} = progression;

// Card-use dispatch lives in its own module; wired up via setCallbacks() below
// once io and the index.js-local helpers it needs are defined.
const cardEffects = require('./cardEffects');

// Key-item dispatch lives in its own module; wired up via setCallbacks() below
// once io is defined.
const keyItemEffects = require('./keyItemEffects');

const _lobbyContextStack = [];

function withLobbyContext(lobby, fn) {
  if (!lobby || !lobby.state) return fn();
  sim.setGameState(lobby.state, _timeouts);
  setProgressionGameState(lobby.state);
  _lobbyContextStack.push(lobby);
  try {
    return fn();
  } finally {
    _lobbyContextStack.pop();
    const parentLobby = _lobbyContextStack[_lobbyContextStack.length - 1];
    const restoreState = parentLobby ? parentLobby.state : gameState;
    sim.setGameState(restoreState, _timeouts);
    setProgressionGameState(restoreState);
  }
}

function getLobbyForSocket(socket) {
  return lobbies.getLobbyForPlayer(socket.playerId);
}

function broadcastLobbyList() {
  io.emit('lobbyListUpdate', { lobbies: lobbies.listLobbySummaries() });
}

// Initialize simulation and progression modules with gameState and timeouts
const sim = require('./simulation');
sim.setGameState(gameState, _timeouts);
progression.initProgression({ gameState, getIo: () => io });
progression.setRebuildWallColliders(() => rebuildWallColliders());
ensureShopOffer();

// Wire simulation callbacks (so simulation.js can call back into progression).
setTerminalCheckCallback(checkRunTerminalState);
setFindSocketCallback(findSocketByPlayerId);
setSavePlayerCallback(savePlayerData);

// Wire cardEffects with io and the index.js-local helpers the useCard handler needs.
cardEffects.setCallbacks({
  io,
  emitCardError,
  findSacrificeTarget,
  resolveAttackRotation,
});

// Wire keyItemEffects with io (the only index.js-local handle its handler needs).
keyItemEffects.setCallbacks({ io });

function applyLayoutForQuest(state, questId) {
  const profile = getLayoutProfileForQuest(questId);
  const seed = questLayoutSeed(questId);
  state.layoutSeed = seed;
  state.layout = generateLayout(seed, profile, { slopes: true });
  state.dungeonBounds = computeDungeonBounds(state.layout);
  state.walkableAABBs = computeWalkableAABBs(state.layout);
  // rebuildWallColliders reads module-level sim state — wrap even when callers are already
  // inside withLobbyContext, because this helper is also invoked at startup/reset with bare state.
  withLobbyContext({ state }, () => rebuildWallColliders());
  console.log(`[server] Layout for quest "${questId}": seed=${seed}, profile=${profile}, rooms=${state.layout.rooms.length}`);
}

// Generate dungeon layout for the default quest at startup (legacy unit-test gameState)
applyLayoutForQuest(gameState, gameState.selectedQuestId || DEFAULT_QUEST_ID);
console.log(`[server] Dungeon bounds: x [${gameState.dungeonBounds.minX.toFixed(1)}, ${gameState.dungeonBounds.maxX.toFixed(1)}], z [${gameState.dungeonBounds.minZ.toFixed(1)}, ${gameState.dungeonBounds.maxZ.toFixed(1)}]`);

/**
 * Clear all tracked intervals and timeouts. Call before resetting state in tests.
 */
function clearAllTimers() {
  for (const id of _intervals) clearInterval(id);
  _intervals.length = 0;
  for (const id of _timeouts) clearTimeout(id);
  _timeouts.length = 0;
}

function restartBackgroundTimers() {
  if (_intervals.length > 0) return;
  _intervals.push(setInterval(runGameLoopTick, 1000 / TICK_RATE));
  _intervals.push(setInterval(cleanupStalePlayersInAllLobbies, STALE_CLEANUP_INTERVAL_MS));
  _intervals.push(setInterval(evictDisconnectedPlayers, STALE_CLEANUP_INTERVAL_MS));
  _intervals.push(setInterval(saveAllPlayersInAllLobbies, PERIODIC_SAVE_INTERVAL_MS));
}

function cleanupStalePlayersInAllLobbies() {
  for (const lobby of lobbies._lobbies.values()) {
    withLobbyContext(lobby, () => cleanupStalePlayers());
  }
}

function saveAllPlayersInAllLobbies() {
  for (const lobby of lobbies._lobbies.values()) {
    withLobbyContext(lobby, () => saveAllPlayers());
  }
}

/**
 * Reset gameState to a fresh state. Used by integration tests to isolate tests.
 * Regenerates dungeon layout using the quest-derived seed from applyLayoutForQuest.
 */
function resetGameState() {
  _lobbyContextStack.length = 0;
  lobbies.resetAllLobbies();
  const fresh = createGameState();
  const questId = fresh.selectedQuestId || DEFAULT_QUEST_ID;
  Object.keys(gameState).forEach(k => delete gameState[k]);
  Object.assign(gameState, fresh);
  applyLayoutForQuest(gameState, questId);
  delete gameState.run;
  delete gameState._victoryCounters;
  sim.setGameState(gameState, _timeouts);
  setProgressionGameState(gameState);
  ensureShopOffer();
}

const DEBUG_SCENARIOS = new Set([
  'summon-low-mana',
  'summon-ready',
  'summon-recall',
  'combat-damaged-player',
  'custom-avatar-demo',
  'avatar-proportions-demo',
  'avatar-wizard-hat',
  'mixed-enemies',
  'variant-enemy',
  'spawner-active',
  'monster-card',
  'minion-combat',
  'run-failed',
  'run-exhausted',
  'quest-objective-near-complete',
  'telepipe-ready',
  'sloped-dungeon',
  'key-item-cooldown',
  'medic-kit-ready',
  'guard-block-ready',
  'flare-beacon-ready',
  'loot-magnet-ready',
  'overclock-ready',
  'phase-step-ready',
  'echo-strike-ready',
  'smoke-bomb-ready',
  'rally-cry-ready',
  'open-plaza-arena',
  'sunken-canyon',
  'sunken-canyon-stage',
  'spire-ascent',
  'spire-ascent-stage',
  'hat-shop-currency',
  'hats-unlocked',
  'deck-viewer-instances',
]);

// Helper: build a compact player list for lobbyUpdate payloads
function lobbyPlayerList(state) {
  return Object.entries(state.players).map(([id, p]) => ({
    id,
    ready: p.ready
  }));
}

// Helper: broadcast lobbyUpdate to clients in a lobby room
function broadcastLobbyUpdate(lobby) {
  const activeState = getProgressionGameState();
  if (!lobby && activeState && activeState._lobbyId) {
    lobby = lobbies.getLobbyById(activeState._lobbyId);
  }
  if (!lobby) {
    if (!activeState || Object.keys(activeState.players).length === 0) return;
    withLobbyContext({ state: activeState }, () => {
      ensureShopOffer();
      io.emit('lobbyUpdate', {
        players: lobbyPlayerList(activeState),
        gamePhase: activeState.gamePhase,
        shopOffer: activeState.shopOffer,
        ...buildQuestUpdatePayload(activeState),
      });
    });
    broadcastLobbyList();
    return;
  }
  withLobbyContext(lobby, () => {
    ensureShopOffer();
    io.to(lobby.id).emit('lobbyUpdate', {
      lobbyId: lobby.id,
      players: lobbyPlayerList(lobby.state),
      gamePhase: lobby.state.gamePhase,
      shopOffer: lobby.state.shopOffer,
      ...buildQuestUpdatePayload(lobby.state)
    });
  });
  broadcastLobbyList();
}

progression.setBroadcastLobbyUpdate(broadcastLobbyUpdate);

// Helper: find a live Socket.IO socket by the stable playerId assigned on connect.
// Socket.IO keys sockets by socket.id (a random string), not by playerId,
// so we must iterate and match on socket.playerId.
function findSocketByPlayerId(playerId) {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.playerId === playerId) {
      return socket;
    }
  }
  return null;
}

function isDebugScenarioAllowed(socket) {
  if (process.env.ALLOW_DEBUG_SCENARIOS === '1') return true;
  if (process.env.NODE_ENV === 'production') return false;

  const address = socket.handshake.address || '';
  const origin = socket.handshake.headers.origin || '';
  const host = socket.handshake.headers.host || '';
  const localAddress = address === '::1' || address === '127.0.0.1' || address.endsWith('127.0.0.1');
  const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);

  return localAddress || localOrigin || localHost;
}

function ensureNearbyEnemy(state, x, z) {
  const nearby = state.enemies.some(enemy => Math.hypot(enemy.x - x, enemy.z - z) < 6);
  if (nearby) return;

  const enemy = spawnEnemy(x + 3, z, 'grunt');
  enemy.wanderTarget = { x: x + 3, z };
}

function emitCardError(socket, reason) {
  console.log(`[cardError] player ${socket.playerId}: ${reason}`);
  socket.emit('cardError', { reason });
}

const DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN = new Set([
  'mixed-enemies',
  'variant-enemy',
  'spawner-active',
  'minion-combat',
  'run-exhausted',
  'quest-objective-near-complete',
]);

function shouldSkipDefaultEnemySpawn(state) {
  return Object.values(state.players).some(
    (p) => p && p.debugScenario && DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN.has(p.debugScenario)
  );
}

function enterPlayingPhase(lobby) {
  const state = lobby.state;
  if (state.gamePhase !== 'playing') {
    state.gamePhase = 'playing';
    for (const player of Object.values(state.players)) {
      if (!player.hand || player.hand.length === 0) {
        createDrawDeckFromSelectedDeck(player);
        initPlayerHand(player);
      }
    }
    if (!shouldSkipDefaultEnemySpawn(state)) {
      spawnEnemies();
    }
    startDungeonRun();
    io.to(lobby.id).emit('startGame');
    broadcastLobbyList();
  }
}

function applyDebugScenario(socket, name) {
  const lobby = getLobbyForSocket(socket);
  if (!lobby) return { ok: false, reason: 'Not in a lobby' };
  const state = lobby.state;

  if (!DEBUG_SCENARIOS.has(name)) {
    return { ok: false, reason: `Unknown debug scenario: ${name}` };
  }

  const player = state.players[socket.playerId];
  if (!player) return { ok: false, reason: 'No player for debug scenario' };
  const spawn = firstRoomPosition();

  return withLobbyContext(lobby, () => {
    normalizePlayerInventory(player);
    const result = validateDeck(player.selectedDeck, player.inventory);
    if (!result.valid) return { ok: false, reason: result.reason };

    player.dead = false;
    player.firstMoveAfterSpawn = false;
    player.lastMoveTime = Date.now();
    player.debugScenario = name;
    player.pendingSummons.clear();

    if (name === 'telepipe-ready') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      return { ok: true, scenario: name };
    }

    if (name === 'hat-shop-currency') {
      // Stay in the lobby with enough currency to unlock any catalog hat,
      // so the unlockHat flow can be exercised without grinding runs first.
      // The same state is reachable normally by earning currency in dungeons.
      state.gamePhase = 'lobby';
      player.ready = false;
      player.hp = MAX_HP;
      player.currency = Math.max(player.currency || 0, 1000);
      return { ok: true, scenario: name };
    }

    if (name === 'hats-unlocked') {
      // Persist a couple of catalog-hat unlocks on the account (leaving at least
      // one hat locked) so the customization panel's equip flow can be exercised
      // on owned, non-'none' hats — and the locked-hat branch too — without
      // grinding currency and unlocking each hat first. The returned
      // `unlockedHats` lets the client refresh its cached owned set. The same
      // owned state is reachable normally by earning currency and unlocking hats
      // via the unlock/shop flow.
      state.gamePhase = 'lobby';
      player.ready = false;
      player.hp = MAX_HP;
      // Leave the last catalog hat locked so both owned and locked entries show.
      const toUnlock = HAT_CATALOG.filter((h) => h.id !== 'none').slice(0, -1);
      let unlockedHats = backfillUnlockedHats(null);
      for (const hat of toUnlock) {
        const r = unlockHatForAccount(player.accountId, hat.id);
        if (r.ok) unlockedHats = r.unlockedHats;
      }
      return { ok: true, scenario: name, unlockedHats };
    }

    player.ready = true;
    player.x = spawn.x;
    player.z = spawn.z;
    player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
    enterPlayingPhase(lobby);

    if (state.gamePhase === 'playing' && (!player.hand || player.hand.length === 0)) {
      createDrawDeckFromSelectedDeck(player);
      initPlayerHand(player);
      player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
      if (!player.pendingSummons) {
        player.pendingSummons = new Set();
      }
    }

    ensureNearbyEnemy(state, player.x, player.z);

    if (name === 'summon-low-mana') {
      player.hp = MAX_HP;
      player.magicStones = 0;
    } else if (name === 'summon-ready') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      if (!player.hand.some(c => c && c.type === 'spell')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'spell');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'battle_familiar', name: 'Battle Familiar', type: 'spell', charges: 1, remainingCharges: 1, magicStoneCost: 50, damage: 44 };
        }
      }
      // The opening hand is drawn from a shuffled deck, so a weapon card is not
      // guaranteed (~1% of hands have none). Force one in (without clobbering the
      // spell above) so weapon-card flows entering via this scenario are deterministic.
      if (!player.hand.some(c => c && c.type === 'weapon')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'weapon' && c.type !== 'spell');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 5, grind: 0 };
        }
      }
    } else if (name === 'summon-recall') {
      // Place player in playing phase with two minions far away to test recall
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.x = spawn.x;
      player.z = spawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      state.enemies = [];
      state.minions = [
        {
          id: crypto.randomUUID(),
          ownerId: player.id,
          type: 'astral_guardian',
          x: player.x + 8,
          z: player.z + 8,
          hp: 40,
          maxHp: 40,
          maxTtl: 60,
          ttl: 60,
          attackDamage: 10,
          attackRange: 1.5,
          attackIntervalMs: 1000,
          lastAttackAt: 0,
        },
        {
          id: crypto.randomUUID(),
          ownerId: player.id,
          type: 'dungeon_drake',
          x: player.x - 8,
          z: player.z - 8,
          hp: 50,
          maxHp: 50,
          maxTtl: 60,
          ttl: 60,
          attackDamage: 15,
          attackRange: 1.5,
          attackIntervalMs: 1500,
          lastAttackAt: 0,
        },
      ];
      // Equip the recall whistle so the user can test it immediately
      player.equippedKeyItemId = 'summon_recall';
      player.keyItemCooldownUntil = 0;
    } else if (name === 'combat-damaged-player') {
      player.hp = 25;
      player.magicStones = MAX_MAGIC_STONES;
    } else if (name === 'deck-viewer-instances') {
      // Enter a normal run whose draw pile is built entirely from owned-card
      // *instances* — the deck/selectedDeck store inventory instance IDs rather
      // than plain card ids (as happens for acquired/forged cards). This drives
      // the deck viewer's (V key) instance-id resolution path so the grid is
      // populated, not empty. The same state is reachable normally by acquiring
      // or forging cards into the inventory, building a deck from those owned
      // cards in the lobby, then starting a run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.inventory = createInventoryFromCardIds([
        'iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake', 'steel_claymore',
      ]);
      normalizePlayerInventory(player);
      player.selectedDeck = player.inventory.map((instance) => instance.instanceId);
      createDrawDeckFromSelectedDeck(player);
      initPlayerHand(player);
      player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    } else if (name === 'custom-avatar-demo') {
      // Enter a normal run with a distinctive non-default cosmetic so the
      // cosmetic-driven avatar (non-box body shape + accent color) can be
      // verified without first going through the customization UI. The same
      // visual state is reachable normally by saving a cosmetic via the
      // character-customization profile route, then starting a run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.cosmetic = {
        bodyColor: '#e74c3c',
        accentColor: '#2ecc71',
        bodyShape: 'cylinder',
        hat: 'none',
      };
    } else if (name === 'avatar-proportions-demo') {
      // Enter a normal run with distinctive (non-default) body proportions so
      // the glTF avatar's proportion morph-target influences can be verified
      // without first going through the customization sliders. Values stay
      // inside the server clamp (0.75–1.25) and read clearly against the 1.0
      // default. The same visual state is reachable normally by saving
      // proportions via the character-customization profile route, then
      // starting a run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.cosmetic = {
        bodyColor: '#e74c3c',
        accentColor: '#2ecc71',
        bodyShape: 'box',
        hat: 'none',
        proportions: {
          height: 1.25,
          headSize: 1.25,
          torsoWidth: 0.75,
          armLength: 0.75,
          legLength: 1.25,
          shoulderWidth: 1.25,
        },
      };
    } else if (name === 'avatar-wizard-hat') {
      // Enter a normal run with a hat equipped so the avatar's hat child mesh
      // can be verified without first unlocking/equipping a hat in the shop UI.
      // The wizard hat (tall cone) is the most visually distinctive. The same
      // visual state is reachable normally by unlocking + equipping a hat via
      // the cosmetic/profile routes, then starting a run.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.cosmetic = {
        bodyColor: '#4f9dde',
        accentColor: '#f2c94c',
        bodyShape: 'box',
        hat: 'wizard',
      };
    } else if (name === 'mixed-enemies') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      spawnEnemy(player.x + 3, player.z, 'grunt');
      spawnEnemy(player.x - 3, player.z, 'skirmisher');
      spawnEnemy(player.x, player.z + 4, 'miniboss');
      spawnEnemy(player.x, player.z - 4, 'spawner');
      for (const e of state.enemies) {
        e.wanderTarget = { x: e.x + (Math.random() * 4 - 2), z: e.z + (Math.random() * 4 - 2) };
      }
    } else if (name === 'variant-enemy') {
      // Spawn one variant ("elite") enemy beside a plain one of the same type so
      // the client variant marker can be verified side-by-side. The same state is
      // reachable normally when an enemy rolls a variant on spawn (applyVariant);
      // this is just a deterministic shortcut into it.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const variant = spawnEnemy(player.x + 3, player.z, 'grunt');
      variant.variant = 'test';
      spawnEnemy(player.x - 3, player.z, 'grunt');
      for (const e of state.enemies) {
        e.wanderTarget = { x: e.x, z: e.z };
      }
    } else if (name === 'spawner-active') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const spawner = spawnEnemy(player.x + 4, player.z, 'spawner');
      spawner.lastSpawnTime = Date.now() - ENEMY_DEFS.spawner.spawnIntervalMs - 500;
    } else if (name === 'monster-card') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      if (!player.hand.some(c => c && c.type === 'creature')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'creature');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'dungeon_drake', name: 'Dungeon Drake', type: 'creature', charges: 1, remainingCharges: 1 };
          const deckMonsterIndex = player.deck ? player.deck.indexOf('dungeon_drake') : -1;
          if (deckMonsterIndex !== -1) {
            player.deck.splice(deckMonsterIndex, 1);
          }
        }
      }
    } else if (name === 'minion-combat') {
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const anchorX = player.x;
      const anchorZ = player.z;
      // Keep the player out of aggro range while a pre-spawned minion brawls nearby.
      player.x = anchorX - DETECTION_RADIUS - 1;
      state.enemies = [];
      const enemy = spawnEnemy(anchorX + 2, anchorZ, 'grunt');
      enemy.hp = 500;
      enemy.maxHp = 500;
      enemy.wanderTarget = { x: enemy.x, z: enemy.z };
      enemy.attackState = 'idle';
      state.minions = [{
        id: crypto.randomUUID(),
        ownerId: player.id,
        type: 'dungeon_drake',
        x: anchorX + 1,
        z: anchorZ,
        hp: 50,
        maxHp: 50,
        maxTtl: 30,
        ttl: 30,
        breathRange: 6,
        breathHoldDistance: 3.5,
        breathConeAngle: Math.PI / 4,
        breathDamage: 3,
        breathDurationMs: 2000,
        breathTickMs: 500,
        breathIntervalMs: 2500,
        lastBreathAt: 0,
      }];
      if (!player.hand.some(c => c && c.type === 'creature')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'creature');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'dungeon_drake', name: 'Dungeon Drake', type: 'creature', charges: 1, remainingCharges: 1 };
          const deckMonsterIndex = player.deck ? player.deck.indexOf('dungeon_drake') : -1;
          if (deckMonsterIndex !== -1) {
            player.deck.splice(deckMonsterIndex, 1);
          }
        }
      }
    } else if (name === 'run-failed') {
      for (const p of Object.values(state.players)) {
        p.hp = 0;
        p.dead = true;
      }
      state.minions = [];
      checkRunTerminalState();
    } else if (name === 'run-exhausted') {
      for (const p of Object.values(state.players)) {
        p.deck = [];
        p.hand = [];
        p.desperationDeck = [];
      }
      state.enemies = [{
        id: 'e_remaining',
        x: player.x + 5,
        z: player.z,
        hp: ENEMY_DEFS.grunt.hp,
        maxHp: ENEMY_DEFS.grunt.hp,
        state: 'idle',
        wanderTarget: { x: player.x + 5, z: player.z },
      }];
      state.run.objective.totalEnemies = 1;
      state.run.objective.defeatedEnemies = 0;
      checkRunTerminalState();
    } else if (name === 'quest-objective-near-complete') {
      // Leave a defeat_enemies run one trigger away from victory: a single
      // low-HP grunt stands between the player and an objective-complete win.
      // Defeating it flows through the real recordEnemyDefeated →
      // checkRunTerminalState → victory path (no special-case completion logic
      // here). The player keeps their hand so they can finish through real
      // combat. The same near-complete state is reachable normally by clearing
      // all but the last enemy of a defeat_enemies quest.
      if (!state.run || state.run.status !== 'playing' || state.run.objective.type !== 'defeat_enemies') {
        return { ok: false, reason: 'No active defeat_enemies run for quest-objective-near-complete' };
      }
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.enemies = [];
      const enemy = spawnEnemy(player.x + 2, player.z, 'grunt');
      enemy.hp = 1;
      enemy.maxHp = ENEMY_DEFS.grunt.hp;
      enemy.wanderTarget = { x: enemy.x, z: enemy.z };
      state.run.objective.totalEnemies = 1;
      state.run.objective.defeatedEnemies = 0;
      // The opening hand is drawn from a shuffled deck, so a weapon card is not
      // guaranteed (~1% of hands have none). Force a fully-charged weapon in so
      // the lone 1-HP grunt is reliably killable through the real lock-on +
      // weapon-swing path (the QA smoke depends on this determinism). The same
      // near-complete state is still reachable normally with whatever hand play
      // deals; this only fixes the entry hand for the debug shortcut.
      if (!player.hand.some(c => c && c.type === 'weapon' && (c.remainingCharges == null || c.remainingCharges > 0))) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'weapon');
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = { id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 5, grind: 0 };
        }
      }
    } else if (name === 'sloped-dungeon') {
      // Regenerate the dungeon layout with slopes enabled for visual verification.
      // Uses the same seed as the current quest for determinism.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const seed = state.layoutSeed || questLayoutSeed(state.selectedQuestId || DEFAULT_QUEST_ID);
      const profile = getLayoutProfileForQuest(state.selectedQuestId || DEFAULT_QUEST_ID);
      state.layout = generateLayout(seed, profile, { slopes: true });
      state.layoutSeed = seed;
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      withLobbyContext({ state }, () => rebuildWallColliders());
      // Send updated layout to all clients in the lobby
      io.to(lobby.id).emit('questUpdate', {
        ...buildQuestUpdatePayload(state),
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'sunken-canyon-stage') {
      // Load the sunken-canyon stage layout for client render / collision QA.
      // Same profile as generateLayout(seed, 'sunken-canyon'); reachable via quests
      // once a quest uses layoutProfile 'sunken-canyon'.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const seed = state.layoutSeed || 42;
      state.layoutSeed = seed;
      state.layout = generateLayout(seed, 'sunken-canyon');
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      rebuildWallColliders();
      const startRoom = state.layout.rooms.find(r => r.role === 'start');
      if (startRoom) {
        player.x = startRoom.x;
        player.z = startRoom.z;
      }
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      io.to(lobby.id).emit('questUpdate', {
        ...buildQuestUpdatePayload(state),
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'spire-ascent-stage') {
      // Load the spire-ascent tower layout for client render / collision QA.
      // Same profile as generateLayout(seed, 'spire-ascent'); reachable via quests
      // once a quest uses layoutProfile 'spire-ascent'.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      const seed = state.layoutSeed || 42;
      state.layoutSeed = seed;
      state.layout = generateLayout(seed, 'spire-ascent');
      state.dungeonBounds = computeDungeonBounds(state.layout);
      state.walkableAABBs = computeWalkableAABBs(state.layout);
      rebuildWallColliders();
      const startRoom = state.layout.rooms.find(r => r.role === 'start');
      if (startRoom) {
        player.x = startRoom.x;
        player.z = startRoom.z;
      }
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      io.to(lobby.id).emit('questUpdate', {
        ...buildQuestUpdatePayload(state),
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'open-plaza-arena') {
      // Load the open-plaza arena (the arena_trials quest layout) for visual /
      // collision verification. Reachable normally by selecting the arena_trials
      // quest; this scenario is just a shortcut into that state.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.selectedQuestId = 'arena_trials';
      applyLayoutForQuest(state, 'arena_trials');
      // Re-place the player at the plaza spawn (centre) on the regenerated layout.
      const plazaSpawn = firstRoomPosition();
      player.x = plazaSpawn.x;
      player.z = plazaSpawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      // Populate the arena with the trial pack via the cover-aware spawn path so
      // enemy/loot placement on the open plaza is directly observable. This is
      // the same spawn that runs when deploying into arena_trials normally.
      state.enemies = [];
      state.loot = [];
      spawnEnemies();
      io.to(lobby.id).emit('questUpdate', {
        ...buildQuestUpdatePayload(state),
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'sunken-canyon') {
      // Canyon Descent quest with band-aware spawns — same state as deploying into
      // canyon_descent normally; shortcut for QA (enemies, layout, plateau spawn).
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.selectedQuestId = 'canyon_descent';
      applyLayoutForQuest(state, 'canyon_descent');
      const plateauSpawn = firstRoomPosition();
      player.x = plateauSpawn.x;
      player.z = plateauSpawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      state.enemies = [];
      state.loot = [];
      spawnEnemies();
      io.to(lobby.id).emit('questUpdate', {
        ...buildQuestUpdatePayload(state),
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'spire-ascent') {
      // Spire Ascent quest with tier-aware spawns — same state as deploying into
      // spire_ascent normally; shortcut for QA (enemies, layout, bottom-tier spawn).
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      state.selectedQuestId = 'spire_ascent';
      applyLayoutForQuest(state, 'spire_ascent');
      const bottomSpawn = firstRoomPosition();
      player.x = bottomSpawn.x;
      player.z = bottomSpawn.z;
      player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
      state.enemies = [];
      state.loot = [];
      spawnEnemies();
      io.to(lobby.id).emit('questUpdate', {
        ...buildQuestUpdatePayload(state),
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      });
    } else if (name === 'key-item-cooldown') {
      // Put player in a playing dungeon with key item cooldown active to test on_cooldown rejection.
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.equippedKeyItemId = 'dodge_roll';
      player.keyItemCooldownUntil = Date.now() + 5000; // 5-second cooldown remaining
    } else if (name === 'medic-kit-ready') {
      // Put player at low HP with some MS to test Field Medic Kit healing.
      player.hp = Math.floor(MAX_HP * 0.3);
      player.magicStones = 5;
      player.equippedKeyItemId = 'field_medic_kit';
      player.keyItemCooldownUntil = 0;
    } else if (name === 'guard-block-ready') {
      // Put player at low HP with guard_block equipped and no cooldown to test blocking.
      player.hp = Math.floor(MAX_HP * 0.5);
      player.magicStones = 5;
      player.equippedKeyItemId = 'guard_block';
      player.keyItemCooldownUntil = 0;
    } else if (name === 'flare-beacon-ready') {
      // Put player with flare_beacon equipped and nearby enemies to test reveal VFX.
      player.hp = MAX_HP;
      player.magicStones = 5;
      player.equippedKeyItemId = 'flare_beacon';
      player.keyItemCooldownUntil = 0;
      // Ensure a few enemies are nearby to reveal
      ensureNearbyEnemy(state, player.x, player.z);
      spawnEnemy(player.x + 5, player.z + 3, 'skirmisher');
      spawnEnemy(player.x - 4, player.z - 2, 'grunt');
    } else if (name === 'loot-magnet-ready') {
      // Put player with loot_magnet equipped and scattered ground loot to test pull/collect.
      player.hp = MAX_HP;
      player.magicStones = 5;
      player.equippedKeyItemId = 'loot_magnet';
      player.keyItemCooldownUntil = 0;
      state.loot = [
        { id: crypto.randomUUID(), x: player.x + 2, z: player.z + 2, y: 0, kind: 'gold', value: 10 },
        { id: crypto.randomUUID(), x: player.x - 3, z: player.z + 4, y: 0, kind: 'gold', value: 15 },
        { id: crypto.randomUUID(), x: player.x + 5, z: player.z - 3, y: 0, kind: 'gold', value: 20 },
        { id: crypto.randomUUID(), x: player.x - 6, z: player.z - 5, y: 0, kind: 'gold', value: 25 },
        { id: crypto.randomUUID(), x: player.x + 12, z: player.z + 10, y: 0, kind: 'gold', value: 50 },
        { id: crypto.randomUUID(), x: player.x + 1, z: player.z - 1, y: 0, kind: 'magic_stone', value: 5 },
      ];
    } else if (name === 'overclock-ready') {
      // Put player with overclock key item equipped and charges ready to test slot cooldown bypass.
      player.hp = MAX_HP;
      player.magicStones = 50;
      player.equippedKeyItemId = 'overclock';
      player.keyItemCooldownUntil = 0;
      player.overclockChargesRemaining = 2;
    } else if (name === 'phase-step-ready') {
      // Equip and position only the local caster with phase_step ready to fire.
      // No synthetic ally is injected — an actual position swap requires a real
      // second player to join the run and stand in range (see phase_step.test.js
      // for swap-logic coverage).
      player.hp = MAX_HP;
      player.magicStones = MAX_MAGIC_STONES;
      player.equippedKeyItemId = 'phase_step';
      player.keyItemCooldownUntil = 0;
      state.enemies = [];
    } else if (name === 'echo-strike-ready') {
      // Equip echo_strike with no cooldown, a weapon card in hand, and a tanky
      // enemy directly in front so QA can arm the echo then swing and observe two
      // damage events (primary + delayed echo) on the same surviving enemy.
      player.hp = MAX_HP;
      player.magicStones = 5;
      player.equippedKeyItemId = 'echo_strike';
      player.keyItemCooldownUntil = 0;
      player.echoStrikePending = false;
      player.rotation = 0;
      if (!player.hand.some(c => c && c.type === 'weapon' && c.effect !== 'draw_card')) {
        const replaceSlot = player.hand.findIndex(c => c && c.type !== 'weapon');
        const weaponCard = { id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', damage: 17, charges: 5, remainingCharges: 5 };
        if (replaceSlot >= 0) {
          player.hand[replaceSlot] = weaponCard;
        } else {
          player.hand[0] = weaponCard;
        }
      }
      // Tanky enemy straight ahead (rotation 0 → +x) that survives both packets.
      state.enemies = [];
      spawnEnemy(player.x + 2.5, player.z, 'grunt');
    } else if (name === 'smoke-bomb-ready') {
      // Equip smoke_bomb with no cooldown and place a couple of enemies in
      // attack range so QA can cast the bomb and observe enemies losing their
      // target / cancelling wind-ups while the caster stands in the smoke zone.
      // The same state is reachable normally by equipping the Smoke Bomb key
      // item, entering a run, and approaching enemies.
      player.hp = MAX_HP;
      player.magicStones = 5;
      player.equippedKeyItemId = 'smoke_bomb';
      player.keyItemCooldownUntil = 0;
      state.enemies = [];
      spawnEnemy(player.x + 3, player.z, 'grunt');
      spawnEnemy(player.x - 3, player.z + 1, 'skirmisher');
    } else if (name === 'rally-cry-ready') {
      // Equip rally_cry with no cooldown so QA can cast the party move-speed buff
      // and observe the caster (and any allies in radius) speed up for ~4s. The
      // same state is reachable normally by equipping the Rally Cry key item in
      // the lobby and entering a run. A real second player must join to observe
      // the ally-buff aspect; here only the local caster is set up.
      player.hp = MAX_HP;
      player.magicStones = 5;
      player.equippedKeyItemId = 'rally_cry';
      player.keyItemCooldownUntil = 0;
      player.rallyUntil = 0;
      player.rallySpeedMultiplier = 1;
      state.enemies = [];
    }

    syncRunObjectiveToEnemies();

    broadcastLobbyUpdate(lobby);
    io.to(lobby.id).emit('stateUpdate', stateSnapshot());
    return { ok: true, scenario: name };
  });
}

function findSacrificeTarget(playerId, x, z, radius) {
  const state = getProgressionGameState() || gameState;
  return state.minions
    .map((minion, index) => ({ minion, index }))
    .filter(({ minion }) => {
      if (!minion || minion.ownerId !== playerId || minion.hp <= 0) return false;
      return Math.hypot(minion.x - x, minion.z - z) <= radius;
    })
    .sort((a, b) => {
      const aCreated = Number.isFinite(a.minion.createdAt) ? a.minion.createdAt : 0;
      const bCreated = Number.isFinite(b.minion.createdAt) ? b.minion.createdAt : 0;
      return aCreated - bCreated || a.index - b.index;
    })[0] || null;
}

// Track whether Express routes have been mounted — prevents stacking
// on repeated startServer() calls (tests call startServer in beforeEach).
let _routesMounted = false;
// Track whether Socket.IO middleware has been registered — prevents stacking
// on repeated startServer() calls.
let _middlewareRegistered = false;

function withLobbyFromSocket(socket, fn) {
  const lobby = getLobbyForSocket(socket);
  if (!lobby) {
    socket.emit('lobbyError', { reason: 'Not in a lobby' });
    return;
  }
  return withLobbyContext(lobby, () => fn(lobby.state, lobby));
}

function buildPlayerRecord(playerId, accountId, username, savedData) {
  const progress = createPlayerProgress();
  const defaultDeck = progress.inventory.map(instance => instance.instanceId);
  const spawn = firstRoomPosition();
  const account = findUserByAccountId(accountId);

  const player = {
    id: playerId,
    accountId,
    username,
    x: spawn.x,
    y: 0.5,
    z: spawn.z,
    rotation: 0,
    deck: [],
    hp: MAX_HP,
    dead: false,
    lastActivity: Date.now(),
    lastMoveTime: Date.now(),
    inputDx: 0,
    inputDz: 0,
    inputRotation: 0,
    inputActive: false,
    lastInputTime: 0,
    lastInputSequence: 0,
    connected: true,
    disconnectedAt: null,
    activeSocketId: null,
    persistenceDirty: false,
    ready: false,
    magicStones: STARTING_MAGIC_STONES,
    currency: progress.currency,
    inventory: progress.inventory,
    ownedCards: progress.ownedCards,
    runRewards: progress.runRewards,
    currencyEarnedThisRun: progress.currencyEarnedThisRun,
    selectedDeck: defaultDeck,
    debugScenario: null,
    pendingSummons: new Set(),
    slotCooldowns: [null, null, null, null, null, null],
    nextDrawAt: null,
    extracted: false,
    equippedKeyItemId: 'dodge_roll',
    keyItemCooldownUntil: 0,
    debuffs: [],
    overclockChargesRemaining: 0,
    invulnerableUntil: 0,
    blockingUntil: 0,
    blockingYaw: 0,
    rallyUntil: 0,
    rallySpeedMultiplier: 1,
    anchorUntil: 0,
    anchorSpeedMultiplier: 1,
    cosmetic: account?.cosmetic ?? { ...DEFAULT_COSMETIC },
  };

  if (savedData) {
    player.currency = savedData.currency ?? player.currency;
    if (savedData.inventory || savedData.ownedCards) {
      player.inventory = normalizeInventory(savedData.inventory, savedData.ownedCards);
      player.ownedCards = inventoryToOwnedCards(player.inventory);
    }
    player.selectedDeck = savedData.selectedDeck && savedData.selectedDeck.length > 0
      ? normalizeSelectedDeck(savedData.selectedDeck, player.inventory)
      : player.selectedDeck;
    player.x = savedData.x ?? player.x;
    player.y = savedData.y ?? DEFAULT_FLOOR_Y;
    player.z = savedData.z ?? player.z;
    player.rotation = savedData.rotation ?? player.rotation;
    player.equippedKeyItemId = savedData.equippedKeyItemId || 'dodge_roll';
  }

  normalizePlayerInventory(player);
  return player;
}

function loadSavedPlayerData(loadKey) {
  try {
    return getProvider() ? getProvider().loadPlayer(loadKey) : null;
  } catch (err) {
    console.error(`[persistence] loadPlayer failed for ${loadKey}:`, err.message);
    return null;
  }
}

function initializePlayerForActiveRun(player) {
  if (!player.hand || player.hand.length === 0) {
    createDrawDeckFromSelectedDeck(player);
    initPlayerHand(player);
  }
  player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
  player.magicStones = STARTING_MAGIC_STONES;
  if (!player.pendingSummons) {
    player.pendingSummons = new Set();
  }
  if (player.hp == null || player.hp <= 0) {
    player.hp = MAX_HP;
    player.dead = false;
  }
  player.invulnerableUntil = 0;
  player.overclockChargesRemaining = 0;
  player.rallyUntil = 0;
  player.rallySpeedMultiplier = 1;
  player.anchorUntil = 0;
  player.anchorSpeedMultiplier = 1;
}

function emitLobbyJoined(socket, lobby) {
  const state = lobby.state;
  const player = state.players[socket.playerId];
  withLobbyContext(lobby, () => ensureShopOffer());

  socket.emit('lobbyJoined', {
    lobbyId: lobby.id,
    lobbyName: lobby.name,
    id: socket.playerId,
    playerId: socket.playerId,
    accountId: player.accountId,
    username: player.username,
    state,
    layoutSeed: state.layoutSeed,
    layout: state.layout,
    selectedDeck: player.selectedDeck,
    inventory: player.inventory,
    ownedCards: player.ownedCards,
    shopOffer: state.shopOffer,
    ...buildQuestUpdatePayload(state),
  });

  broadcastLobbyUpdate(lobby);
}

function joinPlayerToLobby(socket, lobby) {
  const playerId = socket.playerId;
  const state = lobby.state;
  const savedData = loadSavedPlayerData(playerId);

  if (!state.players[playerId]) {
    state.players[playerId] = buildPlayerRecord(
      playerId,
      socket.data.accountId,
      socket.data.username,
      savedData,
    );
  } else {
    const player = state.players[playerId];
    player.username = socket.data.username || player.username;
    if (savedData) {
      player.currency = savedData.currency ?? player.currency;
      if (savedData.inventory || savedData.ownedCards) {
        player.inventory = normalizeInventory(savedData.inventory, savedData.ownedCards);
        player.ownedCards = inventoryToOwnedCards(player.inventory);
      }
      player.selectedDeck = savedData.selectedDeck && savedData.selectedDeck.length > 0
        ? normalizeSelectedDeck(savedData.selectedDeck, player.inventory)
        : player.selectedDeck;
      player.equippedKeyItemId = savedData.equippedKeyItemId || 'dodge_roll';
    }
    normalizePlayerInventory(player);
    if (player.equippedKeyItemId == null) player.equippedKeyItemId = 'dodge_roll';
    if (player.keyItemCooldownUntil == null) player.keyItemCooldownUntil = 0;
    if (!Array.isArray(player.debuffs)) player.debuffs = [];
  }

  if (state.gamePhase === 'lobby') {
    revivePlayerInLobby(state.players[playerId]);
  }

  if (state.gamePhase === 'playing') {
    withLobbyContext(lobby, () => initializePlayerForActiveRun(state.players[playerId]));
  }

  const player = state.players[playerId];
  player.activeSocketId = socket.id;
  player.connected = true;
  player.disconnectedAt = null;

  lobbies.assignPlayerToLobby(playerId, lobby.id);
  lobbies.removeSession(playerId);
  socket.join(lobby.id);
  emitLobbyJoined(socket, lobby);
}

function reconnectPlayerToLobby(socket, lobby) {
  const playerId = socket.playerId;
  const player = lobby.state.players[playerId];
  if (!player) return false;

  player.activeSocketId = socket.id;
  player.connected = true;
  player.disconnectedAt = null;
  player.lastInputSequence = 0;
  player.inputActive = false;
  player.inputDx = 0;
  player.inputDz = 0;
  player.lastActivity = Date.now();

  const oldSocket = findSocketByPlayerId(playerId);
  if (oldSocket && oldSocket.id !== socket.id && oldSocket.connected) {
    oldSocket.disconnect(true);
  }

  lobbies.assignPlayerToLobby(playerId, lobby.id);
  lobbies.removeSession(playerId);
  socket.join(lobby.id);
  emitLobbyJoined(socket, lobby);
  io.to(lobby.id).emit('playerReconnected', playerId);
  broadcastLobbyList();
  return true;
}

function softDisconnectPlayerFromLobby(socket) {
  const lobby = getLobbyForSocket(socket);
  if (!lobby) return null;

  const playerId = socket.playerId;
  const player = lobby.state.players[playerId];
  if (!player) return null;

  if (player.activeSocketId && player.activeSocketId !== socket.id) {
    return null;
  }

  withLobbyContext(lobby, () => {
    savePlayerData(playerId);
    cancelTradesForPlayer(lobby.state.pendingTrades, playerId);

    player.connected = false;
    player.disconnectedAt = Date.now();
    player.inputActive = false;
    player.inputDx = 0;
    player.inputDz = 0;

    if (lobby.state.gamePhase === 'playing') {
      checkRunTerminalState();
    } else {
      broadcastLobbyUpdate(lobby);
    }
  });
  broadcastLobbyList();
  return { lobby, playerId };
}

function evictDisconnectedPlayers() {
  const now = Date.now();
  let evictedAny = false;

  for (const lobby of lobbies._lobbies.values()) {
    const toEvict = [];
    for (const [playerId, player] of Object.entries(lobby.state.players)) {
      if (player.connected !== false || !player.disconnectedAt) continue;
      if (now - player.disconnectedAt < DISCONNECT_GRACE_MS) continue;
      toEvict.push(playerId);
    }

    if (toEvict.length === 0) continue;

    for (const playerId of toEvict) {
      withLobbyContext(lobby, () => {
        savePlayerData(playerId);
        cancelTradesForPlayer(lobby.state.pendingTrades, playerId);
      });
      const result = lobbies.removePlayerFromLobby(playerId);
      io.to(lobby.id).emit('playerDisconnected', playerId);
      evictedAny = true;

      if (result && !result.deleted) {
        withLobbyContext(lobby, () => {
          if (lobby.state.gamePhase === 'playing') {
            checkRunTerminalState();
          } else {
            broadcastLobbyUpdate(lobby);
          }
        });
      }
    }
  }

  if (evictedAny) {
    broadcastLobbyList();
  }
}

function leaveLobbyForSocket(socket) {
  const lobby = getLobbyForSocket(socket);
  if (!lobby) return null;

  const playerId = socket.playerId;
  withLobbyContext(lobby, () => {
    savePlayerData(playerId);
    cancelTradesForPlayer(lobby.state.pendingTrades, playerId);
  });
  socket.leave(lobby.id);

  const result = lobbies.removePlayerFromLobby(playerId);
  io.to(lobby.id).emit('playerDisconnected', playerId);

  if (result && !result.deleted) {
    withLobbyContext(lobby, () => {
      if (lobby.state.gamePhase === 'playing') {
        checkRunTerminalState();
      } else {
        broadcastLobbyUpdate(lobby);
      }
    });
  }

  broadcastLobbyList();
  return result;
}

// ── Server startup (deferred so tests can import without starting HTTP) ──

function resolveAttackRotation(player, data) {
	if (data && Number.isFinite(data.rotation)) {
		return data.rotation;
	}
	return Number.isFinite(player.rotation) ? player.rotation : 0;
}

function runGameLoopTick() {
  for (const lobby of lobbies._lobbies.values()) {
    withLobbyContext(lobby, () => {
      const state = lobby.state;
      if (state.gamePhase === 'playing') {
        applyPlayerMovement();
        checkTelepipeProximity();
        flushDirtyPlayerSaves();
        updateEnemies();
        updateMinions();
        updateSurviveSpawns();

        const now = Date.now();
        processPassiveDraws(now);

        if (state._pendingMinionBreaths?.length) {
          for (const event of state._pendingMinionBreaths) {
            io.to(lobby.id).emit('cardUsed', event);
          }
          state._pendingMinionBreaths.length = 0;
        }

        regenMagicStones();

        state.loot = state.loot.filter(l => (now - l.createdAt) < LOOT_LIFETIME_MS);
      }

      const snapshot = stateSnapshot();
      io.to(lobby.id).emit('stateUpdate', snapshot);
    });
  }
  return true;
}

function startServer(port) {
  // Initialize auth — throws if JWT_SECRET is missing (unless NODE_ENV === 'test')
  initAuth();

  // Ensure the data/ directory exists for user records and player persistence
  const dataDir = process.env.PERSISTENCE_PATH || path.resolve(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // Mount Express routes exactly once per process.  The auth router is a
  // module-level singleton (require('./auth')) — calling app.use() again
  // would stack a duplicate set of handlers.  The guard below ensures each
  // route is registered a single time, even when tests call startServer()
  // repeatedly in beforeEach.
  if (!_routesMounted) {
    app.use(express.json());
    const authRouter = require('./auth');
    const accountRouter = require('./account');
    app.use('/api', authRouter);
    app.use('/api', accountRouter);
    _routesMounted = true;
  }

  // In test mode, clear the in-memory users Map to prevent contamination
  // from prior test files sharing the same module instance.  This pairs
  // with setTestFilePath() / clearUsers() called in test beforeEach hooks.
  if (process.env.NODE_ENV === 'test') {
    const { clearUsers } = require('./users');
    clearUsers();
  }

  // Initialize persistence provider based on PERSISTENCE_BACKEND env var.
  // Default is FileProvider for durable persistence across restarts.
  // Set PERSISTENCE_BACKEND=memory to opt into the ephemeral in-memory provider.
  const dataPath = process.env.PERSISTENCE_PATH || path.resolve(__dirname, '..', 'data');
  const { initSettingsPath } = require('./settings');
  initSettingsPath(dataPath);

  if (process.env.NODE_ENV === 'test') {
    if (!getProvider()) {
      setTestProvider(new InMemoryProvider());
    }
  } else if (process.env.PERSISTENCE_BACKEND === 'memory') {
    setTestProvider(new InMemoryProvider());
    console.log('[persistence] InMemoryProvider initialized (ephemeral — set PERSISTENCE_BACKEND=file for durable storage)');
  } else {
    setTestProvider(new FileProvider(dataPath));
    console.log(`[persistence] FileProvider initialized at ${dataPath}`);
  }

  // Remove previous connection handlers so repeated calls (in tests) don't stack
  io.removeAllListeners('connection');
  // Clear Socket.IO middleware so repeated calls (in tests) don't stack.
  // io.use() appends to an internal array with no public removal API,
  // so we guard registration with _middlewareRegistered (like _routesMounted).
  // Clear any previously created intervals/timeouts (from prior test runs)
  clearAllTimers();
  restartBackgroundTimers();

  // ── JWT authentication middleware ──
  // Runs before the 'connection' event. Calling next(new Error(...)) here
  // triggers a connect_error on the client (not connect → disconnect), which
  // the existing client connect_error handler already handles by clearing
  // the stale token and re-showing the login overlay.
  if (!_middlewareRegistered) {
    io.use((socket, next) => {
      const token = socket.handshake.auth && socket.handshake.auth.token;

      if (!token) {
        return next(new Error('No JWT token'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Invalid or expired JWT'));
      }

      // Attach decoded claims so the connection handler can read them
      socket.data.accountId = decoded.accountId;
      socket.data.username = decoded.username;
      next();
    });
    _middlewareRegistered = true;
  }

  io.on('connection', (socket) => {
    // ── JWT authentication (required) ──
    // JWT validation is performed by the io.use() middleware above.
    // Failed auth triggers a client-side connect_error (not connect → disconnect),
    // which the client handler uses to clear stale tokens and re-show login.
    // The connection handler trusts the middleware to have already validated.
    const accountId = socket.data.accountId;
    const username = socket.data.username;

    // ── Stable player identity ──
    // Authenticated connection — accountId is the stable identity
    const playerId = accountId;

    socket.playerId = playerId;
    console.log(`Player connected: socket=${socket.id}, playerId=${playerId}`);

    const savedData = loadSavedPlayerData(accountId || playerId);
    const sessionPlayer = buildPlayerRecord(playerId, accountId, username, savedData);
    lobbies.registerSession(playerId, {
      playerId,
      accountId,
      username,
      selectedDeck: sessionPlayer.selectedDeck,
      inventory: sessionPlayer.inventory,
      ownedCards: sessionPlayer.ownedCards,
      currency: sessionPlayer.currency,
    });

    socket.on('listLobbies', () => {
      socket.emit('lobbyListUpdate', { lobbies: lobbies.listLobbySummaries() });
    });

    socket.on('listKeyItems', () => {
      const items = getUnlockedKeyItems().map((def) => ({
        id: def.id,
        name: def.name,
        description: def.description,
        cooldownMs: def.cooldownMs,
      }));
      socket.emit('keyItemsListed', { items });
    });

    socket.on('createLobby', (data) => {
      if (lobbies.getLobbyForPlayer(playerId)) {
        socket.emit('lobbyError', { reason: 'Already in a lobby' });
        return;
      }
      const lobby = lobbies.createLobby(playerId, data && data.name);
      withLobbyContext(lobby, () => {
        applyLayoutForQuest(lobby.state, lobby.state.selectedQuestId);
        ensureShopOffer();
      });
      joinPlayerToLobby(socket, lobby);
    });

    socket.on('joinLobby', (data) => {
      const existingLobby = lobbies.getLobbyForPlayer(playerId);
      if (existingLobby) {
        const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
        const player = existingLobby.state.players[playerId];
        if (player && player.connected === false && lobbyId === existingLobby.id) {
          reconnectPlayerToLobby(socket, existingLobby);
          return;
        }
        socket.emit('lobbyError', { reason: 'Already in a lobby' });
        return;
      }
      const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
      if (!lobbyId) {
        socket.emit('lobbyError', { reason: 'Missing lobbyId' });
        return;
      }
      const lobby = lobbies.getLobbyById(lobbyId);
      if (!lobby) {
        socket.emit('lobbyError', { reason: 'Lobby not found' });
        return;
      }
      joinPlayerToLobby(socket, lobby);
    });

    socket.on('leaveLobby', () => {
      if (!lobbies.getLobbyForPlayer(playerId)) {
        socket.emit('lobbyError', { reason: 'Not in a lobby' });
        return;
      }
      leaveLobbyForSocket(socket);
      const session = lobbies.getSession(playerId) || {
        playerId,
        accountId,
        username,
        selectedDeck: sessionPlayer.selectedDeck,
        inventory: sessionPlayer.inventory,
        ownedCards: sessionPlayer.ownedCards,
        currency: sessionPlayer.currency,
      };
      lobbies.registerSession(playerId, session);
      socket.emit('lobbyLeft', {
        lobbies: lobbies.listLobbySummaries(),
      });
    });

  socket.on('move', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (state.gamePhase !== 'playing') return;

    const player = state.players[socket.playerId];

    if (!player) return;
    if (player.dead) return;
    if (player.extracted) return;
    if (player.connected === false) return;

    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        !Number.isFinite(data.dx) || !Number.isFinite(data.dz) || !Number.isFinite(data.rotation)) {
      console.warn(`Rejected move from ${socket.id}: invalid payload`);
      return;
    }

    if (data.sequence !== undefined) {
      if (!Number.isInteger(data.sequence) || data.sequence <= 0) {
        console.warn(`Rejected move from ${socket.id}: invalid sequence`);
        return;
      }
      const lastSeq = player.lastInputSequence || 0;
      if (data.sequence <= lastSeq) {
        return;
      }
      player.lastInputSequence = data.sequence;
    }

    // Normalize input vector to unit length (defensive against oversized dx/dz)
    const mag = Math.hypot(data.dx, data.dz);
    if (mag > 1) { data.dx /= mag; data.dz /= mag; }

    if (player) {
      player.inputDx = data.dx;
      player.inputDz = data.dz;
      if (Number.isFinite(data.rotation)) {
        player.inputRotation = data.rotation;
        player.rotation = data.rotation;
      }
      player.inputActive = mag > 1e-8;
      player.lastInputTime = Date.now();
      player.lastActivity = Date.now();
      // Batched once per tick via flushDirtyPlayerSaves after applyPlayerMovement.
      player.persistenceDirty = true;
    }
    });
  });

  socket.on('useCard', (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
      cardEffects.handleUseCard(socket, state, lobby, data);
    });
  });

  socket.on('discardCard', (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
    if (state.gamePhase !== 'playing') return;
    if (!state.run || state.run.status !== 'playing') return;
    if (!data || typeof data.slotIndex !== 'number' || !data.cardId) return;

    const player = state.players[socket.playerId];
    if (!player || player.dead) return;

    const result = discardCardFromHand(player, data.slotIndex, data.cardId);
    if (!result.valid) {
      socket.emit('cardError', { reason: result.reason });
      return;
    }

    io.to(lobby.id).emit('stateUpdate', stateSnapshot());
    });
  });

  socket.on('selectQuest', (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
    if (state.gamePhase !== 'lobby') return;

    if (state.suspendedCheckpoint) {
      socket.emit('questError', { reason: 'Abandon the suspended expedition before changing quests' });
      return;
    }

    const questId = data && typeof data.questId === 'string' ? data.questId : null;
    if (!questId) {
      socket.emit('questError', { reason: 'Missing questId' });
      return;
    }

    if (!isValidQuestId(questId)) {
      socket.emit('questError', { reason: `Unknown quest: ${questId}` });
      return;
    }

    state.selectedQuestId = questId;
    applyLayoutForQuest(state, questId);
    assignRunSpawnPositions(Object.values(state.players));
    const payload = {
      ...buildQuestUpdatePayload(state),
      layoutSeed: state.layoutSeed,
      layout: state.layout,
    };
    io.to(lobby.id).emit('questUpdate', payload);
    io.to(lobby.id).emit('stateUpdate', stateSnapshot());
    broadcastLobbyUpdate(lobby);
    });
  });

  socket.on('playerReady', (ready) => {
    withLobbyFromSocket(socket, (state, lobby) => {
    const player = state.players[socket.playerId];
    if (!player) return;

    if (ready) {
      normalizePlayerInventory(player);
      const result = validateDeck(player.selectedDeck, player.inventory);
      if (!result.valid) {
        player.ready = false;
        socket.emit('deckError', { reason: result.reason });
        broadcastLobbyUpdate(lobby);
        return;
      }
    }

    player.ready = !!ready;
    broadcastLobbyUpdate(lobby);
    if (state.gamePhase === 'lobby') {
      checkAllReady();
    }
    });
  });

  socket.on('returnToLobby', () => {
    withLobbyFromSocket(socket, (state) => {
    if (state.run && state.run.status === 'playing') {
      socket.emit('runError', { reason: 'Run still in progress' });
      return;
    }

    if (!state.run) return;

    returnPlayersToLobby();
    });
  });

  socket.on('giveUp', () => {
    withLobbyFromSocket(socket, (state) => {
      try {
        if (state.gamePhase !== 'playing' || !state.run || state.run.status === 'suspended') {
          socket.emit('runError', { reason: 'No active run' });
          return;
        }
        const result = giveUpRun();
        if (!result.ok) {
          socket.emit('runError', { reason: result.reason || 'Cannot give up' });
          return;
        }
        socket.emit('runAbandoned');
      } catch (err) {
        console.error('[giveUp] failed:', err);
        socket.emit('runError', { reason: 'Give up failed' });
      }
    });
  });

  socket.on('abandonRun', () => {
    withLobbyFromSocket(socket, (state) => {
      if (!state.suspendedCheckpoint) {
        socket.emit('runError', { reason: 'No suspended expedition' });
        return;
      }
      abandonSuspendedRun();
    });
  });

  socket.on('claimCardReward', (data) => {
    withLobbyFromSocket(socket, (state) => {
    const player = state.players[socket.playerId];
    if (!player) return;
    if (!state.run || state.run.status === 'playing') return;
    if (!data || typeof data.cardId !== 'string') return;

    const result = claimCardReward(socket.playerId, data.cardId);
    if (!result.ok) return;

    savePlayerData(socket.playerId);
    socket.emit('cardRewardClaimed', {
      cardId: result.cardId,
      ownedCards: result.ownedCards,
      inventory: result.inventory,
    });
    });
  });

  socket.on('deckAddCard', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (state.gamePhase !== 'lobby') return;

    const player = state.players[socket.playerId];
    if (!player) return;
    normalizePlayerInventory(player);

    const requestedInstanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
    const requestedCardId = data && typeof data.cardId === 'string' ? data.cardId : null;
    if (!requestedInstanceId && !requestedCardId) {
      socket.emit('deckError', { reason: 'Missing cardId' });
      return;
    }

    let instance = null;
    if (requestedInstanceId) {
      instance = getInventoryInstance(player.inventory, requestedInstanceId);
      if (!instance) {
        socket.emit('deckError', { reason: `Unknown card instance: ${requestedInstanceId}` });
        return;
      }
    } else {
      if (!CARD_DEFS[requestedCardId]) {
        socket.emit('deckError', { reason: `Unknown card: ${requestedCardId}` });
        return;
      }
      instance = findAvailableInventoryInstance(requestedCardId, player.selectedDeck, player.inventory);
    }

    const cardId = instance ? instance.cardId : requestedCardId;
    if (!instance) {
      socket.emit('deckError', { reason: `No extra copies of ${cardId} to add` });
      return;
    }

    // Validate deck rules via the selected instance.
    if (!canAddCardInstanceToDeck(instance.instanceId, player.selectedDeck, player.inventory)) {
      if (player.selectedDeck.length >= DECK_MAX_SIZE) {
        socket.emit('deckError', { reason: `Deck is full (${DECK_MAX_SIZE} cards max)` });
      } else if (!findAvailableInventoryInstance(cardId, player.selectedDeck, player.inventory)) {
        socket.emit('deckError', { reason: `No extra copies of ${cardId} to add` });
      } else {
        socket.emit('deckError', { reason: `Cannot add ${cardId} to deck` });
      }
      return;
    }

    // Add this specific card instance to the deck.
    player.selectedDeck.push(instance.instanceId);

    // Emit deckUpdate to the requesting player only
    socket.emit('deckUpdate', {
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards
    });

    savePlayerData(socket.playerId);
    });
  });

  socket.on('equipKeyItem', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (state.gamePhase !== 'lobby') {
      socket.emit('keyItemError', { reason: 'not_in_lobby' });
      return;
    }

    const player = state.players[socket.playerId];
    if (!player) return;

    const keyItemId = data && typeof data.keyItemId === 'string' ? data.keyItemId : null;
    if (!keyItemId) {
      socket.emit('keyItemError', { reason: 'missing_key_item_id' });
      return;
    }

    const def = getKeyItemDef(keyItemId);
    if (!def) {
      socket.emit('keyItemError', { reason: 'unknown_item' });
      return;
    }

    player.equippedKeyItemId = keyItemId;
    savePlayerData(socket.playerId);

    socket.emit('keyItemEquipped', { keyItemId });
    });
  });

  socket.on('useKeyItem', (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
      keyItemEffects.handleUseKeyItem(socket, state, lobby, data);
    });
  });

  socket.on('deckRemoveCard', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (state.gamePhase !== 'lobby') return;

    const player = state.players[socket.playerId];
    if (!player) return;
    normalizePlayerInventory(player);

    const requestedInstanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
    const requestedCardId = data && typeof data.cardId === 'string' ? data.cardId : null;
    if (!requestedInstanceId && !requestedCardId) {
      socket.emit('deckError', { reason: 'Missing cardId' });
      return;
    }

    // Find the selected instance in the deck. Legacy cardId payloads remove
    // the first matching card instance for backward compatibility.
    let idx = -1;
    let cardId = requestedCardId;
    if (requestedInstanceId) {
      idx = player.selectedDeck.indexOf(requestedInstanceId);
      cardId = cardIdForDeckEntry(requestedInstanceId, player.inventory) || requestedInstanceId;
    } else {
      idx = player.selectedDeck.findIndex(entry =>
        cardIdForDeckEntry(entry, player.inventory) === requestedCardId
      );
    }
    if (idx === -1) {
      socket.emit('deckError', { reason: `Card ${cardId} not in deck` });
      return;
    }

    // Remove one occurrence
    player.selectedDeck.splice(idx, 1);

    // Emit deckUpdate to the requesting player only
    socket.emit('deckUpdate', {
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards
    });

    savePlayerData(socket.playerId);
    });
  });

  socket.on('evolveCard', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (state.gamePhase !== 'lobby') return;

    const player = state.players[socket.playerId];
    if (!player) return;

    const instanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
    const result = evolveCard(player, instanceId);
    if (!result.ok) {
      socket.emit('cardEvolutionError', { reason: result.reason });
      return;
    }

    socket.emit('cardEvolutionResult', {
      ...result,
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards
    });
    socket.emit('deckUpdate', {
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards
    });
    savePlayerData(socket.playerId);
    });
  });

  socket.on('sellCard', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (state.gamePhase !== 'lobby') return;

    const player = state.players[socket.playerId];
    if (!player) return;

    const requestedInstanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
    const requestedCardId = data && typeof data.cardId === 'string' ? data.cardId : null;
    if (!requestedInstanceId && !requestedCardId) {
      socket.emit('deckError', { reason: 'Missing cardId' });
      return;
    }

    let cardId = requestedCardId;
    if (requestedInstanceId) {
      const instance = getInventoryInstance(player.inventory, requestedInstanceId);
      cardId = instance ? instance.cardId : requestedCardId;
    }

    const result = sellCard(player, cardId, requestedInstanceId);
    if (!result.ok) {
      socket.emit('deckError', { reason: result.reason });
      return;
    }

    socket.emit('cardInventoryUpdate', {
      inventory: player.inventory,
      ownedCards: player.ownedCards,
      currency: player.currency,
      selectedDeck: player.selectedDeck
    });
    savePlayerData(socket.playerId);
    });
  });

  socket.on('buyShopCard', () => {
    withLobbyFromSocket(socket, (state) => {
    if (state.gamePhase !== 'lobby') return;

    const player = state.players[socket.playerId];
    if (!player) return;

    const result = buyShopCard(player, state.shopOffer);
    if (!result.ok) {
      socket.emit('deckError', { reason: result.reason });
      return;
    }

    socket.emit('cardInventoryUpdate', {
      inventory: player.inventory,
      ownedCards: player.ownedCards,
      currency: player.currency,
      selectedDeck: player.selectedDeck
    });
    savePlayerData(socket.playerId);
    });
  });

  socket.on('unlockHat', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (state.gamePhase !== 'lobby') return;

    const player = state.players[socket.playerId];
    if (!player) return;

    const hatId = data && typeof data.hatId === 'string' ? data.hatId : null;
    if (!hatId) {
      socket.emit('hatError', { reason: 'Missing hatId' });
      return;
    }

    // Reject early if the account already owns the hat — no currency change.
    const account = findUserByAccountId(player.accountId);
    if (!account) {
      socket.emit('hatError', { reason: 'Account not found' });
      return;
    }
    const owned = backfillUnlockedHats(account.unlockedHats);
    if (owned.includes(hatId)) {
      socket.emit('hatError', { reason: 'Hat already unlocked' });
      return;
    }

    // Deduct currency (validates the hat exists and affordability).
    const result = unlockHatForPlayer(player, hatId);
    if (!result.ok) {
      socket.emit('hatError', { reason: result.reason });
      return;
    }

    // Record the unlock on the account. If persistence fails, refund the
    // currency so currency and unlockedHats stay consistent.
    const unlockResult = unlockHatForAccount(player.accountId, hatId);
    if (!unlockResult.ok) {
      player.currency += result.cost;
      socket.emit('hatError', { reason: unlockResult.reason });
      return;
    }

    socket.emit('hatUnlocked', {
      unlockedHats: unlockResult.unlockedHats,
      currency: player.currency
    });
    savePlayerData(socket.playerId);
    });
  });

  socket.on('medicHeal', () => {
    withLobbyFromSocket(socket, (state) => {
      if (state.gamePhase !== 'lobby') {
        socket.emit('medicError', { reason: 'not_in_lobby' });
        return;
      }

      const result = healAtMedic(socket.playerId);
      if (!result.ok) {
        socket.emit('medicError', { reason: result.reason });
        return;
      }

      const player = state.players[socket.playerId];
      socket.emit('medicHealed', {
        hp: result.hp,
        currency: player.currency,
        cost: result.cost,
      });
      io.to(state._lobbyId).emit('stateUpdate', stateSnapshot());
    });
  });

  socket.on('grindCard', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (state.gamePhase !== 'lobby') return;

    const player = state.players[socket.playerId];
    if (!player) return;

    const instanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
    const result = grindCard(player, instanceId);
    if (!result.ok) {
      socket.emit('cardGrindError', { reason: result.reason });
      return;
    }

    socket.emit('cardGrindResult', {
      ...result,
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards,
      currency: player.currency
    });
    socket.emit('deckUpdate', {
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards,
      currency: player.currency
    });
    savePlayerData(socket.playerId);
    });
  });

  socket.on('offerCardTrade', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (state.gamePhase !== 'lobby') return;

    const player = state.players[socket.playerId];
    if (!player || !data) return;

    const targetPlayerId = typeof data.targetPlayerId === 'string' ? data.targetPlayerId : null;
    const offeredCardId = typeof data.offeredCardId === 'string' ? data.offeredCardId : null;
    const requestedCardId = typeof data.requestedCardId === 'string' ? data.requestedCardId : null;
    if (!targetPlayerId || !offeredCardId || !requestedCardId) {
      socket.emit('deckError', { reason: 'Invalid trade offer' });
      return;
    }

    const result = offerCardTrade(
      state.pendingTrades,
      socket.playerId,
      targetPlayerId,
      offeredCardId,
      requestedCardId
    );
    if (!result.ok) {
      socket.emit('deckError', { reason: result.reason });
      return;
    }

    socket.emit('tradeUpdate', {
      tradeId: result.tradeId,
      status: 'offered',
      targetPlayerId,
      offeredCardId,
      requestedCardId
    });

    const targetSocket = findSocketByPlayerId(targetPlayerId);
    if (targetSocket) {
      targetSocket.emit('tradeOffer', {
        tradeId: result.tradeId,
        fromPlayerId: socket.playerId,
        fromUsername: player.username || socket.playerId,
        offeredCardId,
        requestedCardId
      });
    }
    });
  });

  socket.on('respondCardTrade', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (state.gamePhase !== 'lobby') return;

    const player = state.players[socket.playerId];
    if (!player || !data) return;

    const tradeId = typeof data.tradeId === 'string' ? data.tradeId : null;
    const accepted = !!data.accepted;
    if (!tradeId) {
      socket.emit('deckError', { reason: 'Missing tradeId' });
      return;
    }

    const trade = state.pendingTrades[tradeId];
    const offererId = trade ? trade.fromPlayerId : null;
    const result = respondCardTrade(state.pendingTrades, socket.playerId, tradeId, accepted);
    if (!result.ok) {
      socket.emit('deckError', { reason: result.reason });
      return;
    }

    const notifyTradeResolved = (playerId, payload) => {
      const targetSocket = findSocketByPlayerId(playerId);
      if (targetSocket) targetSocket.emit('tradeUpdate', payload);
    };

    if (!result.accepted) {
      notifyTradeResolved(socket.playerId, { tradeId, status: 'rejected' });
      if (offererId) {
        notifyTradeResolved(offererId, { tradeId, status: 'rejected' });
      }
      return;
    }

    const offerer = state.players[result.offererId];
    const responder = state.players[result.responderId];
    const inventoryPayload = (p) => ({
      inventory: p.inventory,
      ownedCards: p.ownedCards,
      currency: p.currency,
      selectedDeck: p.selectedDeck
    });

    notifyTradeResolved(result.offererId, { tradeId, status: 'accepted' });
    notifyTradeResolved(result.responderId, { tradeId, status: 'accepted' });

    const offererSocket = findSocketByPlayerId(result.offererId);
    if (offererSocket) {
      offererSocket.emit('cardInventoryUpdate', inventoryPayload(offerer));
    }
    const responderSocket = findSocketByPlayerId(result.responderId);
    if (responderSocket) {
      responderSocket.emit('cardInventoryUpdate', inventoryPayload(responder));
    }

    savePlayerData(result.offererId);
    savePlayerData(result.responderId);
    });
  });

  socket.on('debugScenario', (data) => {
    const name = data && typeof data.name === 'string' ? data.name : '';
    if (!isDebugScenarioAllowed(socket)) {
      socket.emit('debugScenarioResult', { ok: false, reason: 'Debug scenarios are disabled' });
      return;
    }

    const result = applyDebugScenario(socket, name);
    socket.emit('debugScenarioResult', result);
  });

  socket.on('heartbeat', (data) => {
    if (!data || !Number.isFinite(data.timestamp)) {
      console.warn(`Rejected heartbeat from ${socket.id}: invalid payload`);
      return;
    }
    const lobby = getLobbyForSocket(socket);
    if (lobby && lobby.state.players[socket.playerId]) {
      lobby.state.players[socket.playerId].lastActivity = Date.now();
    }
    socket.emit('heartbeat_ack', { latency: Date.now() - data.timestamp });
  });

  socket.on('lootPickup', (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
    if (!data || !data.lootId) return;

    const player = state.players[socket.playerId];
    if (!player) return;
    if (player.dead || player.extracted) return;

    const lootIdx = state.loot.findIndex(l => l.id === data.lootId);
    if (lootIdx === -1) return;

    const loot = state.loot[lootIdx];
    const dist = Math.hypot(player.x - loot.x, player.z - loot.z);

    if (dist > LOOT_PICKUP_RADIUS) return;

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
    state.loot.splice(lootIdx, 1);

    const lootLabel = isCrystal ? ' (crystal)' : isMagicStone ? ' (magic stone)' : '';
    console.log(`[loot] picked up id=${loot.id}${lootLabel} value=${loot.value} by ${socket.id} (currency=${player.currency}, ms=${player.magicStones})`);

    savePlayerData(socket.playerId);

    if (isCrystal) {
      checkRunTerminalState();
    }
    });
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    if (!socket.playerId) return;

    const lobby = lobbies.getLobbyForPlayer(socket.playerId);
    if (lobby && lobby.state.players[socket.playerId]) {
      softDisconnectPlayerFromLobby(socket);
      return;
    }

    lobbies.removeSession(socket.playerId);
  });

  const resumeLobby = lobbies.getLobbyForPlayer(playerId);
  if (resumeLobby && resumeLobby.state.players[playerId]) {
    const player = resumeLobby.state.players[playerId];
    const oldSocket = findSocketByPlayerId(playerId);
    const hasLiveSocket = oldSocket && oldSocket.id !== socket.id && oldSocket.connected;
    if (player.connected === false || hasLiveSocket) {
      if (hasLiveSocket) {
        oldSocket.disconnect(true);
      }
      reconnectPlayerToLobby(socket, resumeLobby);
    }
  }

  socket.emit('init', {
    id: playerId,
    playerId,
    accountId,
    username,
    inLobby: !!lobbies.getLobbyForPlayer(playerId),
    selectedDeck: sessionPlayer.selectedDeck,
    inventory: sessionPlayer.inventory,
    ownedCards: sessionPlayer.ownedCards,
    lobbies: lobbies.listLobbySummaries(),
    keyItemDefs: KEY_ITEM_DEFS,
  });

  broadcastLobbyList();
});

// Server Game Loop
restartBackgroundTimers();

const listenPort = (port !== undefined && port !== null) ? port : (process.env.PORT || 3000);
server.listen(listenPort, () => {
  console.log(`Server listening on port ${listenPort}`);
});
}

// Only start the HTTP server when run directly (not when required by tests)
if (require.main === module) {
  startServer();
}

// ── Conditional exports for unit tests ──
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mulberry32,
    generateLayout,
    damagePlayer,
    damageMinion,
    healPlayer,
    updateEnchantments,
    spawnGroundEnchantment,
    armSelfEnchantment,
    collectConeHits,
    collectRadialHits,
    collectProjectileHits,
    collectReturningProjectileHits,
    applyFreezeInRadius,
    pullEnemiesToward,
    applyKnockback,
    applyPlayerKnockback,
    applyEventHorizon,
    spawnDragonsBreathEffect,
    spawnFireTrailEffect,
    spawnInfernoPillarEffect,
    isEnemyFrozen,
    updateEnemies,
    isPlayerConcealed,
    updateMinions,
    processPendingEchoes,
    spawnLoot,
    spawnCrystals,
    spawnEnemy,
    spawnEnemies,
    updateSurviveSpawns,
    firstRoomPosition,
    pickFloorSpawnPosition,
    buildPlayerRecord,
    createGameState,
    resetGameState,
    gameState,
    setGameState: setProgressionGameState,
    startServer,
    runGameLoopTick,
    cleanupStalePlayers,
    evictDisconnectedPlayers,
    reconnectPlayerToLobby,
    regenMagicStones,
    stateSnapshot,
    createRunState,
    startDungeonRun,
    recordEnemyDefeated,
    isRunObjectiveComplete,
    getEnemyCardDrop,
    recordEnemyCardDrop,
    getEnemyMagicStoneDrop,
    getEnemyCurrencyDrop,
    spawnMagicStoneDrop,
    spawnCurrencyDrop,
    buildCardChoices,
    claimCardReward,
    removeDeadEnemies,
    cleanupAfterDamage,
    clampObjectiveProgress,
    isRunObjectiveComplete,
    buildRunSummary,
    checkRunTerminalState,
    resetTransientRunState,
    returnPlayersToLobby,
    giveUpRun,
    previewReturnRewards,
    createPlayerProgress,
    grantCard,
    grantRunRewards,
    buildPlayerRewardSummary,
    createCardInstance,
    createInventoryFromCardIds,
    createInventoryFromOwnedCards,
    normalizeInventory,
    inventoryToOwnedCards,
    normalizeSelectedDeck,
    normalizePlayerInventory,
    getInventoryInstance,
    cardIdForDeckEntry,
    findAvailableInventoryInstance,
    validateDeck,
    canAddCardInstanceToDeck,
    canAddCardToDeck,
    createDrawDeckFromSelectedDeck,
    drawCardFromDeck,
    initPlayerHand,
    drawReplacementCard,
    replaceConsumedCard,
    exhaustHandSlot,
    discardHandSlot,
    drawCardIntoHand,
    ensurePassiveDrawScheduled,
    processPassiveDraws,
    canDrawIntoHand,
    countFilledHandSlots,
    validateDiscardHand,
    beginCreatureBurnDown,
    releaseBurningCreatureCard,
    drawCardFromDesperationDeck,
    initDesperationDeck,
    createEchoCard,
    getCardDef,
    DESPERATION_CARD_DEFS,
    DESPERATION_DECK_TEMPLATE,
    discardCardFromHand,
    isPlayerOutOfCards,
    validateUseCardHand,
    addMagicStones,
    restoreCardCharges,
    restoreHandCharges,
    QUEST_DEFS,
    DEFAULT_QUEST_ID,
    isValidQuestId,
    buildQuestUpdatePayload,
    CARD_DEFS,
    STARTING_DECK_IDS,
    EVOLUTION_GRIND_REQUIRED,
    EVOLUTION_TRANSFORMS,
    GRIND_COST_BASE,
    GRIND_STAT_SCALE,
    getGrindCost,
    getStatMultiplier,
    scaledGrindStat,
    applyWyrmMinionBreathStats,
    grindCard,
    unlockHatForPlayer,
    createCardInstance,
    createInventoryFromCardIds,
    createInventoryFromOwnedCards,
    normalizeInventory,
    inventoryToOwnedCards,
    normalizePlayerInventory,
    getInventoryInstance,
    evolveCard,
    getCardSellValue,
    getCardBuyValue,
    ensureShopOffer,
    healAtMedic,
  buyShopCard,
    pickShopOffer,
    canSellCardInstance,
    sellCard,
    cancelTradesForPlayer,
    offerCardTrade,
    respondCardTrade,
    checkWallCollision,
    buildWallColliders,
    rebuildWallColliders,
    getWallColliders,
    wallAABB,
    resolveWallCollision,
    checkSweptCollision,
    segmentAABBEntryT,
    segmentIntersectsAABB,
    ENTITY_RADIUS,
    PLAYER_RADIUS,
    isEntityPositionBlocked,
    moveEntityToward,
    computeWalkableAABBs,
    isInsideDungeon,
    tryPlayerMove,
    randomWanderTarget,
    // Server objects for integration tests
    app,
    server,
    io,
    findSocketByPlayerId,
    _intervals,
    _timeouts,
    clearAllTimers,
    // Constants needed by tests
    STALE_THRESHOLD,
    DISCONNECT_GRACE_MS,
    MAX_MAGIC_STONES,
    STARTING_MAGIC_STONES,
    MAGIC_STONES_REGEN_PER_TICK,
    DETECTION_RADIUS,
    ATTACK_RANGE,
    SUMMON_RADIUS,
    COOLDOWN_MS,
    PROJECTILE_HIT_WIDTH,
    TICK_RATE,
    MOVE_SPEED,
    ENEMY_ATTACK_RANGE,
    ENEMY_ATTACK_RECOVERY_MS,
    GRID_COLS,
    GRID_ROWS,
    CELL_SPACING,
    DECK_MIN_SIZE,
    DECK_MAX_SIZE,
    MAX_HP,
    VICTORY_REWARD_ROTATION,
    ENEMY_DEFS,
    MINION_FOLLOW_DISTANCE,
    MINION_FOLLOW_SPEED,
    // Key Items
    KEY_ITEM_DEFS,
    getKeyItemDef,
    getUnlockedKeyItems,
    // Persistence
    extractPersistentData,
    savePlayerData,
    saveAllPlayers,
    setTestProvider,
    persistenceKey,
    get provider() { return getProvider(); },
    // Auth
    verifyToken,
    getJWTSecret,
    // Quests
    QUEST_DEFS,
    DEFAULT_QUEST_ID,
    isValidQuestId,
    buildQuestUpdatePayload,
    checkAllReady,
    captureRunCheckpoint,
    restoreRunCheckpoint,
    suspendRunToLobby,
    maybeSuspendRun,
    tryEnterTelepipe,
    checkTelepipeProximity,
    abandonSuspendedRun,
    isPlayerActive,
    hasActivePlayers,
    buildSuspendedRunSummary,
    clearSuspendedRunData,
    PORTAL_RADIUS,
    PORTAL_PLACEMENT_GRACE_MS,
  };
}
