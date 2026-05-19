const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust later for production
    methods: ["GET", "POST"]
  }
});

// ── Seeded PRNG (Mulberry32) ──

function mulberry32(seed) {
  let s = seed | 0; // coerce to signed 32-bit int
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Dungeon Layout Generator ──

// Grid dimensions and spacing for room placement
const GRID_COLS = 4;
const GRID_ROWS = 4;
const CELL_SPACING = 20; // center-to-center distance between adjacent cells
const MIN_ROOM_SIZE = 12;
const MAX_ROOM_SIZE_INCLUSIVE = 15;
const PASSAGE_WIDTH = 4;

/**
 * Generate a deterministic dungeon layout from a numeric seed.
 * Returns { rooms: [...], passages: [...] }
 */
function generateLayout(seed) {
  const rng = mulberry32(seed);

  // Step 1 — place rooms by growth so every room is guaranteed connected
  // Start from a random seed cell, then repeatedly add a random unoccupied
  // neighbour of an existing room until we reach the target count.
  const grid = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    grid[r] = new Array(GRID_COLS).fill(false);
  }
  const cellPositions = []; // [{r, c, x, z}]

  const startR = Math.floor(rng() * GRID_ROWS);
  const startC = Math.floor(rng() * GRID_COLS);
  const startZ = (startR - (GRID_ROWS - 1) / 2) * CELL_SPACING;
  const startX = (startC - (GRID_COLS - 1) / 2) * CELL_SPACING;
  grid[startR][startC] = true;
  cellPositions.push({ r: startR, c: startC, x: startX, z: startZ });

  // Target: at least 4 rooms, up to grid capacity
  const maxRooms = GRID_ROWS * GRID_COLS;
  const targetRooms = Math.max(4, Math.min(maxRooms, Math.floor(GRID_ROWS * GRID_COLS * 0.6)));

  while (cellPositions.length < targetRooms) {
    // Build frontier: unoccupied neighbours of existing rooms
    const frontier = [];
    for (const cell of cellPositions) {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = cell.r + dr;
        const nc = cell.c + dc;
        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && !grid[nr][nc]) {
          frontier.push({ r: nr, c: nc });
        }
      }
    }

    if (frontier.length === 0) break; // grid is full

    // Pick a random frontier cell and add it
    const pick = frontier[Math.floor(rng() * frontier.length)];
    grid[pick.r][pick.c] = true;
    const px = (pick.c - (GRID_COLS - 1) / 2) * CELL_SPACING;
    const pz = (pick.r - (GRID_ROWS - 1) / 2) * CELL_SPACING;
    cellPositions.push({ r: pick.r, c: pick.c, x: px, z: pz });
  }

  // Step 2 — build connectivity via randomized DFS spanning tree
  // Adjacency: up/down/left/right
  const visited = new Set();
  const passages = []; // [{from, to}]  (from/to are indices into cellPositions)
  const key = (r, c) => `${r},${c}`;

  // Pick a random starting cell
  const startIdx = Math.floor(rng() * cellPositions.length);
  const stack = [startIdx];
  visited.add(startIdx);

  while (stack.length > 0) {
    const idx = stack[stack.length - 1];
    const cell = cellPositions[idx];
    const neighbors = [];

    // Check 4 neighbours
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = cell.r + dr;
      const nc = cell.c + dc;
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && grid[nr][nc]) {
        const nIdx = cellPositions.findIndex(cp => cp.r === nr && cp.c === nc);
        if (nIdx >= 0 && !visited.has(nIdx)) {
          neighbors.push(nIdx);
        }
      }
    }

    if (neighbors.length > 0) {
      // Pick a random unvisited neighbor
      const nextIdx = neighbors[Math.floor(rng() * neighbors.length)];
      stack.push(nextIdx);
      visited.add(nextIdx);
      passages.push({ from: idx, to: nextIdx });
    } else {
      stack.pop();
    }
  }

  // Step 3 — add a few extra edges for loops (up to 30 % of possible edges)
  const possibleExtra = [];
  for (const cell of cellPositions) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = cell.r + dr;
      const nc = cell.c + dc;
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && grid[nr][nc]) {
        const nIdx = cellPositions.findIndex(cp => cp.r === nr && cp.c === nc);
        const cIdx = cellPositions.indexOf(cell);
        if (nIdx >= 0 && cIdx < nIdx) { // avoid duplicates
          const exists = passages.some(p =>
            (p.from === cIdx && p.to === nIdx) || (p.from === nIdx && p.to === cIdx)
          );
          if (!exists) possibleExtra.push({ from: cIdx, to: nIdx });
        }
      }
    }
  }
  // Shuffle and pick a fraction
  for (let i = possibleExtra.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [possibleExtra[i], possibleExtra[j]] = [possibleExtra[j], possibleExtra[i]];
  }
  const extraCount = Math.min(Math.floor(possibleExtra.length * 0.3), possibleExtra.length);
  for (let i = 0; i < extraCount; i++) {
    passages.push(possibleExtra[i]);
  }

  // Step 4 — determine which sides each room uses for passage gaps
  // Map: cellIndex → Set of directions that have passages ('up','down','left','right')
  const passageSides = cellPositions.map(() => new Set());
  for (const p of passages) {
    const from = cellPositions[p.from];
    const to = cellPositions[p.to];
    if (to.r === from.r - 1) { passageSides[p.from].add('up'); passageSides[p.to].add('down'); }
    if (to.r === from.r + 1) { passageSides[p.from].add('down'); passageSides[p.to].add('up'); }
    if (to.c === from.c - 1) { passageSides[p.from].add('left'); passageSides[p.to].add('right'); }
    if (to.c === from.c + 1) { passageSides[p.from].add('right'); passageSides[p.to].add('left'); }
  }

  // Step 5 — build room objects with walls (gaps for passages)
  const rooms = cellPositions.map((cell, idx) => {
    const width = MIN_ROOM_SIZE + Math.floor(rng() * (MAX_ROOM_SIZE_INCLUSIVE - MIN_ROOM_SIZE + 1));
    const depth = MIN_ROOM_SIZE + Math.floor(rng() * (MAX_ROOM_SIZE_INCLUSIVE - MIN_ROOM_SIZE + 1));
    const halfW = width / 2;
    const halfD = depth / 2;
    const sides = passageSides[idx];
    const walls = [];
    const gap = PASSAGE_WIDTH;

    // North wall (z = cell.z - halfD), along x-axis
    if (!sides.has('up')) {
      walls.push({ x: cell.x, z: cell.z - halfD, length: width, axis: 'x' });
    } else {
      const segLen = (width - gap) / 2;
      walls.push({ x: cell.x - gap / 2 - segLen / 2, z: cell.z - halfD, length: segLen, axis: 'x' });
      walls.push({ x: cell.x + gap / 2 + segLen / 2, z: cell.z - halfD, length: segLen, axis: 'x' });
    }

    // South wall (z = cell.z + halfD)
    if (!sides.has('down')) {
      walls.push({ x: cell.x, z: cell.z + halfD, length: width, axis: 'x' });
    } else {
      const segLen = (width - gap) / 2;
      walls.push({ x: cell.x - gap / 2 - segLen / 2, z: cell.z + halfD, length: segLen, axis: 'x' });
      walls.push({ x: cell.x + gap / 2 + segLen / 2, z: cell.z + halfD, length: segLen, axis: 'x' });
    }

    // West wall (x = cell.x - halfW), along z-axis
    if (!sides.has('left')) {
      walls.push({ x: cell.x - halfW, z: cell.z, length: depth, axis: 'z' });
    } else {
      const segLen = (depth - gap) / 2;
      walls.push({ x: cell.x - halfW, z: cell.z - gap / 2 - segLen / 2, length: segLen, axis: 'z' });
      walls.push({ x: cell.x - halfW, z: cell.z + gap / 2 + segLen / 2, length: segLen, axis: 'z' });
    }

    // East wall (x = cell.x + halfW)
    if (!sides.has('right')) {
      walls.push({ x: cell.x + halfW, z: cell.z, length: depth, axis: 'z' });
    } else {
      const segLen = (depth - gap) / 2;
      walls.push({ x: cell.x + halfW, z: cell.z - gap / 2 - segLen / 2, length: segLen, axis: 'z' });
      walls.push({ x: cell.x + halfW, z: cell.z + gap / 2 + segLen / 2, length: segLen, axis: 'z' });
    }

    return { x: cell.x, z: cell.z, width, depth, walls };
  });

  // Step 6 — build passage objects with boundary walls
  const passageObjects = passages.map(p => {
    const from = cellPositions[p.from];
    const to = cellPositions[p.to];
    const walls = [];
    const halfGap = PASSAGE_WIDTH / 2;

    // Horizontal passage (same row, different column)
    if (from.r === to.r) {
      const wallCentreX = (from.x + to.x) / 2;
      walls.push({ x: wallCentreX, z: from.z - halfGap, length: CELL_SPACING, axis: 'x' });
      walls.push({ x: wallCentreX, z: from.z + halfGap, length: CELL_SPACING, axis: 'x' });
    }

    // Vertical passage (same column, different row)
    if (from.c === to.c) {
      const wallCentreZ = (from.z + to.z) / 2;
      walls.push({ x: from.x - halfGap, z: wallCentreZ, length: CELL_SPACING, axis: 'z' });
      walls.push({ x: from.x + halfGap, z: wallCentreZ, length: CELL_SPACING, axis: 'z' });
    }

    return { x1: from.x, z1: from.z, x2: to.x, z2: to.z, walls };
  });

  return { rooms, passages: passageObjects };
}

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

