const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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
    lobby: [],
    gamePhase: 'lobby'
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
  wallAABB,
  checkWallCollision,
  checkSweptCollision,
  isEntityPositionBlocked,
  moveEntityToward,
  ENTITY_RADIUS,
  ENEMY_DEFS,
  MINION_FOLLOW_DISTANCE,
  MINION_FOLLOW_SPEED,
  updateEnemies,
  updateMinions,
  damagePlayer,
  cleanupStalePlayers,
  regenMagicStones,
  spawnEnemy,
  spawnEnemies,
  spawnLoot,
  randomWanderTarget,
  nearbySpawnPosition,
  removeDeadEnemies,
  cleanupAfterDamage,
  setTerminalCheckCallback,
  setCleanupAfterDamageCallback,
  setFindSocketCallback,
  setSavePlayerCallback
} = require('./simulation');

// Throttle state for swept-collision rejection logging (per-socket)
const SWEPT_COLLISION_LOG_THROTTLE_MS = 1000;
const sweptCollisionLogTimes = new Map();

// Initialize simulation module with gameState and timeouts
const sim = require('./simulation');
sim.setGameState(gameState, _timeouts);

// Wire simulation callbacks (so simulation.js can call back into index.js).
// These are function declarations in this file, so they're hoisted and
// available at module load time — tests that import cleanupStalePlayers
// or damagePlayer directly (without calling startServer) still get
// save/disconnect behavior through these callbacks.
setTerminalCheckCallback(checkRunTerminalState);
setCleanupAfterDamageCallback(checkRunTerminalState);
setFindSocketCallback(findSocketByPlayerId);
setSavePlayerCallback(savePlayerData);

// Generate dungeon layout at startup
const layoutSeed = Math.floor(Math.random() * 2147483647);
gameState.layoutSeed = layoutSeed;
gameState.layout = generateLayout(layoutSeed);
console.log(`[server] Dungeon seed: ${layoutSeed}, rooms: ${gameState.layout.rooms.length}`);

gameState.dungeonBounds = computeDungeonBounds(gameState.layout);
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

// Server-side card definitions (mirrors game/client/cards.js, weapon entries include damage)
const CARD_DEFS = {
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', type: 'weapon', damage: 15, charges: 5 },
  flame_blade: { id: 'flame_blade', name: 'Flame Blade', type: 'weapon', damage: 25, charges: 3 },
  battle_familiar: { id: 'battle_familiar', name: 'Battle Familiar', type: 'summon', charges: 1, magicStoneCost: 50, damage: 40 },
  dungeon_drake: { id: 'dungeon_drake', name: 'Dungeon Drake', type: 'monster', charges: 1 },
};

// Starting deck card ids — mirrors createStartingDeck() in client/cards.js.
// Duplicates are intentional (the deck has more than 4 cards); unique ids are
// derived at runtime for the player's ownedCards inventory.
const STARTING_DECK_IDS = [
  'iron_sword',
  'flame_blade',
  'battle_familiar',
  'dungeon_drake',
  'iron_sword',
  'iron_sword',
  'battle_familiar',
  'flame_blade'
];

/**
 * Build a fresh player progress object.
 * Returns { currency, ownedCards, runRewards, currencyEarnedThisRun }.
 * `ownedCards` is a frequency map from the starting deck (e.g. iron_sword: 3).
 */
function createPlayerProgress() {
  const ownedCards = {};
  for (const cardId of STARTING_DECK_IDS) {
    ownedCards[cardId] = (ownedCards[cardId] || 0) + 1;
  }
  return {
    currency: 0,
    ownedCards,
    runRewards: null,
    currencyEarnedThisRun: 0
  };
}

// ── Persistence Helpers ──

/**
 * Module-level storage provider. Initialized in startServer() based on
 * PERSISTENCE_BACKEND env var. Tests can override by setting this directly.
 */
let provider = null;

/**
 * Override the module-level provider (test-only).
 */
function setTestProvider(p) {
  provider = p;
}

/**
 * Extract the fields that should be persisted for a player.
 * Returns { currency, ownedCards, selectedDeck, x, y, z, rotation }.
 */
