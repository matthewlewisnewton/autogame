// Socket handler registration — handlers are extracted into submodules per slice.

const lobby = require('./lobby');
const run = require('./run');
const deck = require('./deck');
const keyItems = require('./keyItems');

function registerAllSocketHandlers(socket, ctx) {
  lobby.register(socket, ctx);
  run.register(socket, ctx);
  deck.register(socket, ctx);
  keyItems.register(socket, ctx);
}

module.exports = { registerAllSocketHandlers };