// Generate dungeon layout at startup
const layoutSeed = Math.floor(Math.random() * 2147483647);
gameState.layoutSeed = layoutSeed;
gameState.layout = generateLayout(layoutSeed);
console.log(`[server] Dungeon seed: ${layoutSeed}, rooms: ${gameState.layout.rooms.length}`);

const BOUNDS_MARGIN = 2;
const SPAWN_PADDING = 2;

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

gameState.dungeonBounds = computeDungeonBounds(gameState.layout);
console.log(`[server] Dungeon bounds: x [${gameState.dungeonBounds.minX.toFixed(1)}, ${gameState.dungeonBounds.maxX.toFixed(1)}], z [${gameState.dungeonBounds.minZ.toFixed(1)}, ${gameState.dungeonBounds.maxZ.toFixed(1)}]`);

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
}

const TICK_RATE = 20; // 20 times per second
const WANDER_SPEED = 1; // units per second
const DETECTION_RADIUS = 8; // units
const CHASE_SPEED = 2.5; // units per second

const MAX_MAGIC_STONES = 100;
const MAGIC_STONES_REGEN_PER_TICK = 0.5;
const DEBUG_SCENARIOS = new Set([
  'summon-low-mana',
  'summon-ready',
  'combat-damaged-player',
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
 * `ownedCards` is a map of unique card id → count, seeded from the starting deck.
 */
function createPlayerProgress() {
  const ownedCards = {};
  for (const cardId of [...new Set(STARTING_DECK_IDS)]) {
    ownedCards[cardId] = 1;
  }
  return {
    currency: 0,
    ownedCards,
    runRewards: null,
    currencyEarnedThisRun: 0
  };
}

// Summon parameters
const SUMMON_RADIUS = 10; // units — radial AoE

// Weapon attack parameters
const ATTACK_RANGE = 5; // units — max distance to hit
const ATTACK_CONE_ANGLE = Math.PI / 2; // 90-degree forward cone
const STALE_THRESHOLD = 10000; // 10 seconds

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
 * Record `count` enemy kills against the current run objective.
 * Safe no-op when gameState.run is undefined (e.g. lobby phase).
 */
function recordEnemyDefeated(count = 1) {
  if (!gameState.run) return;
  gameState.run.objective.defeatedEnemies += count;
  clampObjectiveProgress(gameState.run);
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
 * Victory reward rotation — deterministic sequence of card ids handed out
 * on successive victories.  Each element is a card id present in CARD_DEFS.
 */
const VICTORY_REWARD_ROTATION = [
  'flame_blade',
  'battle_familiar',
  'dungeon_drake',
];

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
    player.hp = 100;
    player.x = spawn.x;
    player.y = 0.5;
    player.z = spawn.z;
    player.currency = preservedCurrency;
    player.inventory = preservedInventory;
    player.ownedCards = preservedOwnedCards;
    player.runRewards = preservedRunRewards;
    player.currencyEarnedThisRun = 0;
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

    setTimeout(() => {
      const p = gameState.players[playerId];
      if (!p) return; // player may have disconnected
      const spawn = firstRoomPosition();
      p.hp = 100;
      p.dead = false;
      p.x = spawn.x;
      p.y = 0.5;
      p.z = spawn.z;
    }, 3000);
  }
}

function randomWanderTarget() {
  return randomRoomPosition();
}

// Helper: spawn 5 enemies inside generated rooms
function spawnEnemies() {
  for (let i = 0; i < 5; i++) {
    const position = randomRoomPosition();
    gameState.enemies.push({
      id: crypto.randomUUID(),
      x: position.x,
      z: position.z,
      hp: 50,
      state: 'idle',
      wanderTarget: randomWanderTarget()
    });
  }
}

// Helper: spawn a loot item at the given position (50 % chance)
function spawnLoot(x, z) {
  if (Math.random() >= 0.5) return;

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

  gameState.enemies.push({
    id: crypto.randomUUID(),
    x: x + 3,
    z,
    hp: 50,
    state: 'idle',
    wanderTarget: { x: x + 3, z }
  });
}

function enterPlayingPhase() {
  if (gameState.gamePhase !== 'playing') {
    gameState.gamePhase = 'playing';
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

  player.ready = true;
  player.dead = false;
  player.x = spawn.x;
  player.y = 0.5;
  player.z = spawn.z;
  player.debugScenario = name;
  player.pendingSummons.clear();
  enterPlayingPhase();
  ensureNearbyEnemy(player.x, player.z);

  if (name === 'summon-low-mana') {
    player.hp = 100;
    player.magicStones = 0;
  } else if (name === 'summon-ready') {
    player.hp = 100;
    player.magicStones = MAX_MAGIC_STONES;
  } else if (name === 'combat-damaged-player') {
    player.hp = 25;
    player.magicStones = MAX_MAGIC_STONES;
  }

  broadcastLobbyUpdate();
  io.emit('stateUpdate', stateSnapshot());
  return { ok: true, scenario: name };
}

// Helper: update enemy wander AI each tick
function updateEnemies() {
  const dt = 1 / TICK_RATE;
  const players = Object.values(gameState.players).filter(p => !p.dead);

  for (const enemy of gameState.enemies) {
    // Find nearest living player (Euclidean distance on x-z plane)
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

    // Chase logic
    if (nearestPlayer && nearestDist < DETECTION_RADIUS) {
      enemy.state = 'chasing';
      const dx = nearestPlayer.x - enemy.x;
      const dz = nearestPlayer.z - enemy.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.1) {
        const move = CHASE_SPEED * dt;
        enemy.x += (dx / dist) * move;
        enemy.z += (dz / dist) * move;
      }
      continue;
    }

    // No player in range — revert to idle and wander
    enemy.state = 'idle';
    const wdx = enemy.wanderTarget.x - enemy.x;
    const wdz = enemy.wanderTarget.z - enemy.z;
    const wdist = Math.hypot(wdx, wdz);

    // Reached wander target — pick a new one
    if (wdist < 0.5) {
      enemy.wanderTarget = randomWanderTarget();
      continue;
    }

    // Normalize and move toward wander target
    const move = WANDER_SPEED * dt;
    enemy.x += (wdx / wdist) * move;
    enemy.z += (wdz / wdist) * move;
  }
}

// Helper: decrement minion TTL and remove expired/dead minions
function updateMinions() {
  const dt = 1 / TICK_RATE;

  // AI: each living minion seeks nearest enemy, chases, and attacks
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
          const move = CHASE_SPEED * dt;
          minion.x += (dx / dist) * move;
          minion.z += (dz / dist) * move;
        }
      }
    }
    // No enemy in range — minion remains stationary (does not wander)
  }

  // Spawn loot for dead enemies killed by minion attacks
  for (const e of gameState.enemies) {
    if (e.hp <= 0) spawnLoot(e.x, e.z);
  }
  const defeatedMinion = gameState.enemies.length;
  gameState.enemies = gameState.enemies.filter(e => e.hp > 0);
  const defeatedMinionCount = defeatedMinion - gameState.enemies.length;
  if (defeatedMinionCount > 0) {
    recordEnemyDefeated(defeatedMinionCount);
    checkRunTerminalState();
  }

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