function extractPersistentData(player) {
  return {
    currency: player.currency || 0,
    ownedCards: player.ownedCards || {},
    selectedDeck: player.selectedDeck || [],
    x: player.x || 0,
    y: player.y || 0.5,
    z: player.z || 0,
    rotation: player.rotation || 0
  };
}

/**
 * Resolve the persistence key for a player.
 * Returns `player.accountId` when the player is authenticated,
 * otherwise falls back to the ephemeral `playerId`.
 */
function persistenceKey(playerId) {
  const player = gameState.players[playerId];
  if (!player) return playerId;
  return player.accountId || playerId;
}

/**
 * Persist a player's data to the configured storage backend.
 * Uses the player's `accountId` as the storage key when authenticated,
 * falling back to `playerId` for anonymous players.
 * Logs errors via console.error but never throws.
 */
function savePlayerData(playerId) {
  if (!provider) return;
  const player = gameState.players[playerId];
  if (!player) return;
  try {
    const key = persistenceKey(playerId);
    provider.savePlayer(key, extractPersistentData(player));
  } catch (err) {
    console.error(`[persistence] savePlayerData failed for ${playerId}:`, err.message);
  }
}

/**
 * Iterate over all connected players and persist each one.
 * Errors from individual saves are caught and logged so one failure
 * never interrupts the timer or skips the remaining players.
 */
function saveAllPlayers() {
  for (const playerId of Object.keys(gameState.players)) {
    try {
      savePlayerData(playerId);
    } catch (err) {
      console.error(`[persistence] saveAllPlayers failed for ${playerId}:`, err.message);
    }
  }
}

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
    gamePhase: gameState.gamePhase
  });
}

// ── Run State Helpers ──

/**
 * Build a fresh run object from the current game state.
 */
function createRunState() {
  return {
    id: crypto.randomUUID(),
    status: 'playing',
    objective: {
      type: 'defeat_enemies',
      label: 'Defeat all enemies',
      totalEnemies: gameState.enemies.length,
      defeatedEnemies: 0
    },
    startedAt: Date.now()
  };
}

/**
 * Assign a new run object to gameState.run.
 */
function startDungeonRun() {
  gameState.run = createRunState();
  // Reset per-run tracking for all players
  for (const p of Object.values(gameState.players)) {
    p.currencyEarnedThisRun = 0;
    p.runRewards = null;
  }
}

/**
 * Cap defeatedEnemies at totalEnemies so the counter never overshoots.
 */
function clampObjectiveProgress(run) {
  run.objective.defeatedEnemies = Math.min(run.objective.defeatedEnemies, run.objective.totalEnemies);
}

/**
 * Resync the active run's objective totals to the current authoritative
 * enemy list. Used after debug scenarios mutate `gameState.enemies` after
 * `startDungeonRun()` has already snapshot the initial count — without this,
 * `totalEnemies` could disagree with the real enemy list and run completion
 * would behave incorrectly. No-op when there is no active run.
 */
function syncRunObjectiveToEnemies() {
  if (!gameState.run) return;
  gameState.run.objective.totalEnemies = gameState.enemies.length;
  clampObjectiveProgress(gameState.run);
}

/**
 * Record `count` enemy kills against the current run objective.
 * Safe no-op when gameState.run is undefined (e.g. lobby phase).
 */
function recordEnemyDefeated(count = 1) {
  if (!gameState.run) return;
  gameState.run.objective.defeatedEnemies += count;
  clampObjectiveProgress(gameState.run);
}

// removeDeadEnemies and cleanupAfterDamage are in simulation.js.
// They use callbacks to call back into checkRunTerminalState() here.
// The callbacks are wired below after checkRunTerminalState is defined.

/**
 * Build a run summary object from the current game state.
 */
function buildRunSummary(status) {
  const run = gameState.run;
  if (!run) return null;

  const players = Object.entries(gameState.players).map(([id, p]) => ({
    id,
    hp: p.hp,
    dead: p.dead,
    currency: p.currency,
    rewards: buildPlayerRewardSummary(id)
  }));

  return {
    runId: run.id,
    status,
    durationMs: Date.now() - run.startedAt,
    objective: { ...run.objective },
    players,
    defeatedEnemies: run.objective.defeatedEnemies,
    currencyCollected: players.reduce((sum, p) => sum + p.currency, 0)
  };
}

// ── Reward Helpers ──

