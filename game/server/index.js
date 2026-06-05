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
  DEFAULT_QUEST_TIER,
  isValidQuestId,
  isValidQuestSelection,
  normalizeQuestTier,
  getLayoutProfileForQuest,
  buildSharedQuestUpdatePayload,
  buildQuestUpdatePayload
} = require('./quests');
const { InMemoryProvider, FileProvider } = require('./providers');
const { findUserByAccountId, unlockHat: unlockHatForAccount, isQuestTierUnlocked, getUnlockedQuestTiers } = require('./users');
const { DEFAULT_COSMETIC, backfillCosmetic, backfillUnlockedHats, HAT_CATALOG } = require('./cosmetic');
const { verifyToken, initAuth, getJWTSecret } = require('./auth');
const {
  mulberry32,
  generateLayout,
  generateHub,
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

// The hub ship-interior layout is deterministic, so build it once at module
// load and deliver the same instance to every lobby client (see emitLobbyJoined).
const HUB_LAYOUT = generateHub(0);
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
const lobbies = require('./lobbies');
const { PHASES, isLobbyPhase, isPlayingPhase } = lobbies;
const {
  syncHubPresenceFromLobby,
  getHubPresenceSnapshot,
  emitHubPresenceUpdate,
  syncAndEmitHubPresenceIfChanged,
} = require('./hubPresence');

const app = express();
// Harness readiness probe — same HTTP server as Socket.IO; no auth required.
// Returns 503 until startServer() finishes mounting routes and socket handlers
// so capture workers never proxy auth/socket traffic to a half-booted server.
let _harnessReady = false;
app.get('/healthz', (_req, res) => {
  if (!_harnessReady) {
    res.status(503).json({ ok: false });
    return;
  }
  res.status(200).json({ ok: true });
});
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust later for production
    methods: ["GET", "POST"]
  }
});
server.setMaxListeners(0);

// Game state factory — shared with lobbies.js to keep the canonical shape in one place
const { createGameState } = require('./game-state');

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
  buildMovementContext,
  buildHubMovementContext,
  hubSpawnPosition,
  applyPlayerMovement,
  flushDirtyPlayerSaves,
  segmentAABBEntryT,
  segmentIntersectsAABB,
  isEntityPositionBlocked,
  moveEntityToward,
  ENTITY_RADIUS,
  PLAYER_RADIUS,
  ENEMY_DEFS,
  enemyDefFor,
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
  spawnVolatileExplosion,
  updateAreaEffects,
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
  CARD_SELL_VALUES,
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
  emitPlayerDeckUpdate,
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
  hotStateSnapshot,
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
const lobbyHandlers = require('./socketHandlers/lobbyHandlers');
const { patchSocketOn } = require('./socketSafe');

// Key-item dispatch lives in its own module; wired up via setCallbacks() below
// once io is defined.
const keyItemEffects = require('./keyItemEffects');

// Debug-scenario setup lives in its own module; wired up via setCallbacks()
// below once io, the index.js-local helpers it needs, and DEBUG_SCENARIOS exist.
const debugScenarios = require('./debugScenarios');

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

function applyLayoutForQuest(state, questId, tier = DEFAULT_QUEST_TIER) {
  const normalizedTier = normalizeQuestTier(tier);
  const profile = getLayoutProfileForQuest(questId, normalizedTier);
  const seed = questLayoutSeed(questId, normalizedTier);
  state.layoutSeed = seed;
  state.layout = generateLayout(seed, profile, { slopes: true });
  state.dungeonBounds = computeDungeonBounds(state.layout);
  state.walkableAABBs = computeWalkableAABBs(state.layout);
  // rebuildWallColliders reads module-level sim state — wrap even when callers are already
  // inside withLobbyContext, because this helper is also invoked at startup/reset with bare state.
  withLobbyContext({ state }, () => rebuildWallColliders());
  console.log(`[server] Layout for quest "${questId}" tier ${normalizedTier}: seed=${seed}, profile=${profile}, rooms=${state.layout.rooms.length}`);
}

