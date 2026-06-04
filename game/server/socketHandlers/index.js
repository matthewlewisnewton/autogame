// Socket handler registration — handlers are extracted into submodules per slice.

const lobby = require('./lobby');
const run = require('./run');

function registerAllSocketHandlers(socket, ctx) {
  lobby.register(socket, ctx);
  run.register(socket, ctx);
}

module.exports = { registerAllSocketHandlers };