/**
 * Monotonic counter keyed by player id so that successive victories rotate
 * through different card rewards.  Lives on gameState so it survives across
 * runs but is reset when the server restarts.
 */
// (initialized lazily inside grantRunRewards)

/**
 * Increment `player.ownedCards[cardId]` by 1.
 * Returns `true` on success, `false` when `cardId` is unknown.
 */
function grantCard(player, cardId) {
  if (!CARD_DEFS[cardId]) return false;
  if (!player.ownedCards) player.ownedCards = {};
  if (player.ownedCards[cardId] === undefined) {
    player.ownedCards[cardId] = 0;
  }
  player.ownedCards[cardId] += 1;
  return true;
}

/**
 * Grant run-end rewards to a player based on the run summary status.
 *
 * Victory  →  +10 currency bonus, one card reward (rotation), summary saved.
 *            `player.runRewards` includes bonus + loot-pickup currency + card.
 * Failure  →  no bonus currency, no card reward; summary shows only loot currency.
 */
function grantRunRewards(playerId, summary) {
  const player = gameState.players[playerId];
  if (!player) return;

  const lootCurrency = player.currencyEarnedThisRun || 0;

  if (summary.status === 'victory') {
    const currencyBonus = 10;
    player.currency += currencyBonus;

    // Pick a card from the rotation
    if (!gameState._victoryCounters) gameState._victoryCounters = {};
    const idx = gameState._victoryCounters[playerId] || 0;
    const cardId = VICTORY_REWARD_ROTATION[idx % VICTORY_REWARD_ROTATION.length];
    gameState._victoryCounters[playerId] = idx + 1;

    const cards = [];
    if (grantCard(player, cardId)) {
      const cardDef = CARD_DEFS[cardId];
      cards.push({ id: cardId, name: cardDef.name, count: 1 });
    }

    player.runRewards = {
      currency: currencyBonus + lootCurrency,
      cards
    };
  } else {
    // Failure: no bonus, no card — but still show any loot currency earned
    player.runRewards = {
      currency: lootCurrency,
      cards: []
    };
  }
}

/**
 * Build a structured reward summary for a player.
 * Returns the run-only rewards object saved by grantRunRewards(),
 * or an empty default `{ currency: 0, cards: [] }` if none exist.
 *
 * This is intentionally NOT the player's total balance or full inventory —
 * it reports only what was earned during the current run (bonus + loot + card).
 */
function buildPlayerRewardSummary(playerId) {
  const player = gameState.players[playerId];
  if (!player || !player.runRewards) return { currency: 0, cards: [] };

  return player.runRewards;
}

/**
 * Validate a deck against card definitions, size bounds, and owned inventory.
 *
 * Returns `{ valid: true }` when the deck is valid,
 * or `{ valid: false, reason: '<explanation>' }` when invalid.
 */
function validateDeck(deck, ownedCards) {
  // Check deck length bounds
  if (deck.length < DECK_MIN_SIZE) {
    return { valid: false, reason: `Deck must have at least ${DECK_MIN_SIZE} cards` };
  }
  if (deck.length > DECK_MAX_SIZE) {
    return { valid: false, reason: `Deck can have at most ${DECK_MAX_SIZE} cards` };
  }

  // Check each card id and count ownership
  const counts = {};
  for (const cardId of deck) {
    if (!CARD_DEFS[cardId]) {
      return { valid: false, reason: `Unknown card id: ${cardId}` };
    }
    counts[cardId] = (counts[cardId] || 0) + 1;
  }

  for (const [cardId, count] of Object.entries(counts)) {
    const owned = ownedCards[cardId] || 0;
    if (count > owned) {
      return { valid: false, reason: `Not enough copies of ${cardId} (have ${owned}, need ${count})` };
    }
  }

  return { valid: true };
}

/**
 * Check whether adding one copy of `cardId` to `deck` would keep the deck valid.
 */
function canAddCardToDeck(cardId, deck, ownedCards) {
  if (!CARD_DEFS[cardId]) return false;
  if (deck.length >= DECK_MAX_SIZE) return false;

  const currentCount = deck.filter(id => id === cardId).length;
  const owned = ownedCards[cardId] || 0;
  if (currentCount >= owned) return false;

  return true;
}

