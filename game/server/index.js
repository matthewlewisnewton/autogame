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
    ready: false
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
    console.log(`Player ${socket.id} used card ${data.cardId} from slot ${data.slotIndex}`);
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
