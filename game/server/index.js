const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const crypto = require('crypto');
const {
  mulberry32,
  generateLayout,
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

// Throttle state for swept-collision rejection logging (per-socket)
const SWEPT_COLLISION_LOG_THROTTLE_MS = 1000;
const sweptCollisionLogTimes = new Map();

// Generate dungeon layout at startup
const layoutSeed = Math.floor(Math.random() * 2147483647);
gameState.layoutSeed = layoutSeed;
gameState.layout = generateLayout(layoutSeed);
console.log(`[server] Dungeon seed: ${layoutSeed}, rooms: ${gameState.layout.rooms.length}`);

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

function firstRoomPosition() {
  const first = gameState.layout.rooms[0];
  return { x: first.x, z: first.z };
}

function randomRoomPosition() {
  const room = gameState.layout.rooms[Math.floor(Math.random() * gameState.layout.rooms.length)];
  const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
  const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
  return {
    x: room.x + (Math.random() * 2 - 1) * halfW,
    z: room.z + (Math.random() * 2 - 1) * halfD,
  };
}

function clampToDungeon(x, z) {
  const bounds = gameState.dungeonBounds;
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
    z: Math.max(bounds.minZ, Math.min(bounds.maxZ, z)),
  };
}

const PLAYER_RADIUS = 0.5;
const WALL_THICKNESS = 0.4;
const PASSAGE_WALL_THICKNESS = 0.3;

/**
 * Build AABB colliders from the current dungeon layout walls.
 * Returns an array of { minX, maxX, minZ, maxZ } objects.
 */