/**
 * Shuffle an array in place using Fisher-Yates and return it.
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Create a shuffled draw deck from the player's selected deck.
 * Copies `player.selectedDeck` into a new array, shuffles it, and assigns
 * the result to `player.deck`.  Returns the deck array.
 */
function createDrawDeckFromSelectedDeck(player) {
  const deck = player.selectedDeck.slice();
  shuffleArray(deck);
  player.deck = deck;
  return deck;
}

/**
 * Draw one card from `player.deck` and return a card object.
 * Returns null when the deck is empty.
 * Card object shape: { id, name, type, charges, remainingCharges, magicStoneCost? }
 */
function drawCardFromDeck(player) {
  if (!player.deck || player.deck.length === 0) return null;
  const cardId = player.deck.pop();
  const def = CARD_DEFS[cardId];
  if (!def) return null;
  const card = {
    id: def.id,
    name: def.name,
    type: def.type,
    charges: def.charges,
    remainingCharges: def.charges,
  };
  if (def.magicStoneCost != null) {
    card.magicStoneCost = def.magicStoneCost;
  }
  return card;
}

/**
 * Deal up to 4 cards from `player.deck` into `player.hand`.
 * Hand is an array of card objects (or undefined for empty slots).
 */
function initPlayerHand(player) {
  player.hand = [];
  for (let i = 0; i < 4; i++) {
    const card = drawCardFromDeck(player);
    if (card) {
      player.hand.push(card);
    }
  }
  return player.hand;
}

/**
 * Draw a replacement card into the slot at `slotIndex` in `player.hand`.
 * Does nothing when the deck is empty.
 */
function drawReplacementCard(player, slotIndex) {
  const card = drawCardFromDeck(player);
  if (card) {
    player.hand[slotIndex] = card;
  } else {
    // Deck exhausted — remove the slot entry so client sees an empty slot
    player.hand.splice(slotIndex, 1);
  }
}

/**
 * Check whether the current run has reached a terminal state.
 * Emits exactly one terminal event per run (guarded by run.status === 'playing').
 *
 * Flow: determine status → set run.status → grantRunRewards() per player → build summary → emit.
 */
function checkRunTerminalState() {
  if (!gameState.run || gameState.run.status !== 'playing') return;

  let status = null;

  // Victory condition: all enemies defeated
  if (gameState.run.objective.defeatedEnemies >= gameState.run.objective.totalEnemies) {
    status = 'victory';
  }

  // Failure condition: every connected active player is dead
  if (!status) {
    const activePlayers = Object.values(gameState.players);
    if (activePlayers.length > 0 && activePlayers.every(p => p.hp <= 0)) {
      status = 'failed';
    }
  }

  if (!status) return;

  // Set status, grant rewards per player, build summary, emit
  gameState.run.status = status;

  for (const playerId of Object.keys(gameState.players)) {
    grantRunRewards(playerId, { status });
  }

  // Persist player data after rewards are granted
  for (const playerId of Object.keys(gameState.players)) {
    savePlayerData(playerId);
  }

  const summary = buildRunSummary(status);
  io.emit(status === 'victory' ? 'runComplete' : 'runFailed', summary);
}

/**
 * Clear all transient run entities (enemies, minions, loot).
 * Does NOT regenerate the dungeon layout — layout is session-level.
 */
function resetTransientRunState() {
  gameState.enemies = [];
  gameState.minions = [];
  gameState.loot = [];
}

/**
 * Full lobby reset: clear transient state, restore players to lobby,
 * and broadcast the updated state to all connected clients.
 */
function returnPlayersToLobby() {
  // 0. Persist player data before resetting transient state
  for (const playerId of Object.keys(gameState.players)) {
    savePlayerData(playerId);
  }

  // 1. Clear transient run entities
  resetTransientRunState();

  // 2. Reset game phase and delete run object
  gameState.gamePhase = 'lobby';
  delete gameState.run;

  // 3. Reset every player: position, HP, readiness — preserve currency, inventory, ownedCards, runRewards
  const spawn = firstRoomPosition();
  for (const playerId of Object.keys(gameState.players)) {
    const player = gameState.players[playerId];
    const preservedCurrency = player.currency;
    const preservedInventory = player.inventory;
    const preservedOwnedCards = player.ownedCards;
    const preservedRunRewards = player.runRewards;

    player.ready = false;
    player.dead = false;
    player.hp = MAX_HP;
    player.x = spawn.x;
    player.y = 0.5;
    player.z = spawn.z;
    player.currency = preservedCurrency;
    player.inventory = preservedInventory;
    player.ownedCards = preservedOwnedCards;
    player.runRewards = preservedRunRewards;
    player.currencyEarnedThisRun = 0;
    player.lastMoveTime = Date.now();
    player.pendingSummons.clear();
    player.slotCooldowns = [null, null, null, null];
  }

  // 4. Broadcast state to all clients
  io.emit('stateUpdate', stateSnapshot());

  // 5. Update lobby UI
  broadcastLobbyUpdate();
}

