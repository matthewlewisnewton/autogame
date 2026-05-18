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
    hp: 100
  };

  socket.emit('init', { id: socket.id, state: gameState });

  socket.on('move', (data) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].x = data.x;
      gameState.players[socket.id].y = data.y;
      gameState.players[socket.id].z = data.z;
      gameState.players[socket.id].rotation = data.rotation;
    }
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
