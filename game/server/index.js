const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  QUEST_DEFS,
  DEFAULT_QUEST_ID,
  isValidQuestId,
  buildQuestUpdatePayload
} = require('./quests');
const { InMemoryProvider, FileProvider } = require('./providers');
const { verifyToken, initAuth, getJWTSecret } = require('./auth');
const {
  mulberry32,
  generateLayout,
  roomsByRole,
  randomRoomPositionByRole,
  GRID_COLS,
  GRID_ROWS,
  CELL_SPACING,
  MIN_ROOM_SIZE,
  MAX_ROOM_SIZE_INCLUSIVE,
  PASSAGE_WIDTH
} = require('./dungeon');
const {
  TICK_RATE,
  MOVE_SPEED,
  MAX_ELAPSED_MS,
  DETECTION_RADIUS,
  ENEMY_ATTACK_RANGE,
  ENEMY_ATTACK_RECOVERY_MS,
  MAX_MAGIC_STONES,
  MAGIC_STONES_REGEN_PER_TICK,
  SUMMON_RADIUS,
  ATTACK_RANGE,
  ATTACK_CONE_ANGLE,
  STALE_THRESHOLD,
  BOUNDS_MARGIN,
  COOLDOWN_MS,
  SPAWN_PADDING,
  DECK_MIN_SIZE,
  DECK_MAX_SIZE,
  MAX_HP,
  RESPAWN_DELAY_MS,
  LOOT_LIFETIME_MS,
  LOOT_SPAWN_CHANCE,
  STALE_CLEANUP_INTERVAL_MS,
  PERIODIC_SAVE_INTERVAL_MS,
  VICTORY_REWARD_ROTATION
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
    lobby: [],
    gamePhase: 'lobby',
    selectedQuestId: DEFAULT_QUEST_ID,
    pendingTrades: {}
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
  firstRoomPosition,
  randomRoomPosition,
  clampToDungeon,
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
  ENEMY_DEFS,
  MINION_FOLLOW_DISTANCE,
  MINION_FOLLOW_SPEED,
  updateEnemies,
  updateMinions,
  damagePlayer,
  healPlayer,
  collectConeHits,
  collectRadialHits,
  collectReturningProjectileHits,
  applyFreezeInRadius,
  pullEnemiesToward,
  spawnDragonsBreathEffect,
  isEnemyFrozen,
  cleanupStalePlayers,
  regenMagicStones,
  randomWanderTarget,
  nearbySpawnPosition,
  setTerminalCheckCallback,
  setFindSocketCallback,
  setSavePlayerCallback
} = require('./simulation');

const progression = require('./progression');
const {
  CARD_DEFS,
  STARTING_DECK_IDS,
  EVOLUTION_GRIND_REQUIRED,
  EVOLUTION_TRANSFORMS,
  GRIND_COST_BASE,
  GRIND_STAT_SCALE,
  getGrindCost,
  getStatMultiplier,
  scaledGrindStat,
  grindCard,
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
  canSellCardInstance,
  sellCard,
  cancelTradesForPlayer,
  offerCardTrade,
  respondCardTrade,
  upgradeCard,
  getUpgradeCost,
  getLevelStatMultiplier,
  MAX_CARD_LEVEL,
  UPGRADE_COST_BASE,
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
  getEnemyCardDrop,
  recordEnemyCardDrop,
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
  validateUseCardHand,
  addMagicStones,
  restoreCardCharges,
  restoreHandCharges,
  spawnEnemy,
  spawnEnemies,
  spawnLoot,
  removeDeadEnemies,
  cleanupAfterDamage,
  checkRunTerminalState,
  resetTransientRunState,
  returnPlayersToLobby,
  checkAllReady,
  stateSnapshot
} = progression;

// Throttle state for swept-collision rejection logging (per-socket)
const SWEPT_COLLISION_LOG_THROTTLE_MS = 1000;
const sweptCollisionLogTimes = new Map();

// Initialize simulation and progression modules with gameState and timeouts
const sim = require('./simulation');
sim.setGameState(gameState, _timeouts);
progression.initProgression({ gameState, getIo: () => io });

// Wire simulation callbacks (so simulation.js can call back into progression).
setTerminalCheckCallback(checkRunTerminalState);
setFindSocketCallback(findSocketByPlayerId);
setSavePlayerCallback(savePlayerData);

// Generate dungeon layout at startup
const layoutSeed = Math.floor(Math.random() * 2147483647);
gameState.layoutSeed = layoutSeed;
gameState.layout = generateLayout(layoutSeed);
console.log(`[server] Dungeon seed: ${layoutSeed}, rooms: ${gameState.layout.rooms.length}`);

gameState.dungeonBounds = computeDungeonBounds(gameState.layout);
rebuildWallColliders();
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

