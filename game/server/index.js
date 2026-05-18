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

// Game state
const gameState = {
  players: {},
  enemies: [],
  lobby: [],
  gamePhase: 'lobby'
};

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

// Summon parameters
const SUMMON_RADIUS = 10; // units — radial AoE

// Weapon attack parameters
const ATTACK_RANGE = 5; // units — max distance to hit
const ATTACK_CONE_ANGLE = Math.PI / 2; // 90-degree forward cone

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

// Helper: check if all players are ready and transition if so
function checkAllReady() {
  const all = Object.values(gameState.players);
  if (all.length > 0 && all.every(p => p.ready)) {
    gameState.gamePhase = 'playing';
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

    setTimeout(() => {
      const p = gameState.players[playerId];
      if (!p) return; // player may have disconnected
      p.hp = 100;
      p.dead = false;
      p.x = 0;
      p.y = 0.5;
      p.z = 0;
    }, 3000);
  }
}

// Helper: pick a random position within [-20, 20] on x and z
function randomWanderTarget() {
  return {
    x: (Math.random() * 40) - 20,
    z: (Math.random() * 40) - 20
  };
}

// Helper: spawn 5 enemies with random positions
function spawnEnemies() {
  for (let i = 0; i < 5; i++) {
    gameState.enemies.push({
      id: crypto.randomUUID(),
      x: (Math.random() * 40) - 20,
      z: (Math.random() * 40) - 20,
      hp: 50,
      state: 'idle',
      wanderTarget: randomWanderTarget()
    });
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
    io.emit('startGame');
  }
}

function applyDebugScenario(socket, name) {
  if (!DEBUG_SCENARIOS.has(name)) {
    return { ok: false, reason: `Unknown debug scenario: ${name}` };
  }

  const player = gameState.players[socket.id];
  if (!player) return { ok: false, reason: 'No player for debug scenario' };

  player.ready = true;
  player.dead = false;
  player.x = 0;
  player.y = 0.5;
  player.z = 0;
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
  io.emit('stateUpdate', gameState);
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

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Initialize player
  gameState.players[socket.id] = {
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
    deck: [],
    hp: 100,
    dead: false,
    lastActivity: Date.now(),
    ready: false,
    magicStones: MAX_MAGIC_STONES,
    debugScenario: null,
    pendingSummons: new Set()
  };

  socket.emit('init', { id: socket.id, state: gameState });

  // Broadcast updated lobby on connect
  broadcastLobbyUpdate();

  socket.on('move', (data) => {
    const player = gameState.players[socket.id];

    if (player && player.dead) return;

    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        ![data.x, data.y, data.z, data.rotation].every(Number.isFinite)) {
      console.warn(`Rejected move from ${socket.id}: invalid payload`);
      return;
    }

    if (player) {
      const clampedX = Math.max(-25, Math.min(25, data.x));
      const clampedZ = Math.max(-25, Math.min(25, data.z));
      player.x = clampedX;
      player.y = data.y;
      player.z = clampedZ;
      player.rotation = data.rotation;
      player.lastActivity = Date.now();
    }
  });

  socket.on('damage', (data) => {
    if (!data || !data.targetId || typeof data.amount !== 'number') return;
    damagePlayer(data.targetId, data.amount);
  });

  socket.on('damageEnemy', (data) => {
    if (!data || !data.enemyId || typeof data.amount !== 'number') return;
    const enemy = gameState.enemies.find(e => e.id === data.enemyId);
    if (!enemy) return;
    enemy.hp -= data.amount;
    if (enemy.hp <= 0) {
      gameState.enemies = gameState.enemies.filter(e => e.id !== data.enemyId);
    }
  });

  socket.on('useCard', (data) => {
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

      // Remove dead enemies
      gameState.enemies = gameState.enemies.filter(e => e.hp > 0);

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

      // Remove dead enemies
      gameState.enemies = gameState.enemies.filter(e => e.hp > 0);

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

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete gameState.players[socket.id];
    io.emit('playerDisconnected', socket.id);

    if (gameState.gamePhase === 'lobby') {
      broadcastLobbyUpdate();
    }
  });
});

// Server Game Loop
setInterval(() => {
  updateEnemies();

  // Regenerate Magic Stones and clear pending summons for each player
  for (const p of Object.values(gameState.players)) {
    if (p.debugScenario === 'summon-low-mana') {
      p.magicStones = 0;
    } else {
      p.magicStones = Math.min(MAX_MAGIC_STONES, p.magicStones + MAGIC_STONES_REGEN_PER_TICK);
    }
    p.pendingSummons.clear(); // safety net: clear stale pending entries each tick
  }

  io.emit('stateUpdate', gameState);
}, 1000 / TICK_RATE);

// Periodic stale player cleanup (every 5 seconds)
const STALE_THRESHOLD = 10000; // 10 seconds
setInterval(() => {
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
}, 5000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  spawnEnemies();
});