function stateSnapshot() {
  const snapshot = { ...gameState };
  delete snapshot.layout;
  return snapshot;
}

// ── Server startup (deferred so tests can import without starting HTTP) ──

// Store interval IDs so tests can clean them up
const _intervals = [];

function startServer(port) {
  // Remove previous connection handlers so repeated calls (in tests) don't stack
  io.removeAllListeners('connection');
  // Clear any previously created intervals (from prior test runs)
  for (const id of _intervals) clearInterval(id);
  _intervals.length = 0;

  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    const spawn = firstRoomPosition();

    // Only initialize progress state for NEW players — reconnecting players
    // keep their accumulated currency, ownedCards, and runRewards.
    if (!gameState.players[socket.id]) {
      const progress = createPlayerProgress();

      gameState.players[socket.id] = {
        x: spawn.x,
        y: 0.5,
        z: spawn.z,
        rotation: 0,
        deck: [],
        hp: 100,
        dead: false,
        lastActivity: Date.now(),
        ready: false,
        magicStones: MAX_MAGIC_STONES,
        currency: progress.currency,
        ownedCards: progress.ownedCards,
        runRewards: progress.runRewards,
        currencyEarnedThisRun: progress.currencyEarnedThisRun,
        debugScenario: null,
        pendingSummons: new Set()
      };
    } else {
      // Reconnecting player — reset transient fields only
      gameState.players[socket.id].lastActivity = Date.now();
      gameState.players[socket.id].pendingSummons = new Set();
    }

  socket.emit('init', { id: socket.id, state: gameState, layoutSeed: gameState.layoutSeed, layout: gameState.layout });

  // Broadcast updated lobby on connect
  broadcastLobbyUpdate();

  socket.on('move', (data) => {
    if (gameState.run && gameState.run.status !== 'playing') return;

    const player = gameState.players[socket.id];

    if (player && player.dead) return;

    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        ![data.x, data.y, data.z, data.rotation].every(Number.isFinite)) {
      console.warn(`Rejected move from ${socket.id}: invalid payload`);
      return;
    }

    if (player) {
      const clamped = clampToDungeon(data.x, data.z);
      player.x = clamped.x;
      player.y = data.y;
      player.z = clamped.z;
      player.rotation = data.rotation;
      player.lastActivity = Date.now();
    }
  });

  socket.on('damage', (data) => {
    if (!data || !data.targetId || typeof data.amount !== 'number') return;
    damagePlayer(data.targetId, data.amount);
  });

  socket.on('useCard', (data) => {
    if (gameState.run && gameState.run.status !== 'playing') return;

    if (!data || typeof data.slotIndex !== 'number' || !data.cardId) return;

    // (1) Validate slot index
    if (data.slotIndex < 0 || data.slotIndex > 3) return;

    // (2) Look up card definition
    const cardDef = CARD_DEFS[data.cardId];
    if (!cardDef) return;

    // (3) Get player
    const player = gameState.players[socket.id];
    if (!player || player.dead) return;

    const originX = player.x;
    const originZ = player.z;

    // ── Weapon branch (forward cone attack) ──
    if (cardDef.type === 'weapon') {
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

      // Spawn loot for dead enemies
      for (const e of gameState.enemies) {
        if (e.hp <= 0) spawnLoot(e.x, e.z);
      }
      const defeatedWeapon = gameState.enemies.length;
      gameState.enemies = gameState.enemies.filter(e => e.hp > 0);
      const defeatedWeaponCount = defeatedWeapon - gameState.enemies.length;
      if (defeatedWeaponCount > 0) {
        recordEnemyDefeated(defeatedWeaponCount);
        checkRunTerminalState();
      }

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

      // Spawn loot for dead enemies
      for (const e of gameState.enemies) {
        if (e.hp <= 0) spawnLoot(e.x, e.z);
      }
      const defeatedSummon = gameState.enemies.length;
      gameState.enemies = gameState.enemies.filter(e => e.hp > 0);
      const defeatedSummonCount = defeatedSummon - gameState.enemies.length;
      if (defeatedSummonCount > 0) {
        recordEnemyDefeated(defeatedSummonCount);
        checkRunTerminalState();
      }

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
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].ready = !!ready;
      broadcastLobbyUpdate();
      if (gameState.gamePhase === 'lobby') {
        checkAllReady();
      }
    }
  });

  socket.on('returnToLobby', () => {
    returnPlayersToLobby();
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
    delete gameState.players[socket.id];
    gameState.minions = gameState.minions.filter(m => m.ownerId !== socket.id);
    io.emit('playerDisconnected', socket.id);

    if (gameState.gamePhase === 'playing') {
      checkRunTerminalState();
    }

    if (gameState.gamePhase === 'lobby') {
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
  gameState.loot = gameState.loot.filter(l => (now - l.createdAt) < 120000);

  io.emit('stateUpdate', stateSnapshot());
}, 1000 / TICK_RATE);
_intervals.push(gameLoopId);

// Periodic stale player cleanup (every 5 seconds)
const staleCleanupId = setInterval(cleanupStalePlayers, 5000);
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
    createGameState,
    resetGameState,
    gameState,
    startServer,
    cleanupStalePlayers,
    regenMagicStones,
    createRunState,
    startDungeonRun,
    recordEnemyDefeated,
    clampObjectiveProgress,
    buildRunSummary,
    checkRunTerminalState,
    resetTransientRunState,
    returnPlayersToLobby,
    createPlayerProgress,
    grantCard,
    grantRunRewards,
    buildPlayerRewardSummary,
    CARD_DEFS,
    // Server objects for integration tests
    server,
    io,
    _intervals,
    // Constants needed by tests
    STALE_THRESHOLD,
    MAX_MAGIC_STONES,
    MAGIC_STONES_REGEN_PER_TICK,
    DETECTION_RADIUS,
    ATTACK_RANGE,
    TICK_RATE,
    GRID_COLS,
    GRID_ROWS,
    CELL_SPACING
  };
}
