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
const { findUserByAccountId } = require('./users');
const { DEFAULT_COSMETIC, HAT_CATALOG } = require('./cosmetic');
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
const lobbies = require('./lobbies');
const { PHASES, isLobbyPhase, isPlayingPhase } = lobbies;

const app = express();
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

// Debug-scenario setup lives in its own module; wired up via setCallbacks()
// below once io, the index.js-local helpers it needs, and DEBUG_SCENARIOS exist.
const debugScenarios = require('./debugScenarios');
const { createSocketContext, lobbyHandlers, deckHandlers } = require('./socketHandlers');

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
  'evolution-ready',
  'deck-viewer-instances',
  'cinder-snare-ready',
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
  DEBUG_SCENARIOS,
});

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
  withLobbyContext(lobby, () => ensureShopOffer());

  socket.emit('lobbyJoined', {
    lobbyId: lobby.id,
    lobbyName: lobby.name,
    id: playerId,
    playerId,
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
    revivePlayerInLobby(state.players[playerId]);
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
    player.ready = false;
    player.disconnectedAt = Date.now();
    player.inputActive = false;
    player.inputDx = 0;
    player.inputDz = 0;

    if (isPlayingPhase(lobby.state)) {
      checkRunTerminalState();
    } else {
      broadcastLobbyUpdate(lobby);
    }
  });
  broadcastLobbyList();
  return { lobby, playerId };
}

/**
 * Remove a player from a lobby, broadcast playerDisconnected, and run
 * post-removal follow-up (terminal check during runs, lobby update otherwise).
 */
function notifyPlayerRemoved(lobby, playerId) {
  const result = lobbies.removePlayerFromLobby(playerId);
  io.to(lobby.id).emit('playerDisconnected', playerId);

  if (result && !result.deleted) {
    withLobbyContext(lobby, () => {
      if (isPlayingPhase(lobby.state)) {
        checkRunTerminalState();
      } else {
        broadcastLobbyUpdate(lobby);
      }
    });
  }

  return result;
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
      notifyPlayerRemoved(lobby, playerId);
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

  const result = notifyPlayerRemoved(lobby, playerId);
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
      if (isPlayingPhase(state)) {
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

        if (state._pendingVolatileExplosions?.length) {
          for (const record of state._pendingVolatileExplosions) {
            io.to(lobby.id).emit('volatileExplosion', record);
          }
          state._pendingVolatileExplosions.length = 0;
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

    const savedData = loadSavedPlayerData(accountId || playerId);
    const sessionPlayer = buildPlayerRecord(playerId, accountId, username, savedData);
    lobbies.registerSession(playerId, buildSessionFromPlayer(sessionPlayer));

    const ctx = createSocketContext({
      socket,
      playerId,
      accountId,
      username,
      sessionPlayer,
      withLobbyFromSocket,
      withLobbyPlayer,
      withLobbyContext,
      broadcastLobbyUpdate,
      findSocketByPlayerId,
      savePlayerData,
      io,
      joinPlayerToLobby,
      joinLobbyWithPhasePolicy,
      leaveLobbyForSocket,
      reconnectPlayerToLobby,
      applyLayoutForQuest,
      buildSessionFromPlayer,
    });
    lobbyHandlers.register(socket, ctx);
    deckHandlers.register(socket, ctx);

  socket.on('move', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (!isPlayingPhase(state)) return;

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
    if (!isPlayingPhase(state)) return;
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
        if (!isPlayingPhase(state) || !state.run || state.run.status === 'suspended') {
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

  socket.on('equipKeyItem', (data) => {
    withLobbyPlayer(socket, {
      requirePhase: 'lobby',
      phaseMismatch: { event: 'keyItemError', payload: { reason: 'not_in_lobby' } },
    }, (state, lobby, player) => {
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

  socket.on('offerCardTrade', (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    if (!data) return;

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
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    if (!data) return;

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
    buyShopCard: progression.buyShopCard,
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