/**
 * Reset gameState to a fresh state. Used by integration tests to isolate tests.
 * Regenerates dungeon layout with a new random seed.
 */
function resetGameState() {
  const fresh = createGameState();
  Object.keys(gameState).forEach(k => delete gameState[k]);
  Object.assign(gameState, fresh);
  const seed = Math.floor(Math.random() * 2147483647);
  gameState.layoutSeed = seed;
  gameState.layout = generateLayout(seed);
  gameState.dungeonBounds = computeDungeonBounds(gameState.layout);
  rebuildWallColliders();
  // Ensure run is cleared — it should not exist after a reset
  delete gameState.run;
  // Clear victory counters so reward card selection resets between tests
  delete gameState._victoryCounters;
}

const DEBUG_SCENARIOS = new Set([
  'summon-low-mana',
  'summon-ready',
  'combat-damaged-player',
  'mixed-enemies',
  'spawner-active',
  'monster-card',
]);

// Helper: build a compact player list for lobbyUpdate payloads
function lobbyPlayerList() {
  return Object.entries(gameState.players).map(([id, p]) => ({
    id,
    ready: p.ready
  }));
}

// Helper: broadcast lobbyUpdate to all connected clients
function broadcastLobbyUpdate() {
  io.emit('lobbyUpdate', {
    players: lobbyPlayerList(),
    gamePhase: gameState.gamePhase,
    ...buildQuestUpdatePayload(gameState)
  });
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

function ensureNearbyEnemy(x, z) {
  const nearby = gameState.enemies.some(enemy => Math.hypot(enemy.x - x, enemy.z - z) < 6);
  if (nearby) return;

  const enemy = spawnEnemy(x + 3, z, 'grunt');
  enemy.wanderTarget = { x: x + 3, z };
}

function enterPlayingPhase() {
  if (gameState.gamePhase !== 'playing') {
    gameState.gamePhase = 'playing';
    // Initialize draw decks and hands for all players (idempotent — safe to call from both checkAllReady and applyDebugScenario)
    for (const player of Object.values(gameState.players)) {
      if (!player.hand || player.hand.length === 0) {
        createDrawDeckFromSelectedDeck(player);
        initPlayerHand(player);
      }
    }
    spawnEnemies();
    startDungeonRun();
    io.emit('startGame');
  }
}

function applyDebugScenario(socket, name) {
  if (!DEBUG_SCENARIOS.has(name)) {
    return { ok: false, reason: `Unknown debug scenario: ${name}` };
  }

  const player = gameState.players[socket.playerId];
  if (!player) return { ok: false, reason: 'No player for debug scenario' };
  const spawn = firstRoomPosition();

  // Validate deck — same check the normal playerReady path uses
  normalizePlayerInventory(player);
  const result = validateDeck(player.selectedDeck, player.inventory);
  if (!result.valid) return { ok: false, reason: result.reason };

  player.ready = true;
  player.dead = false;
  player.firstMoveAfterSpawn = false;
  player.lastMoveTime = Date.now();
  player.x = spawn.x;
  player.y = 0.5;
  player.z = spawn.z;
  player.debugScenario = name;
  player.pendingSummons.clear();
  enterPlayingPhase();

  // Per-player initialization: when enterPlayingPhase() skipped because
  // gamePhase was already 'playing' (multi-client debug scenario), this
  // player may not have a hand, deck, cooldowns, or pendingSummons.
  if (gameState.gamePhase === 'playing' && (!player.hand || player.hand.length === 0)) {
    createDrawDeckFromSelectedDeck(player);
    initPlayerHand(player);
    player.slotCooldowns = [null, null, null, null];
    if (!player.pendingSummons) {
      player.pendingSummons = new Set();
    }
  }

  ensureNearbyEnemy(player.x, player.z);

  if (name === 'summon-low-mana') {
    player.hp = MAX_HP;
    player.magicStones = 0;
  } else if (name === 'summon-ready') {
    player.hp = MAX_HP;
    player.magicStones = MAX_MAGIC_STONES;
    // Guarantee at least one summon card in hand so integration tests are deterministic
    if (!player.hand.some(c => c && c.type === 'summon')) {
      const replaceSlot = player.hand.findIndex(c => c && c.type !== 'summon');
      if (replaceSlot >= 0) {
        player.hand[replaceSlot] = { id: 'battle_familiar', name: 'Battle Familiar', type: 'summon', charges: 1, remainingCharges: 1, magicStoneCost: 50, damage: 40 };
      }
    }
  } else if (name === 'combat-damaged-player') {
    player.hp = 25;
    player.magicStones = MAX_MAGIC_STONES;
  } else if (name === 'mixed-enemies') {
    // Spawn one of each enemy type near the player for visual verification
    player.hp = MAX_HP;
    player.magicStones = MAX_MAGIC_STONES;
    // Clear any existing enemies so we get a clean set
    gameState.enemies = [];
    spawnEnemy(player.x + 3, player.z, 'grunt');
    spawnEnemy(player.x - 3, player.z, 'skirmisher');
    spawnEnemy(player.x, player.z + 4, 'miniboss');
    spawnEnemy(player.x, player.z - 4, 'spawner');
    // Set wander targets so they don't all stack
    for (const e of gameState.enemies) {
      e.wanderTarget = { x: e.x + (Math.random() * 4 - 2), z: e.z + (Math.random() * 4 - 2) };
    }
  } else if (name === 'spawner-active') {
    // Spawn a spawner near the player with lastSpawnTime in the past so
    // the first add appears on the very next updateEnemies() tick.
    player.hp = MAX_HP;
    player.magicStones = MAX_MAGIC_STONES;
    gameState.enemies = [];
    const spawner = spawnEnemy(player.x + 4, player.z, 'spawner');
    spawner.lastSpawnTime = Date.now() - ENEMY_DEFS.spawner.spawnIntervalMs - 500;
  } else if (name === 'monster-card') {
    // Guarantee at least one monster card in hand so integration tests
    // and visual capture can exercise monster-card behavior deterministically.
    player.hp = MAX_HP;
    player.magicStones = MAX_MAGIC_STONES;
    if (!player.hand.some(c => c && c.type === 'monster')) {
      const replaceSlot = player.hand.findIndex(c => c && c.type !== 'monster');
      if (replaceSlot >= 0) {
        player.hand[replaceSlot] = { id: 'dungeon_drake', name: 'Dungeon Drake', type: 'monster', charges: 1, remainingCharges: 1 };
        const deckMonsterIndex = player.deck ? player.deck.indexOf('dungeon_drake') : -1;
        if (deckMonsterIndex !== -1) {
          player.deck.splice(deckMonsterIndex, 1);
        }
      }
    }
  }

  // Scenario enemy mutations above can add to or replace the enemy list
  // after enterPlayingPhase() / startDungeonRun() snapshot the count. Resync
  // the run objective so totalEnemies reflects the final authoritative list.
  syncRunObjectiveToEnemies();

  broadcastLobbyUpdate();
  io.emit('stateUpdate', stateSnapshot());
  return { ok: true, scenario: name };
}

function findSacrificeTarget(playerId, x, z, radius) {
  return gameState.minions
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

// ── Server startup (deferred so tests can import without starting HTTP) ──

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
    app.use('/api', authRouter);
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
  if (process.env.PERSISTENCE_BACKEND === 'memory') {
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

    // Map socket.id → stable playerId (for lookup in socket handlers)
    socket.playerId = playerId;
    console.log(`Player connected: socket=${socket.id}, playerId=${playerId}`);

    const spawn = firstRoomPosition();

    // ── Load persisted data (if any) ──
    // Use accountId as the persistence key when authenticated; fall back to playerId.
    let savedData = null;
    const loadKey = accountId || playerId;
    try {
      savedData = getProvider() ? getProvider().loadPlayer(loadKey) : null;
    } catch (err) {
      console.error(`[persistence] loadPlayer failed for ${loadKey}:`, err.message);
      savedData = null;
    }

    // Initialize player state on connection.
    if (!gameState.players[playerId]) {
      const progress = createPlayerProgress();

      // Default selected deck: the full 8-card starting deck (STARTING_DECK_IDS),
      // so players have a draw-deck reserve beyond the 4-card opening hand.
      const defaultDeck = progress.inventory.map(instance => instance.instanceId);

      gameState.players[playerId] = {
        id: playerId,
        accountId: accountId,
        username: username,
        x: spawn.x,
        y: 0.5,
        z: spawn.z,
        rotation: 0,
        deck: [],
        hp: MAX_HP,
        dead: false,
        lastActivity: Date.now(),
        lastMoveTime: Date.now(),
        ready: false,
        magicStones: MAX_MAGIC_STONES,
        currency: progress.currency,
        inventory: progress.inventory,
        ownedCards: progress.ownedCards,
        runRewards: progress.runRewards,
        currencyEarnedThisRun: progress.currencyEarnedThisRun,
        selectedDeck: defaultDeck,
        debugScenario: null,
        pendingSummons: new Set(),
        slotCooldowns: [null, null, null, null]
      };
    }

    // ── Merge saved data into player state ──
    const player = gameState.players[playerId];
    if (savedData) {
      player.currency = savedData.currency ?? player.currency;
      if (savedData.inventory || savedData.ownedCards) {
        player.inventory = normalizeInventory(savedData.inventory, savedData.ownedCards);
        player.ownedCards = inventoryToOwnedCards(player.inventory);
      }
      player.selectedDeck = savedData.selectedDeck && savedData.selectedDeck.length > 0
        ? normalizeSelectedDeck(savedData.selectedDeck, player.inventory)
        : player.selectedDeck;
      // Restore persisted location regardless of game phase (lobby or mid-run)
      player.x = savedData.x ?? player.x;
      player.y = savedData.y ?? player.y;
      player.z = savedData.z ?? player.z;
      player.rotation = savedData.rotation ?? player.rotation;
    }
    normalizePlayerInventory(player);

    // ── Initialize combat hand/deck on active-run reconnect ──
    // When a player cold-reconnects during an active dungeon run, the server
    // restores their location from persisted data but leaves hand/deck undefined.
    // Fix: detect active run and initialize a fresh draw deck + hand from
    // the player's restored selectedDeck. Also reset transient combat state
    // (cooldowns, magic stones, HP, death flag) to sensible defaults.
    if (gameState.gamePhase === 'playing') {
      if (!player.hand || player.hand.length === 0) {
        createDrawDeckFromSelectedDeck(player);
        initPlayerHand(player);
      }
      player.slotCooldowns = [null, null, null, null];
      player.magicStones = MAX_MAGIC_STONES;
      if (!player.pendingSummons) {
        player.pendingSummons = new Set();
      }
      // Reset combat state that can't be restored from persistence
      if (player.hp == null || player.hp <= 0) {
        player.hp = MAX_HP;
        player.dead = false;
      }
    }

  socket.emit('init', {
    id: playerId,
    playerId,
    accountId,
    username: player.username,
    state: gameState,
    layoutSeed: gameState.layoutSeed,
    layout: gameState.layout,
    selectedDeck: player.selectedDeck,
    inventory: player.inventory,
    ownedCards: player.ownedCards,
    ...buildQuestUpdatePayload(gameState)
  });

  // Broadcast updated lobby on connect
  broadcastLobbyUpdate();

  socket.on('move', (data) => {
    if (gameState.gamePhase !== 'playing') return;

    const player = gameState.players[socket.playerId];

    if (player && player.dead) return;

    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        !Number.isFinite(data.dx) || !Number.isFinite(data.dz) || !Number.isFinite(data.rotation)) {
      console.warn(`Rejected move from ${socket.id}: invalid payload`);
      return;
    }

    // Normalize input vector to unit length (defensive against oversized dx/dz)
    const mag = Math.hypot(data.dx, data.dz);
    if (mag > 1) { data.dx /= mag; data.dz /= mag; }

    if (player) {
      const now = Date.now();
      let elapsed = (now - (player.lastMoveTime || now)) / 1000;

      // Cap elapsed to prevent teleport via large time delta
      const maxElapsed = MAX_ELAPSED_MS / 1000;
      const cappedElapsed = Math.min(elapsed, maxElapsed);

      // Integrate position from input intent
      let moveX = data.dx * MOVE_SPEED * cappedElapsed;
      let moveZ = data.dz * MOVE_SPEED * cappedElapsed;

      let newX = player.x + moveX;
      let newZ = player.z + moveZ;

      // Bounds clamping
      const clamped = clampToDungeon(newX, newZ);
      newX = clamped.x;
      newZ = clamped.z;

      const wallColliders = getWallColliders();
      const resolved = resolveWallCollision(newX, newZ, wallColliders, player.x, player.z);
      newX = resolved.x;
      newZ = resolved.z;

      // Swept collision check: reject moves that pass through a wall instead
      // of stopping at the resolved edge of it.
      if (checkSweptCollision(player.x, player.z, newX, newZ, wallColliders, { allowEndpointTouch: true })) {
        const lastLogged = sweptCollisionLogTimes.get(socket.id) || 0;
        if (Date.now() - lastLogged >= SWEPT_COLLISION_LOG_THROTTLE_MS) {
          console.debug(`Rejected move from ${socket.id}: swept collision from (${player.x.toFixed(2)}, ${player.z.toFixed(2)}) to (${newX.toFixed(2)}, ${newZ.toFixed(2)})`);
          sweptCollisionLogTimes.set(socket.id, Date.now());
        }
        return;
      }

      player.x = newX;
      player.y = 0.5;
      player.z = newZ;
      player.rotation = data.rotation;
      player.lastMoveTime = now;
      player.lastActivity = now;

      savePlayerData(socket.playerId);
    }
  });

  socket.on('useCard', (data) => {
    if (gameState.gamePhase !== 'playing') return;
    if (!gameState.run || gameState.run.status !== 'playing') return;

    if (!data || typeof data.slotIndex !== 'number' || !data.cardId) return;

    // (1) Look up card definition
    const cardDef = CARD_DEFS[data.cardId];
    if (!cardDef) {
      socket.emit('cardError', { reason: 'Unknown card' });
      return;
    }

    // (2) Get player
    const player = gameState.players[socket.playerId];
    if (!player || player.dead) return;

    // (3) Authoritative hand validation: slot must hold the requested card
    const handValidation = validateUseCardHand(player, data.slotIndex, data.cardId);
    if (!handValidation.valid) {
      socket.emit('cardError', { reason: handValidation.reason });
      return;
    }

    // (4) Cooldown check: reject if slot is still cooling down
    const now = Date.now();
    if (player.slotCooldowns && player.slotCooldowns[data.slotIndex] && now < player.slotCooldowns[data.slotIndex]) {
      socket.emit('cardError', { reason: 'Slot on cooldown' });
      return;
    }

    const handCard = handValidation.handCard;
    const originX = player.x;
    const originZ = player.z;

    // ── Weapon branch (forward cone attack) ──
    if (cardDef.type === 'weapon') {
      handCard.remainingCharges -= 1;

      const rotation = player.rotation;
      const attackRange = cardDef.attackRange || ATTACK_RANGE;
      const attackConeAngle = cardDef.attackConeAngle || ATTACK_CONE_ANGLE;
      const grind = handCard.grind || 0;
      const damage = scaledGrindStat(cardDef.damage || 0, grind);
      const dirX = Math.cos(rotation);
      const dirZ = Math.sin(rotation);
      const cooldownMs = cardDef.cooldownMs || COOLDOWN_MS;

      let hits = [];
      let magicStonesGained = 0;

      if (cardDef.effect === 'returning_projectile') {
        const result = collectReturningProjectileHits(originX, originZ, dirX, dirZ, attackRange, damage, {
          magicStoneOnHit: cardDef.magicStoneOnHit,
          magicStoneOnKill: cardDef.magicStoneOnKill,
        });
        hits = result.hits;
        magicStonesGained = result.magicStonesGained;
      } else {
        const result = collectConeHits(originX, originZ, dirX, dirZ, attackRange, attackConeAngle, damage, {
          magicStoneOnHit: cardDef.magicStoneOnHit,
          magicStoneOnKill: cardDef.magicStoneOnKill,
        });
        hits = result.hits;
        magicStonesGained = result.magicStonesGained;
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
            cardDef.shockwaveDamage || damage
          );
          shockwaveHits = shockwave.hits;
        }
      }

      const appliedMagicStones = addMagicStones(player, magicStonesGained);
      cleanupAfterDamage();

      player.slotCooldowns[data.slotIndex] = now + cooldownMs;

      if (handCard.remainingCharges <= 0) {
        drawReplacementCard(player, data.slotIndex);
      }

      io.emit('stateUpdate', stateSnapshot());
      io.emit('cardUsed', {
        playerId: socket.playerId,
        cardId: data.cardId,
        specialEffect: cardDef.specialEffect,
        origin: { x: originX, z: originZ },
        direction: { x: dirX, z: dirZ },
        hits,
        shockwaveHits,
        magicStonesGained: appliedMagicStones,
        comboCount: player.weaponComboCounts ? player.weaponComboCounts[data.cardId] : undefined,
      });

      return;
    }

    // ── Summon branch (radial AoE) ──
    if (cardDef.type === 'summon') {
      const summonKey = `${data.slotIndex}:${data.cardId}`;

      // Guard: reject duplicate activation while previous summon is still resolving
      if (player.pendingSummons.has(summonKey)) {
        socket.emit('cardError', { reason: 'Summon already resolving' });
        return;
      }

      const magicStoneCost = cardDef.magicStoneCost || 0;

      // Validate Magic Stones
      if (player.magicStones < magicStoneCost) {
        socket.emit('cardError', { reason: 'Not enough Magic Stones' });
        return;
      }

      if (cardDef.effect === 'sacrificial_altar') {
        const sacrificeRadius = cardDef.sacrificeRadius || SUMMON_RADIUS;
        const target = findSacrificeTarget(socket.playerId, originX, originZ, sacrificeRadius);
        if (!target) {
          socket.emit('cardError', { reason: 'No friendly summon to sacrifice' });
          return;
        }

        player.pendingSummons.add(summonKey);
        player.magicStones -= magicStoneCost;
        gameState.minions.splice(target.index, 1);
        const magicStonesGained = addMagicStones(player, cardDef.magicStoneGain || 0);
        const restoredCharges = restoreHandCharges(player, cardDef.chargeRestore || 0, {
          types: ['weapon'],
          maxTargets: 1,
          selection: 'random',
        });

        player.slotCooldowns[data.slotIndex] = now + COOLDOWN_MS;
        drawReplacementCard(player, data.slotIndex);

        io.emit('stateUpdate', stateSnapshot());
        io.emit('cardUsed', {
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

        player.slotCooldowns[data.slotIndex] = now + (cardDef.cooldownMs || COOLDOWN_MS);
        drawReplacementCard(player, data.slotIndex);

        io.emit('stateUpdate', stateSnapshot());
        io.emit('cardUsed', {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          origin: { x: originX, z: originZ },
          restoredCharges,
        });

        return;
      }

      if (cardDef.effect === 'frost_nova') {
        const radius = cardDef.radius || SUMMON_RADIUS;
        const hits = applyFreezeInRadius(
          originX,
          originZ,
          radius,
          cardDef.freezeDurationMs || 2500,
          cardDef.damage || 0
        );
        cleanupAfterDamage();

        player.slotCooldowns[data.slotIndex] = now + (cardDef.cooldownMs || COOLDOWN_MS);
        drawReplacementCard(player, data.slotIndex);

        io.emit('stateUpdate', stateSnapshot());
        io.emit('cardUsed', {
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
        const healed = healPlayer(socket.playerId, cardDef.healAmount || 0);

        player.slotCooldowns[data.slotIndex] = now + (cardDef.cooldownMs || COOLDOWN_MS);
        drawReplacementCard(player, data.slotIndex);

        io.emit('stateUpdate', stateSnapshot());
        io.emit('cardUsed', {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          specialEffect: cardDef.specialEffect,
          origin: { x: originX, z: originZ },
          radius: SUMMON_RADIUS,
          healAmount: healed,
        });

        return;
      }

      if (cardDef.effect === 'gravity_well') {
        const radius = cardDef.pullRadius || SUMMON_RADIUS;
        const pulled = pullEnemiesToward(originX, originZ, radius, cardDef.pullStrength || 4);

        player.slotCooldowns[data.slotIndex] = now + (cardDef.cooldownMs || COOLDOWN_MS);
        drawReplacementCard(player, data.slotIndex);

        io.emit('stateUpdate', stateSnapshot());
        io.emit('cardUsed', {
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

      if (cardDef.effect === 'dragons_breath') {
        const rotation = player.rotation;
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
          cardDef.damage || 0
        );
        spawnDragonsBreathEffect(originX, originZ, dirX, dirZ, cardDef, socket.playerId);
        cleanupAfterDamage();

        player.slotCooldowns[data.slotIndex] = now + (cardDef.cooldownMs || COOLDOWN_MS);
        drawReplacementCard(player, data.slotIndex);

        io.emit('stateUpdate', stateSnapshot());
        io.emit('cardUsed', {
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
          createdAt: now,
          lastPulseAt: now,
          pulseIntervalMs: cardDef.pulseIntervalMs || 2000,
          magicStonePulse: cardDef.magicStonePulse || 10,
        };
        gameState.minions.push(prism);

        player.slotCooldowns[data.slotIndex] = now + COOLDOWN_MS;
        drawReplacementCard(player, data.slotIndex);

        io.emit('stateUpdate', stateSnapshot());
        io.emit('cardUsed', {
          playerId: socket.playerId,
          cardId: data.cardId,
          slotIndex: data.slotIndex,
          origin: { x: originX, z: originZ },
          radius: 1,
        });

        return;
      }

      // Radial AoE: apply damage to every enemy within SUMMON_RADIUS
      const grind = handCard.grind || 0;
      const summonDamage = scaledGrindStat(cardDef.damage || 0, grind);
      const radial = collectRadialHits(originX, originZ, SUMMON_RADIUS, summonDamage, {
        magicStoneOnHit: cardDef.magicStoneOnHit,
        magicStoneOnKill: cardDef.magicStoneOnKill,
      });
      const hits = radial.hits;
      const appliedMagicStones = addMagicStones(player, radial.magicStonesGained);

      cleanupAfterDamage();

      player.slotCooldowns[data.slotIndex] = now + (cardDef.cooldownMs || COOLDOWN_MS);

      // Remove card from hand and draw replacement
      drawReplacementCard(player, data.slotIndex);

      // Broadcast updated hand to all clients
      io.emit('stateUpdate', stateSnapshot());

      // Broadcast result to all clients
      io.emit('cardUsed', {
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

    // ── Monster branch (spawn persistent minion) ──
    if (cardDef.type === 'monster') {
      const magicStoneCost = cardDef.magicStoneCost || 0;
      if (player.magicStones < magicStoneCost) {
        socket.emit('cardError', { reason: 'Not enough Magic Stones' });
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
        createdAt: now
      };
      if (cardDef.taunt) {
        minion.taunt = true;
      }
      if (cardDef.effect === 'storm_eagle') {
        minion.attackRange = cardDef.attackRange || 7;
        minion.attackDamage = cardDef.attackDamage || 12;
      }
      if (cardDef.effect === 'battery_automaton') {
        minion.lastChargePulseAt = now;
        minion.chargePulseIntervalMs = cardDef.chargePulseIntervalMs || 6000;
        minion.chargeRestore = cardDef.chargeRestore || 1;
      }
      gameState.minions.push(minion);

      // Set slot cooldown
      player.slotCooldowns[data.slotIndex] = now + COOLDOWN_MS;

      // Remove card from hand and draw replacement
      drawReplacementCard(player, data.slotIndex);

      // Broadcast updated hand to all clients
      io.emit('stateUpdate', stateSnapshot());

      io.emit('cardUsed', {
        playerId: socket.playerId,
        cardId: data.cardId,
        slotIndex: data.slotIndex,
        specialEffect: cardDef.specialEffect,
        origin: { x: originX, z: originZ },
        minionId: minion.id
      });

      return;
    }
  });

  socket.on('selectQuest', (data) => {
    if (gameState.gamePhase !== 'lobby') return;

    const questId = data && typeof data.questId === 'string' ? data.questId : null;
    if (!questId) {
      socket.emit('questError', { reason: 'Missing questId' });
      return;
    }

    if (!isValidQuestId(questId)) {
      socket.emit('questError', { reason: `Unknown quest: ${questId}` });
      return;
    }

    gameState.selectedQuestId = questId;
    const payload = buildQuestUpdatePayload(gameState);
    io.emit('questUpdate', payload);
    broadcastLobbyUpdate();
  });

  socket.on('playerReady', (ready) => {
    const player = gameState.players[socket.playerId];
    if (!player) return;

    if (ready) {
      // Validate deck before accepting ready
      normalizePlayerInventory(player);
      const result = validateDeck(player.selectedDeck, player.inventory);
      if (!result.valid) {
        player.ready = false;
        socket.emit('deckError', { reason: result.reason });
        broadcastLobbyUpdate();
        return;
      }
    }

    player.ready = !!ready;
    broadcastLobbyUpdate();
    if (gameState.gamePhase === 'lobby') {
      checkAllReady();
    }
  });

  socket.on('returnToLobby', () => {
    // Guard: reject if the current run is still active
    if (gameState.run && gameState.run.status === 'playing') {
      socket.emit('runError', { reason: 'Run still in progress' });
      return;
    }

    // No-op when there's no run (lobby phase); proceed normally when terminal
    if (!gameState.run) return;

    returnPlayersToLobby();
  });

  socket.on('claimCardReward', (data) => {
    const player = gameState.players[socket.playerId];
    if (!player) return;
    if (!gameState.run || gameState.run.status === 'playing') return;
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

  socket.on('deckAddCard', (data) => {
    // Guard: only allowed in lobby phase
    if (gameState.gamePhase !== 'lobby') return;

    const player = gameState.players[socket.playerId];
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

  socket.on('deckRemoveCard', (data) => {
    // Guard: only allowed in lobby phase
    if (gameState.gamePhase !== 'lobby') return;

    const player = gameState.players[socket.playerId];
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

  socket.on('evolveCard', (data) => {
    if (gameState.gamePhase !== 'lobby') return;

    const player = gameState.players[socket.playerId];
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

  socket.on('sellCard', (data) => {
    if (gameState.gamePhase !== 'lobby') return;

    const player = gameState.players[socket.playerId];
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

  socket.on('upgradeCard', (data) => {
    if (gameState.gamePhase !== 'lobby') return;

    const player = gameState.players[socket.playerId];
    if (!player) return;

    const instanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
    const result = upgradeCard(player, instanceId);
    if (!result.ok) {
      socket.emit('cardUpgradeError', { reason: result.reason });
      return;
    }

    socket.emit('cardUpgradeResult', {
      ...result,
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards
    });
    savePlayerData(socket.playerId);
  });

  socket.on('grindCard', (data) => {
    if (gameState.gamePhase !== 'lobby') return;

    const player = gameState.players[socket.playerId];
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

  socket.on('offerCardTrade', (data) => {
    if (gameState.gamePhase !== 'lobby') return;

    const player = gameState.players[socket.playerId];
    if (!player || !data) return;

    const targetPlayerId = typeof data.targetPlayerId === 'string' ? data.targetPlayerId : null;
    const offeredCardId = typeof data.offeredCardId === 'string' ? data.offeredCardId : null;
    const requestedCardId = typeof data.requestedCardId === 'string' ? data.requestedCardId : null;
    if (!targetPlayerId || !offeredCardId || !requestedCardId) {
      socket.emit('deckError', { reason: 'Invalid trade offer' });
      return;
    }

    const result = offerCardTrade(
      gameState.pendingTrades,
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

  socket.on('respondCardTrade', (data) => {
    if (gameState.gamePhase !== 'lobby') return;

    const player = gameState.players[socket.playerId];
    if (!player || !data) return;

    const tradeId = typeof data.tradeId === 'string' ? data.tradeId : null;
    const accepted = !!data.accepted;
    if (!tradeId) {
      socket.emit('deckError', { reason: 'Missing tradeId' });
      return;
    }

    const trade = gameState.pendingTrades[tradeId];
    const offererId = trade ? trade.fromPlayerId : null;
    const result = respondCardTrade(gameState.pendingTrades, socket.playerId, tradeId, accepted);
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

    const offerer = gameState.players[result.offererId];
    const responder = gameState.players[result.responderId];
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
    if (gameState.players[socket.playerId]) {
      gameState.players[socket.playerId].lastActivity = Date.now();
    }
    socket.emit('heartbeat_ack', { latency: Date.now() - data.timestamp });
  });

  socket.on('lootPickup', (data) => {
    if (!data || !data.lootId) return;

    const player = gameState.players[socket.playerId];
    if (!player) return;
    if (player.dead) return; // dead players cannot collect loot

    const lootIdx = gameState.loot.findIndex(l => l.id === data.lootId);
    if (lootIdx === -1) return; // already removed — ignore duplicate

    const loot = gameState.loot[lootIdx];
    const dist = Math.hypot(player.x - loot.x, player.z - loot.z);

    if (dist > 3) return; // anti-cheat: too far

    player.currency += loot.value;
    player.currencyEarnedThisRun += loot.value;
    gameState.loot.splice(lootIdx, 1);

    console.log(`[loot] picked up id=${loot.id} value=${loot.value} by ${socket.id} (currency=${player.currency})`);

    savePlayerData(socket.playerId);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    sweptCollisionLogTimes.delete(socket.id);
    // Persist player data before removing from game state
    if (socket.playerId) {
      savePlayerData(socket.playerId);
      cancelTradesForPlayer(gameState.pendingTrades, socket.playerId);
    }
    delete gameState.players[socket.playerId];
    gameState.minions = gameState.minions.filter(m => m.ownerId !== socket.playerId);
    io.emit('playerDisconnected', socket.playerId);

    if (Object.keys(gameState.players).length === 0) {
      // Last player left — reset the session regardless of run state
      returnPlayersToLobby();
    } else if (gameState.gamePhase === 'playing') {
      checkRunTerminalState();
    } else if (gameState.gamePhase === 'lobby') {
      // Non-last player disconnects during lobby — broadcast updated player list
      broadcastLobbyUpdate();
    }
  });
});

// Server Game Loop
const gameLoopId = setInterval(() => {
  updateEnemies();
  updateMinions();

  // Regenerate Magic Stones and clear pending summons for each player
  regenMagicStones();

  // Remove expired loot (older than 120 seconds)
  const now = Date.now();
  gameState.loot = gameState.loot.filter(l => (now - l.createdAt) < LOOT_LIFETIME_MS);

  io.emit('stateUpdate', stateSnapshot());
}, 1000 / TICK_RATE);
_intervals.push(gameLoopId);

// Periodic stale player cleanup (every 5 seconds)
const staleCleanupId = setInterval(cleanupStalePlayers, STALE_CLEANUP_INTERVAL_MS);
_intervals.push(staleCleanupId);

// Periodic auto-save (every 30 seconds)
const periodicSaveId = setInterval(saveAllPlayers, PERIODIC_SAVE_INTERVAL_MS);
_intervals.push(periodicSaveId);

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
    healPlayer,
    collectConeHits,
    collectRadialHits,
    collectReturningProjectileHits,
    applyFreezeInRadius,
    pullEnemiesToward,
    spawnDragonsBreathEffect,
    isEnemyFrozen,
    updateEnemies,
    updateMinions,
    spawnLoot,
    spawnEnemy,
    spawnEnemies,
    firstRoomPosition,
    createGameState,
    resetGameState,
    gameState,
    startServer,
    cleanupStalePlayers,
    regenMagicStones,
    stateSnapshot,
    createRunState,
    startDungeonRun,
    recordEnemyDefeated,
    getEnemyCardDrop,
    recordEnemyCardDrop,
    buildCardChoices,
    claimCardReward,
    removeDeadEnemies,
    cleanupAfterDamage,
    clampObjectiveProgress,
    buildRunSummary,
    checkRunTerminalState,
    resetTransientRunState,
    returnPlayersToLobby,
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
    grindCard,
    createCardInstance,
    createInventoryFromCardIds,
    createInventoryFromOwnedCards,
    normalizeInventory,
    inventoryToOwnedCards,
    normalizePlayerInventory,
    getInventoryInstance,
    evolveCard,
    getCardSellValue,
    canSellCardInstance,
    sellCard,
    cancelTradesForPlayer,
    offerCardTrade,
    respondCardTrade,
    upgradeCard,
    getUpgradeCost,
    getLevelStatMultiplier,
    MAX_CARD_LEVEL,
    UPGRADE_COST_BASE,
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
    MAX_MAGIC_STONES,
    MAGIC_STONES_REGEN_PER_TICK,
    DETECTION_RADIUS,
    ATTACK_RANGE,
    SUMMON_RADIUS,
    COOLDOWN_MS,
    TICK_RATE,
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
    buildQuestUpdatePayload
  };
}