// Helper: check if all players are ready and transition if so
function checkAllReady() {
  const all = Object.values(gameState.players);
  if (all.length > 0 && all.every(p => p.ready)) {
    gameState.gamePhase = 'playing';
    // Reset every player to spawn position so no lobby position carries into the dungeon
    const spawn = firstRoomPosition();
    for (const player of all) {
      player.x = spawn.x;
      player.y = 0.5;
      player.z = spawn.z;
      player.lastMoveTime = Date.now();
      // Create shuffled draw decks and initialize hands from each player's selected deck
      createDrawDeckFromSelectedDeck(player);
      initPlayerHand(player);
      player.slotCooldowns = [null, null, null, null];
    }
    spawnEnemies();
    startDungeonRun();
    io.emit('startGame');
  }
}

// damagePlayer, randomWanderTarget, spawnEnemy, spawnEnemies, spawnLoot,
// nearbySpawnPosition, updateEnemies, updateMinions, cleanupStalePlayers,
// regenMagicStones are all in simulation.js — imported above via destructured require.
// Callbacks (setTerminalCheckCallback etc.) are wired in startServer().

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
  const result = validateDeck(player.selectedDeck, player.ownedCards);
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

/**
 * Build a clean public snapshot of gameState for stateUpdate broadcasts.
 * Includes only client-relevant fields; excludes internal-only data
 * (layout, _victoryCounters, dungeonBounds) and non-serializable per-player
 * fields (pendingSummons, lastActivity).
 */
