// Socket handler registration — handlers are extracted into submodules per slice.

const lobby = require('./lobby');

function registerAllSocketHandlers(socket, ctx) {
  lobby.register(socket, ctx);
}

module.exports = { registerAllSocketHandlers };