function buildWallColliders() {
  const colliders = [];
  const layout = gameState.layout;
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
function checkWallCollision(px, pz) {
  const colliders = buildWallColliders();
  const pr = PLAYER_RADIUS;

  for (const w of colliders) {
    if (px + pr <= w.minX || px - pr >= w.maxX) continue;
    if (pz + pr <= w.minZ || pz - pr >= w.maxZ) continue;
    return true; // overlap
  }

  return false;
}

/**
 * Check if the line segment from (fromX, fromZ) to (toX, toZ) intersects
 * any wall collider expanded by PLAYER_RADIUS. Returns true on intersection.
 * Uses a slab-based segment-AABB intersection test.
 */
function checkSweptCollision(fromX, fromZ, toX, toZ) {
  const colliders = buildWallColliders();
  const pr = PLAYER_RADIUS;

  for (const w of colliders) {
    // Expand AABB by player radius
    const aabb = {
      minX: w.minX - pr,
      maxX: w.maxX + pr,
      minZ: w.minZ - pr,
      maxZ: w.maxZ + pr,
    };

    if (segmentIntersectsAABB(fromX, fromZ, toX, toZ, aabb)) {
      return true;
    }
  }

  return false;
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

gameState.dungeonBounds = computeDungeonBounds(gameState.layout);
console.log(`[server] Dungeon bounds: x [${gameState.dungeonBounds.minX.toFixed(1)}, ${gameState.dungeonBounds.maxX.toFixed(1)}], z [${gameState.dungeonBounds.minZ.toFixed(1)}, ${gameState.dungeonBounds.maxZ.toFixed(1)}]`);

// Store interval/timeout IDs so tests can clean them up
const _intervals = [];
const _timeouts = [];

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

// Enemy type definitions — data layer only (no behavior changes yet)
const ENEMY_DEFS = {
	grunt:      { hp: 50,  chaseSpeed: 2.5, wanderSpeed: 1.0, attackDamage: 10, attackWindupMs: 800 },
	skirmisher: { hp: 20,  chaseSpeed: 4.5, wanderSpeed: 1.5, attackDamage: 6,  attackWindupMs: 500 },
	miniboss:   { hp: 150, chaseSpeed: 1.2, wanderSpeed: 0.6, attackDamage: 18, attackWindupMs: 1200 },
	spawner:    { hp: 60,  chaseSpeed: 1.8, wanderSpeed: 0.9, attackDamage: 8,  attackWindupMs: 900,
		spawnIntervalMs: 4000, spawnMaxAlive: 3, spawnType: 'skirmisher' },
};

const DEBUG_SCENARIOS = new Set([
  'summon-low-mana',
  'summon-ready',
  'combat-damaged-player',
  'mixed-enemies',
  'spawner-active',
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

/**
 * Filter dead enemies (`hp <= 0`) from `gameState.enemies` and record
 * the count of removed enemies against the current run objective.
 *
 * Returns the number of enemies that were removed.
 */
function removeDeadEnemies() {
  const before = gameState.enemies.length;
  gameState.enemies = gameState.enemies.filter(e => e.hp > 0);
  const removed = before - gameState.enemies.length;
  if (removed > 0) {
    recordEnemyDefeated(removed);
  }
  return removed;
}

/**
 * Spawn loot for all dead enemies, remove them, and check run terminal state.
 * Replaces the 3-line inline pattern that appeared in updateMinions, the weapon
 * card branch, and the summon card branch.
 */
function cleanupAfterDamage() {
  for (const e of gameState.enemies) {
    if (e.hp <= 0) spawnLoot(e.x, e.z);
  }
  if (removeDeadEnemies() > 0) {
    checkRunTerminalState();
  }
}

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

// Helper: apply damage to a player, handle death + 3s respawn
function damagePlayer(playerId, amount) {
  const player = gameState.players[playerId];
  if (!player) return;

  player.hp = Math.max(0, player.hp - amount);

  if (player.hp <= 0 && !player.dead) {
    player.dead = true;

    checkRunTerminalState();

    const respawnId = setTimeout(() => {
      const p = gameState.players[playerId];
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

function randomWanderTarget() {
  return randomRoomPosition();
}

/**
 * Create a single enemy at (x, z) with the given type and push it to
 * gameState.enemies[].  `type` must be a key in ENEMY_DEFS; defaults to
 * 'grunt' when omitted.  Throws on unknown types.
 *
 * `spawnedBy` — optional parent spawner id; used for spawn-cap bookkeeping.
 * Spawners get a `lastSpawnTime` field initialised to `Date.now()`.
 */
function spawnEnemy(x, z, type = 'grunt', spawnedBy) {
  if (!ENEMY_DEFS[type]) {
    throw new Error(`Unknown enemy type: ${type} (valid: ${Object.keys(ENEMY_DEFS).join(', ')})`);
  }
  const def = ENEMY_DEFS[type];
  const enemy = {
    id: crypto.randomUUID(),
    x,
    z,
    type,
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
  gameState.enemies.push(enemy);
  return enemy;
}

// Helper: spawn 5 enemies inside generated rooms (mixed types)
function spawnEnemies() {
  const spawnTable = ['skirmisher', 'skirmisher', 'grunt', 'miniboss', 'spawner'];
  for (const type of spawnTable) {
    const pos = randomRoomPosition();
    const enemy = spawnEnemy(pos.x, pos.z, type);
    enemy.wanderTarget = randomWanderTarget();
  }
}

// Helper: spawn a loot item at the given position (50 % chance)
function spawnLoot(x, z) {
  if (Math.random() >= LOOT_SPAWN_CHANCE) return;

  const value = Math.floor(Math.random() * 16) + 5;
  const id = crypto.randomUUID();
  gameState.loot.push({ id, x, z, value, createdAt: Date.now() });
  console.log(`[loot] spawned id=${id} value=${value}`);
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

  const player = gameState.players[socket.id];
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
 * Try to find a position within `radius` units of (x, z) that is inside
 * dungeon bounds.  Falls back to `randomRoomPosition()` when clamping
 * pushes the candidate outside the radius (near dungeon edges).
 *
 * Uses polar coordinates (random angle + random radius) so the raw
 * candidate is always within the circle — no spurious fallbacks.
 */
function nearbySpawnPosition(x, z, radius) {
  const bounds = gameState.dungeonBounds;
  // Polar sampling: uniform angle, uniform distance within circle
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.sqrt(Math.random()) * radius;
  const candidate = {
    x: x + Math.cos(angle) * dist,
    z: z + Math.sin(angle) * dist,
  };
  // Clamp to dungeon bounds
  candidate.x = Math.max(bounds.minX, Math.min(bounds.maxX, candidate.x));
  candidate.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, candidate.z));
  // After clamping, verify it's still within radius (edge case: near dungeon boundary)
  if (Math.hypot(candidate.x - x, candidate.z - z) <= radius) return candidate;
  // Fall back to a random room position
  return randomRoomPosition();
}

// Helper: update enemy wander AI each tick
function updateEnemies() {
	if (gameState.run && (gameState.run.status === 'victory' || gameState.run.status === 'failed')) return;

	const dt = 1 / TICK_RATE;
	const players = Object.values(gameState.players).filter(p => !p.dead);

	for (const enemy of gameState.enemies) {
		const def = ENEMY_DEFS[enemy.type] || ENEMY_DEFS.grunt;

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
				const target = gameState.players[enemy.windupTargetId];
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
				const aliveAdds = gameState.enemies.filter(
					e => e.spawnedBy === enemy.id && e.hp > 0
				).length;

				if (aliveAdds < spawnMaxAlive) {
					// Place add within ~3 units of spawner
					const addPos = nearbySpawnPosition(enemy.x, enemy.z, 3);
					const add = spawnEnemy(addPos.x, addPos.z, spawnType, enemy.id);
					add.wanderTarget = randomWanderTarget();
					enemy.lastSpawnTime = now;
				}
			}
		}

		// ── Find nearest living player ──
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

			const dx = nearestPlayer.x - enemy.x;
			const dz = nearestPlayer.z - enemy.z;
			const dist = Math.hypot(dx, dz);

			if (dist > 0.1) {
				const move = def.chaseSpeed * dt;
				enemy.x += (dx / dist) * move;
				enemy.z += (dz / dist) * move;
			}
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
			continue;
		}

		// Normalize and move toward wander target
		const move = def.wanderSpeed * dt;
		enemy.x += (wdx / wdist) * move;
		enemy.z += (wdz / wdist) * move;
	}
}

// Helper: decrement minion TTL and remove expired/dead minions
function updateMinions() {
  const dt = 1 / TICK_RATE;
  const runTerminal = gameState.run && (gameState.run.status === 'victory' || gameState.run.status === 'failed');

  // AI: each living minion seeks nearest enemy, chases, and attacks
  // Skipped entirely when the run is terminal (victory or failed)
  if (!runTerminal) {
    for (const minion of gameState.minions) {
      let nearestDist = Infinity;
      let nearestEnemy = null;

      for (const enemy of gameState.enemies) {
        const dx = enemy.x - minion.x;
        const dz = enemy.z - minion.z;
        const dist = Math.hypot(dx, dz);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      }

      // Chase if an enemy is within detection range
      if (nearestEnemy && nearestDist < DETECTION_RADIUS) {
        // Attack if within attack range
        if (nearestDist <= ATTACK_RANGE) {
          nearestEnemy.hp -= 5;
        } else {
          // Move toward enemy
          const dx = nearestEnemy.x - minion.x;
          const dz = nearestEnemy.z - minion.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.1) {
            const move = ENEMY_DEFS.grunt.chaseSpeed * dt;
            minion.x += (dx / dist) * move;
            minion.z += (dz / dist) * move;
          }
        }
      }
      // No enemy in range — minion remains stationary (does not wander)
    }
  }

  // Cleanup dead enemies after minion attacks
  cleanupAfterDamage();

  // Decrement TTL and remove expired/dead minions
  for (const minion of gameState.minions) {
    minion.ttl -= dt;
  }
  gameState.minions = gameState.minions.filter(m => m.ttl > 0 && m.hp > 0);
}

// Helper: remove stale players (no activity for STALE_THRESHOLD ms)
// Extracted so tests can invoke directly without setInterval
function cleanupStalePlayers() {
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (Date.now() - player.lastActivity > STALE_THRESHOLD) {
      const socket = io.sockets.sockets.get(playerId);
      if (socket && socket.connected) {
        socket.disconnect();
      }
      delete gameState.players[playerId];
      console.log(`Player disconnected due to inactivity: ${playerId}`);
    }
  }
}

// Helper: regenerate Magic Stones for all players (one tick)
function regenMagicStones() {
  for (const p of Object.values(gameState.players)) {
    if (p.debugScenario === 'summon-low-mana') {
      p.magicStones = 0;
    } else {
      p.magicStones = Math.min(MAX_MAGIC_STONES, p.magicStones + MAGIC_STONES_REGEN_PER_TICK);
    }
    p.pendingSummons.clear();
  }
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

// ── Server startup (deferred so tests can import without starting HTTP) ──

function startServer(port) {
  // Remove previous connection handlers so repeated calls (in tests) don't stack
  io.removeAllListeners('connection');
  // Clear any previously created intervals/timeouts (from prior test runs)
  clearAllTimers();

  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    const spawn = firstRoomPosition();

    // Initialize player state on connection.
    if (!gameState.players[socket.id]) {
      const progress = createPlayerProgress();

      // Default selected deck: the full 8-card starting deck (STARTING_DECK_IDS),
      // so players have a draw-deck reserve beyond the 4-card opening hand.
      const defaultDeck = [...STARTING_DECK_IDS];

      gameState.players[socket.id] = {
        id: socket.id,
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

  const player = gameState.players[socket.id];
  socket.emit('init', { id: socket.id, state: gameState, layoutSeed: gameState.layoutSeed, layout: gameState.layout, selectedDeck: player.selectedDeck, ownedCards: player.ownedCards });

  // Broadcast updated lobby on connect
  broadcastLobbyUpdate();

  socket.on('move', (data) => {
    if (gameState.gamePhase !== 'playing') return;

    const player = gameState.players[socket.id];

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
    const player = gameState.players[socket.id];
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
        playerId: socket.id,
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
        playerId: socket.id,
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
        ownerId: socket.id,
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
        playerId: socket.id,
        cardId: data.cardId,
        slotIndex: data.slotIndex,
        origin: { x: originX, z: originZ }
      });

      return;
    }
  });

  socket.on('playerReady', (ready) => {
    const player = gameState.players[socket.id];
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

    const player = gameState.players[socket.id];
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
  });

  socket.on('deckRemoveCard', (data) => {
    // Guard: only allowed in lobby phase
    if (gameState.gamePhase !== 'lobby') return;

    const player = gameState.players[socket.id];
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
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].lastActivity = Date.now();
    }
    socket.emit('heartbeat_ack', { latency: Date.now() - data.timestamp });
  });

  socket.on('lootPickup', (data) => {
    if (!data || !data.lootId) return;

    const player = gameState.players[socket.id];
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
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    sweptCollisionLogTimes.delete(socket.id);
    delete gameState.players[socket.id];
    gameState.minions = gameState.minions.filter(m => m.ownerId !== socket.id);
    io.emit('playerDisconnected', socket.id);

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
    // Server objects for integration tests
    server,
    io,
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
    ENEMY_DEFS
  };
}
