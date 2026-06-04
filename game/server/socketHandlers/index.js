// Socket handler registration — handlers are extracted into submodules per slice.

const lobby = require('./lobby');
const run = require('./run');
const deck = require('./deck');

function registerAllSocketHandlers(socket, ctx) {
  lobby.register(socket, ctx);
  run.register(socket, ctx);
  deck.register(socket, ctx);
}

module.exports = { registerAllSocketHandlers };