function stateSnapshot() {
  const players = {};
  for (const [id, p] of Object.entries(gameState.players)) {
    players[id] = {
      x: p.x,
      y: p.y,
      z: p.z,
      rotation: p.rotation,
      deck: p.deck,
      hand: p.hand,
      hp: p.hp,
      dead: p.dead,
      ready: p.ready,
      magicStones: p.magicStones,
      currency: p.currency,
      ownedCards: p.ownedCards,
      runRewards: p.runRewards,
      currencyEarnedThisRun: p.currencyEarnedThisRun,
      selectedDeck: p.selectedDeck,
      inventory: p.inventory,
      debugScenario: p.debugScenario
    };
  }

  const snapshot = {
    players,
    enemies: gameState.enemies,
    minions: gameState.minions,
    loot: gameState.loot,
    lobby: gameState.lobby,
    gamePhase: gameState.gamePhase,
    run: gameState.run,
    dungeonBounds: gameState.dungeonBounds,
    layoutSeed: gameState.layoutSeed,
    currency: gameState.currency
  };

  return snapshot;
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
    provider = new InMemoryProvider();
    console.log('[persistence] InMemoryProvider initialized (ephemeral — set PERSISTENCE_BACKEND=file for durable storage)');
  } else {
    provider = new FileProvider(dataPath);
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
      savedData = provider ? provider.loadPlayer(loadKey) : null;
    } catch (err) {
      console.error(`[persistence] loadPlayer failed for ${loadKey}:`, err.message);
      savedData = null;
    }

    // Initialize player state on connection.
    if (!gameState.players[playerId]) {
      const progress = createPlayerProgress();

      // Default selected deck: the full 8-card starting deck (STARTING_DECK_IDS),
      // so players have a draw-deck reserve beyond the 4-card opening hand.
      const defaultDeck = [...STARTING_DECK_IDS];

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
      player.ownedCards = savedData.ownedCards ?? player.ownedCards;
      player.selectedDeck = savedData.selectedDeck && savedData.selectedDeck.length > 0
        ? savedData.selectedDeck
        : player.selectedDeck;
      // Restore persisted location regardless of game phase (lobby or mid-run)
      player.x = savedData.x ?? player.x;
      player.y = savedData.y ?? player.y;
      player.z = savedData.z ?? player.z;
      player.rotation = savedData.rotation ?? player.rotation;
    }

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

  socket.emit('init', { id: playerId, playerId, accountId, username: player.username, state: gameState, layoutSeed: gameState.layoutSeed, layout: gameState.layout, selectedDeck: player.selectedDeck, ownedCards: player.ownedCards });

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

      // Swept collision check: reject moves whose path intersects any wall
      if (checkSweptCollision(player.x, player.z, newX, newZ)) {
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

    // (1) Validate slot index
    if (data.slotIndex < 0 || data.slotIndex > 3) return;

    // (2) Look up card definition
    const cardDef = CARD_DEFS[data.cardId];
    if (!cardDef) return;

    // (3) Get player
    const player = gameState.players[socket.playerId];
    if (!player || player.dead) return;

    // (4) Hand validation: slot must exist and card id must match
    if (!player.hand || !player.hand[data.slotIndex] || player.hand[data.slotIndex].id !== data.cardId) {
      return; // silently reject
    }

    // (5) Cooldown check: reject if slot is still cooling down
    const now = Date.now();
    if (player.slotCooldowns && player.slotCooldowns[data.slotIndex] && now < player.slotCooldowns[data.slotIndex]) {
      socket.emit('cardError', { reason: 'Slot on cooldown' });
      return;
    }

    const handCard = player.hand[data.slotIndex];
    const originX = player.x;
    const originZ = player.z;

    // ── Weapon branch (forward cone attack) ──
    if (cardDef.type === 'weapon') {
      // Decrement remaining charges
      handCard.remainingCharges -= 1;

      const rotation = player.rotation; // radians, 0 = +X axis

      // Forward direction vector from player rotation (on x-z plane)
      const dirX = Math.cos(rotation);
      const dirZ = Math.sin(rotation);

      // Check each enemy for hit (forward cone + range)
      const hits = [];
      for (const enemy of gameState.enemies) {
        const dx = enemy.x - originX;
        const dz = enemy.z - originZ;
        const dist = Math.hypot(dx, dz);

        // Range check
        if (dist > ATTACK_RANGE) continue;

        // Cone check: dot product between forward dir and enemy direction
        const enemyDirX = dx / dist;
        const enemyDirZ = dz / dist;
        const dot = dirX * enemyDirX + dirZ * enemyDirZ;

        if (dot < Math.cos(ATTACK_CONE_ANGLE / 2)) continue;

        // Hit — apply damage
        enemy.hp -= cardDef.damage;
        hits.push({ enemyId: enemy.id, hp: enemy.hp });
      }

      // Cleanup dead enemies after weapon attack
      cleanupAfterDamage();

      // Set slot cooldown
      player.slotCooldowns[data.slotIndex] = now + COOLDOWN_MS;

      // Exhaust: if charges reach 0, remove card and draw replacement
      if (handCard.remainingCharges <= 0) {
        drawReplacementCard(player, data.slotIndex);
      }

      // Broadcast updated hand to all clients
      io.emit('stateUpdate', stateSnapshot());

      // Broadcast result to all clients
      io.emit('cardUsed', {
        playerId: socket.playerId,
        cardId: data.cardId,
        origin: { x: originX, z: originZ },
        direction: { x: dirX, z: dirZ },
        hits: hits
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

      // Validate Magic Stones
      if (player.magicStones < cardDef.magicStoneCost) {
        socket.emit('cardError', { reason: 'Not enough Magic Stones' });
        return;
      }

      // Mark as pending before any side effects
      player.pendingSummons.add(summonKey);

      // Deduct cost
      player.magicStones -= cardDef.magicStoneCost;

      // Radial AoE: apply damage to every enemy within SUMMON_RADIUS
      const hits = [];
      for (const enemy of gameState.enemies) {
        const dist = Math.hypot(enemy.x - originX, enemy.z - originZ);
        if (dist <= SUMMON_RADIUS) {
          enemy.hp -= cardDef.damage;
          hits.push({ enemyId: enemy.id, hp: enemy.hp });
        }
      }

      // Cleanup dead enemies after summon attack
      cleanupAfterDamage();

      // Set slot cooldown
      player.slotCooldowns[data.slotIndex] = now + COOLDOWN_MS;

      // Remove card from hand and draw replacement
      drawReplacementCard(player, data.slotIndex);

      // Broadcast updated hand to all clients
      io.emit('stateUpdate', stateSnapshot());

      // Broadcast result to all clients
      io.emit('cardUsed', {
        playerId: socket.playerId,
        cardId: data.cardId,
        slotIndex: data.slotIndex,
        origin: { x: originX, z: originZ },
        radius: SUMMON_RADIUS,
        hits: hits
      });

      // Do NOT delete pendingSummons here — leave the entry so any duplicate
      // useCard events arriving in the same event-loop turn are rejected.
      // The per-tick clear() below will purge it on the next stateUpdate.

      return;
    }

    // ── Monster branch (spawn persistent minion) ──
    if (cardDef.type === 'monster') {
      const minion = {
        id: crypto.randomUUID(),
        ownerId: socket.playerId,
        x: originX,
        z: originZ,
        hp: 50,
        ttl: 30
      };
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
        origin: { x: originX, z: originZ }
      });

      return;
    }
  });

  socket.on('playerReady', (ready) => {
    const player = gameState.players[socket.playerId];
    if (!player) return;

    if (ready) {
      // Validate deck before accepting ready
      const result = validateDeck(player.selectedDeck, player.ownedCards);
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

  socket.on('deckAddCard', (data) => {
    // Guard: only allowed in lobby phase
    if (gameState.gamePhase !== 'lobby') return;

    const player = gameState.players[socket.playerId];
    if (!player) return;

    const cardId = data && typeof data.cardId === 'string' ? data.cardId : null;
    if (!cardId) {
      socket.emit('deckError', { reason: 'Missing cardId' });
      return;
    }

    // Validate card exists
    if (!CARD_DEFS[cardId]) {
      socket.emit('deckError', { reason: `Unknown card: ${cardId}` });
      return;
    }

    // Validate deck rules via canAddCardToDeck
    if (!canAddCardToDeck(cardId, player.selectedDeck, player.ownedCards)) {
      if (player.selectedDeck.length >= DECK_MAX_SIZE) {
        socket.emit('deckError', { reason: `Deck is full (${DECK_MAX_SIZE} cards max)` });
      } else if (player.selectedDeck.filter(id => id === cardId).length >= (player.ownedCards[cardId] || 0)) {
        socket.emit('deckError', { reason: `No extra copies of ${cardId} to add` });
      } else {
        socket.emit('deckError', { reason: `Cannot add ${cardId} to deck` });
      }
      return;
    }

    // Add card to deck
    player.selectedDeck.push(cardId);

    // Emit deckUpdate to the requesting player only
    socket.emit('deckUpdate', {
      selectedDeck: player.selectedDeck,
      ownedCards: player.ownedCards
    });

    savePlayerData(socket.playerId);
  });

  socket.on('deckRemoveCard', (data) => {
    // Guard: only allowed in lobby phase
    if (gameState.gamePhase !== 'lobby') return;

    const player = gameState.players[socket.playerId];
    if (!player) return;

    const cardId = data && typeof data.cardId === 'string' ? data.cardId : null;
    if (!cardId) {
      socket.emit('deckError', { reason: 'Missing cardId' });
      return;
    }

    // Find card in deck
    const idx = player.selectedDeck.indexOf(cardId);
    if (idx === -1) {
      socket.emit('deckError', { reason: `Card ${cardId} not in deck` });
      return;
    }

    // Remove one occurrence
    player.selectedDeck.splice(idx, 1);

    // Emit deckUpdate to the requesting player only
    socket.emit('deckUpdate', {
      selectedDeck: player.selectedDeck,
      ownedCards: player.ownedCards
    });

    savePlayerData(socket.playerId);
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
    validateDeck,
    canAddCardToDeck,
    createDrawDeckFromSelectedDeck,
    drawCardFromDeck,
    initPlayerHand,
    drawReplacementCard,
    CARD_DEFS,
    STARTING_DECK_IDS,
    checkWallCollision,
    buildWallColliders,
    wallAABB,
    ENTITY_RADIUS,
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
    provider,
    // Auth
    verifyToken,
    getJWTSecret
  };
}