// Generate dungeon layout for the default quest at startup (legacy unit-test gameState)
applyLayoutForQuest(
  gameState,
  gameState.selectedQuestId || DEFAULT_QUEST_ID,
  gameState.selectedQuestTier ?? DEFAULT_QUEST_TIER,
);
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
  _intervals.push(setInterval(safeIntervalTick('gameLoop', runGameLoopTick), 1000 / TICK_RATE));
  _intervals.push(setInterval(safeIntervalTick('staleCleanup', cleanupStalePlayersInAllLobbies), STALE_CLEANUP_INTERVAL_MS));
  _intervals.push(setInterval(safeIntervalTick('evictDisconnected', evictDisconnectedPlayers), STALE_CLEANUP_INTERVAL_MS));
  _intervals.push(setInterval(safeIntervalTick('periodicSave', saveAllPlayersInAllLobbies), PERIODIC_SAVE_INTERVAL_MS));
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
  const questTier = fresh.selectedQuestTier ?? DEFAULT_QUEST_TIER;
  Object.keys(gameState).forEach(k => delete gameState[k]);
  Object.assign(gameState, fresh);
  applyLayoutForQuest(gameState, questId, questTier);
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
  'volatile-enemy',
  'warded-enemy',
  'variant-leeching',
  'variant-frenzied',
  'frenzied-enemy',
  'spawner-active',
  'monster-card',
  'aegis-sentinel-ready',
  'minion-combat',
  'run-failed',
  'run-exhausted',
  'quest-objective-near-complete',
  'collect-prisms-progress',
  'telepipe-ready',
  'extracted-in-hub',
  'suspended-run-hub',
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
  'open-verticality',
  'sunken-canyon',
  'sunken-canyon-stage',
  'sunken-canyon-cliff-hazard',
  'spire-ascent',
  'spire-ascent-stage',
  'spire-summit-beacon',
  'spire-mid-tier-hazard',
  'hat-shop-currency',
  'hats-unlocked',
  'evolution-ready',
  'deck-viewer-instances',
  'cinder-snare-ready',
  'quest-tier-2-unlocked',
]);

// Wire debugScenarios with io, the index.js-local helpers its setup chain needs,
// and the DEBUG_SCENARIOS set (defined just above). All injected helpers are
// hoisted function declarations / module-level constants available by now.
debugScenarios.setCallbacks({
  io,
  getLobbyForSocket,
  withLobbyContext,
  enterPlayingPhase,
  ensureNearbyEnemy,
  applyLayoutForQuest,
  broadcastLobbyUpdate,
  emitQuestPayloadToLobby,
  DEBUG_SCENARIOS,
});

// Helper: build a compact player list for lobbyUpdate payloads
function lobbyPlayerList(state) {
  return Object.entries(state.players).map(([id, p]) => ({
    id,
    ready: p.ready
  }));
}

function unlockedQuestTiersForLobbyPlayer(state, playerId) {
  const player = state.players[playerId];
  if (!player || !player.accountId) return {};
  return getUnlockedQuestTiers(player.accountId) || {};
}

/** Emit questUpdate/lobbyUpdate shared fields to each lobby socket with per-account unlock maps. */
function emitQuestPayloadToLobby(lobby, { event = 'questUpdate', extraFields = {} } = {}) {
  if (!lobby) return;
  const state = lobby.state;
  const shared = {
    ...buildSharedQuestUpdatePayload(state),
    ...extraFields,
  };
  for (const socket of io.sockets.sockets.values()) {
    if (!socket.rooms.has(lobby.id)) continue;
    const player = state.players[socket.playerId];
    if (!player) continue;
    socket.emit(event, {
      ...shared,
      unlockedQuestTiers: unlockedQuestTiersForLobbyPlayer(state, socket.playerId),
    });
  }
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
      const shared = {
        players: lobbyPlayerList(activeState),
        gamePhase: activeState.gamePhase,
        shopOffer: activeState.shopOffer,
        ...buildSharedQuestUpdatePayload(activeState),
      };
      for (const socket of io.sockets.sockets.values()) {
        const player = activeState.players[socket.playerId];
        if (!player) continue;
        socket.emit('lobbyUpdate', {
          ...shared,
          unlockedQuestTiers: unlockedQuestTiersForLobbyPlayer(activeState, socket.playerId),
        });
      }
    });
    broadcastLobbyList();
    return;
  }
  withLobbyContext(lobby, () => {
    ensureShopOffer();
    const shared = {
      lobbyId: lobby.id,
      players: lobbyPlayerList(lobby.state),
      gamePhase: lobby.state.gamePhase,
      shopOffer: lobby.state.shopOffer,
      ...buildSharedQuestUpdatePayload(lobby.state),
    };
    for (const socket of io.sockets.sockets.values()) {
      if (!socket.rooms.has(lobby.id)) continue;
      const player = lobby.state.players[socket.playerId];
      if (!player) continue;
      socket.emit('lobbyUpdate', {
        ...shared,
        unlockedQuestTiers: unlockedQuestTiersForLobbyPlayer(lobby.state, socket.playerId),
      });
    }
  });
  broadcastLobbyList();
}

