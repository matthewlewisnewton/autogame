const express = require('express');
const { Server } = require('socket.io');
const http = require('http');

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
  lobby: []
};

const TICK_RATE = 20; // 20 times per second

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
    lastActivity: Date.now()
  };

  socket.emit('init', { id: socket.id, state: gameState });

  socket.on('move', (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        ![data.x, data.y, data.z, data.rotation].every(Number.isFinite)) return;

    if (gameState.players[socket.id]) {
      gameState.players[socket.id].x = data.x;
      gameState.players[socket.id].y = data.y;
      gameState.players[socket.id].z = data.z;
      gameState.players[socket.id].rotation = data.rotation;
      gameState.players[socket.id].lastActivity = Date.now();
    }
  });

  socket.on('heartbeat', (data) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].lastActivity = Date.now();
    }
    socket.emit('heartbeat_ack', { latency: Date.now() - data.timestamp });
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete gameState.players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Server Game Loop
setInterval(() => {
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
});