progression.setBroadcastLobbyUpdate(broadcastLobbyUpdate);

// Helper: find a live Socket.IO socket by the stable playerId assigned on connect.
// Socket.IO keys sockets by socket.id (a random string), not by playerId,
// so we must iterate and match on socket.playerId.
function findSocketByPlayerId(playerId, excludeSocketId) {
  for (const socket of io.sockets.sockets.values()) {
    if (excludeSocketId && socket.id === excludeSocketId) {
      continue;
    }
    if (socket.playerId === playerId) {
      return socket;
    }
  }
  return null;
}

function evictPriorSocketForPlayer(playerId, currentSocketId) {
  const priorSocket = findSocketByPlayerId(playerId, currentSocketId);
  if (priorSocket && priorSocket.connected) {
    priorSocket.disconnect(true);
  }
}

function isDebugScenarioAllowed(socket) {
  if (process.env.ALLOW_DEBUG_SCENARIOS === '1') return true;
  if (process.env.NODE_ENV === 'production') return false;

  const address = socket.handshake.address || '';
  return (
    address === '::1' ||
    address === '127.0.0.1' ||
    address.endsWith('.127.0.0.1') ||
    address.startsWith('::ffff:127.')
  );
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
  'volatile-enemy',
  'warded-enemy',
  'variant-leeching',
  'variant-frenzied',
  'frenzied-enemy',
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
  if (!isPlayingPhase(state)) {
    lobbies.setPhase(lobby, PHASES.PLAYING);
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
  // Thin wrapper: the up-front guards, shared player reset, and the per-`name`
  // scenario setup chain all live in ./debugScenarios (wired via setCallbacks
  // above). Behavior and the { ok, ... } return contract are unchanged.
  return debugScenarios.applyDebugScenario(socket, name);
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

// Log HTTP listen/runtime errors instead of letting them become fatal
// 'error' events when no listener is attached (e.g. EADDRINUSE on boot).
let _httpErrorLoggerInstalled = false;

function ensureHttpErrorLogger() {
  if (_httpErrorLoggerInstalled) return;
  _httpErrorLoggerInstalled = true;
  server.on('error', (err) => {
    console.error('[server] HTTP server error:', err);
  });
}

/**
 * When run as the main module, log fatal-async errors but keep serving.
 * Tests that require('./index') are unaffected.
 */
function installMainProcessErrorHandlers() {
  process.on('uncaughtException', (err) => {
    console.error('[server] uncaughtException:', err && err.stack ? err.stack : err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[server] unhandledRejection:', reason);
  });
}

function safeIntervalTick(label, fn) {
  return () => {
    try {
      fn();
    } catch (err) {
      console.error(`[interval:${label}]`, err && err.stack ? err.stack : err);
    }
  };
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

/** @param {{ requirePhase?: 'lobby' | 'playing', phaseMismatch?: { event: string, payload: object } }} options */
function withLobbyPlayer(socket, options, fn) {
  const { requirePhase, phaseMismatch } = options || {};
  return withLobbyFromSocket(socket, (state, lobby) => {
    if (requirePhase === 'lobby' && !isLobbyPhase(state)) {
      if (phaseMismatch) socket.emit(phaseMismatch.event, phaseMismatch.payload);
      return;
    }
    if (requirePhase === 'playing' && !isPlayingPhase(state)) {
      if (phaseMismatch) socket.emit(phaseMismatch.event, phaseMismatch.payload);
      return;
    }
    const player = state.players[socket.playerId];
    if (!player) return;
    return fn(state, lobby, player);
  });
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

function copyCosmetic(cosmetic) {
  const filled = backfillCosmetic(cosmetic);
  return {
    ...filled,
    proportions: { ...filled.proportions },
  };
}

/**
 * Push a saved account cosmetic onto every connected in-memory player record for
 * that account (legacy singleton gameState and all active lobby states).
 */
function syncLivePlayerCosmetic(accountId, cosmetic) {
  if (!accountId) return;
  const assign = (player) => {
    if (player && player.accountId === accountId) {
      player.cosmetic = copyCosmetic(cosmetic);
    }
  };
  for (const player of Object.values(gameState.players)) {
    assign(player);
  }
  for (const lobby of lobbies._lobbies.values()) {
    for (const player of Object.values(lobby.state.players)) {
      assign(player);
    }
  }
}

/** True when the account has a connected player record in an active lobby hub phase. */
function hasLiveLobbyPlayerForAccount(accountId) {
  if (!accountId) return false;
  for (const lobby of lobbies._lobbies.values()) {
    if (!isLobbyPhase(lobby.state)) continue;
    const player = lobby.state.players[accountId];
    if (player && player.accountId === accountId) return true;
  }
  if (isLobbyPhase(gameState) && gameState.players[accountId]) {
    return true;
  }
  return false;
}

function buildSessionFromPlayer(player) {
  return {
    playerId: player.id,
    accountId: player.accountId,
    username: player.username,
    selectedDeck: player.selectedDeck,
    inventory: player.inventory,
    ownedCards: player.ownedCards,
    currency: player.currency,
  };
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

/**
 * Drop-in policy for mid-run lobby joins. When true, joinLobby permits
 * joinPlayerToLobby with drop-in setup (see joinLobbyWithPhasePolicy).
 */
function allowDropInJoin(lobby) {
  return isPlayingPhase(lobby.state);
}

/** Active-run join setup; only called from the playing-phase drop-in path. */
function handleDropInJoin(socket, lobby) {
  const player = lobby.state.players[socket.playerId];
  if (!player) return;
  withLobbyContext(lobby, () => initializePlayerForActiveRun(player));
}

function joinLobbyWithPhasePolicy(socket, lobby) {
  if (isPlayingPhase(lobby.state)) {
    if (!allowDropInJoin(lobby)) {
      socket.emit('lobbyError', { reason: 'Drop-in not allowed for this lobby' });
      return;
    }
    joinPlayerToLobby(socket, lobby, { dropIn: true });
    return;
  }
  joinPlayerToLobby(socket, lobby);
}

function emitLobbyJoined(socket, lobby, explicitPlayerId) {
  const state = lobby.state;
  const playerId = explicitPlayerId ?? socket.playerId;
  const player = state.players[playerId];
  if (!player) return;
  withLobbyContext(lobby, () => ensureShopOffer(lobby.state));

  const joinedPayload = {
    lobbyId: lobby.id,
    lobbyName: lobby.name,
    id: playerId,
    playerId,
    accountId: player.accountId,
    username: player.username,
    state,
    layoutSeed: state.layoutSeed,
    layout: state.layout,
    hubLayout: HUB_LAYOUT,
    selectedDeck: player.selectedDeck,
    inventory: player.inventory,
    ownedCards: player.ownedCards,
    shopOffer: state.shopOffer,
    ...buildQuestUpdatePayload(state, player.accountId),
  };
  if (isLobbyPhase(state)) {
    try {
      syncHubPresenceFromLobby(lobby);
      joinedPayload.hubPresence = getHubPresenceSnapshot(lobby);
    } catch (err) {
      console.error('[hubPresence] lobbyJoined snapshot failed for lobby', lobby.id, err);
      joinedPayload.hubPresence = { schemaVersion: 1, entries: {}, revision: 0 };
    }
  }
  socket.emit('lobbyJoined', joinedPayload);

  broadcastLobbyUpdate(lobby);
}

function joinPlayerToLobby(socket, lobby, options = {}) {
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

  if (isLobbyPhase(state)) {
    const lobbyPlayer = state.players[playerId];
    revivePlayerInLobby(lobbyPlayer);
    const hubSpawn = hubSpawnPosition(HUB_LAYOUT);
    lobbyPlayer.x = hubSpawn.x;
    lobbyPlayer.z = hubSpawn.z;
    lobbyPlayer.y = resolveFloorY(sampleFloorY(HUB_LAYOUT, hubSpawn.x, hubSpawn.z));
  }

  if (options.dropIn) {
    handleDropInJoin(socket, lobby);
  }

  const player = state.players[playerId];
  player.activeSocketId = socket.id;
  player.connected = true;
  player.disconnectedAt = null;

  lobbies.assignPlayerToLobby(playerId, lobby.id);
  lobbies.removeSession(playerId);
  socket.join(lobby.id);
  emitLobbyJoined(socket, lobby);
  if (isLobbyPhase(state)) {
    try {
      emitHubPresenceUpdate(io, lobby, { excludeSocketId: socket.id });
    } catch (err) {
      console.error('[hubPresence] join broadcast failed for lobby', lobby.id, err);
    }
  }
}

function reconnectPlayerToLobby(socket, lobby, explicitPlayerId) {
  const playerId = explicitPlayerId ?? socket.playerId;
  const player = lobby.state.players[playerId];
  if (!player) return false;

  evictPriorSocketForPlayer(playerId, socket.id);

  player.activeSocketId = socket.id;
  player.connected = true;
  player.disconnectedAt = null;
  player.lastInputSequence = 0;
  player.inputActive = false;
  player.inputDx = 0;
  player.inputDz = 0;
  player.lastActivity = Date.now();

  lobbies.assignPlayerToLobby(playerId, lobby.id);
  lobbies.removeSession(playerId);
  socket.join(lobby.id);
  emitLobbyJoined(socket, lobby, playerId);
  if (isLobbyPhase(lobby.state)) {
    try {
      emitHubPresenceUpdate(io, lobby, { excludeSocketId: socket.id });
    } catch (err) {
      console.error('[hubPresence] reconnect broadcast failed for lobby', lobby.id, err);
    }
  }
  io.to(lobby.id).emit('playerReconnected', playerId);
  broadcastLobbyList();
  return true;
}

function notifyPlayerRemoved(lobby, { playerId, result, emitDisconnect = false } = {}) {
  if (emitDisconnect) {
    io.to(lobby.id).emit('playerDisconnected', playerId);
  }

  const shouldBroadcast = result === undefined || (result && !result.deleted);
  if (!shouldBroadcast) return;

  withLobbyContext(lobby, () => {
    if (isPlayingPhase(lobby.state)) {
      checkRunTerminalState();
    } else {
      broadcastLobbyUpdate(lobby);
      if (isLobbyPhase(lobby.state) && playerId) {
        try {
          syncHubPresenceFromLobby(lobby);
          emitHubPresenceUpdate(io, lobby, {
            removedPlayerIds: [playerId],
          });
        } catch (err) {
          console.error('[hubPresence] leave/disconnect broadcast failed for lobby', lobby.id, err);
        }
      }
    }
  });
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
    player.ready = false;
    player.disconnectedAt = Date.now();
    player.inputActive = false;
    player.inputDx = 0;
    player.inputDz = 0;
  });
  notifyPlayerRemoved(lobby, { playerId, emitDisconnect: false });
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
      notifyPlayerRemoved(lobby, { playerId, result, emitDisconnect: true });
      evictedAny = true;
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
  notifyPlayerRemoved(lobby, { playerId, result, emitDisconnect: true });

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
    try {
      withLobbyContext(lobby, () => {
        const state = lobby.state;
        if (isLobbyPhase(state)) {
          applyPlayerMovement(state, buildHubMovementContext(HUB_LAYOUT));
          syncAndEmitHubPresenceIfChanged(io, lobby);
          flushDirtyPlayerSaves();
        } else if (isPlayingPhase(state)) {
          applyPlayerMovement(state, buildMovementContext(state));
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

          if (state._pendingVolatileExplosions?.length) {
            for (const record of state._pendingVolatileExplosions) {
              io.to(lobby.id).emit('volatileExplosion', record);
            }
            state._pendingVolatileExplosions.length = 0;
          }

          if (state._pendingLeechHeals?.length) {
            for (const record of state._pendingLeechHeals) {
              io.to(lobby.id).emit('leechHeal', record);
            }
            state._pendingLeechHeals.length = 0;
          }

          if (state._pendingShieldBreaks?.length) {
            for (const record of state._pendingShieldBreaks) {
              io.to(lobby.id).emit('shieldBreak', record);
            }
            state._pendingShieldBreaks.length = 0;
          }

          regenMagicStones();

          state.loot = state.loot.filter(l => (now - l.createdAt) < LOOT_LIFETIME_MS);
        }

        const snapshot = hotStateSnapshot();
        io.to(lobby.id).emit('stateUpdate', snapshot);
      });
    } catch (err) {
      console.error(`[gameLoop] lobby ${lobby.id} tick failed:`, err && err.stack ? err.stack : err);
    }
  }
  return true;
}

function startServer(port) {
  ensureHttpErrorLogger();

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
    const { requireAdminPassword, adminHandler } = require('./admin');
    app.use('/api', authRouter);
    app.use('/api', accountRouter);
    // Read-only admin roster page, gated by ADMIN_PASSWORD (separate from the
    // player JWT auth). GET-only — no mutation routes are mounted under /admin.
    app.get('/admin', requireAdminPassword, adminHandler);
    _routesMounted = true;
  }

  const listenPort = (port !== undefined && port !== null) ? port : (process.env.PORT || 3000);
  if (!server.listening) {
    server.listen(listenPort, () => {
      console.log(`Server listening on port ${listenPort}`);
    });
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
    patchSocketOn(socket);

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

    const savedData = loadSavedPlayerData(accountId || playerId);
    const sessionPlayer = buildPlayerRecord(playerId, accountId, username, savedData);
    lobbies.registerSession(playerId, buildSessionFromPlayer(sessionPlayer));

    const ctx = {
      playerId,
      accountId,
      username,
      sessionPlayer,
      socket,
      lobbies,
      withLobbyContext,
      applyLayoutForQuest,
      ensureShopOffer,
      joinPlayerToLobby,
      joinLobbyWithPhasePolicy,
      leaveLobbyForSocket,
      buildSessionFromPlayer,
      reconnectPlayerToLobby,
      withLobbyPlayer,
      withLobbyFromSocket,
      broadcastLobbyUpdate,
      emitQuestPayloadToLobby,
      findSocketByPlayerId,
      io,
      returnPlayersToLobby,
      giveUpRun,
      abandonSuspendedRun,
      claimCardReward,
      cardEffects,
      applyDebugScenario,
      isDebugScenarioAllowed,
      softDisconnectPlayerFromLobby,
      hubLayout: HUB_LAYOUT,
      syncLivePlayerCosmetic,
    };
    lobbyHandlers.register(socket, ctx);

    const resumeLobby = lobbies.getLobbyForPlayer(playerId);
    if (resumeLobby && resumeLobby.state.players[playerId]) {
      const player = resumeLobby.state.players[playerId];
      const priorSocket = findSocketByPlayerId(playerId, socket.id);
      const hasLiveSocket = priorSocket && priorSocket.connected;
      if (player.connected === false || hasLiveSocket) {
        reconnectPlayerToLobby(socket, resumeLobby, playerId);
      }
    }

    socket.playerId = playerId;
    console.log(`Player connected: socket=${socket.id}, playerId=${playerId}`);

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

  _harnessReady = true;
}

// Only start the HTTP server when run directly (not when required by tests)
if (require.main === module) {
  installMainProcessErrorHandlers();
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
    spawnVolatileExplosion,
    updateAreaEffects,
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
    syncLivePlayerCosmetic,
    hasLiveLobbyPlayerForAccount,
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
    hotStateSnapshot,
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
    emitPlayerDeckUpdate,
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
    CARD_SELL_VALUES,
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
    // Hub layout delivered to lobby clients via lobbyJoined
    HUB_LAYOUT,
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
    enemyDefFor,
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
    getProvider,
    persistenceKey,
    get provider() { return getProvider(); },
    // Auth
    verifyToken,
    getJWTSecret,
    // Debug gate
    isDebugScenarioAllowed,
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
