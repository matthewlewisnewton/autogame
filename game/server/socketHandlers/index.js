// Socket handler registration — handlers are extracted into submodules per slice.

const lobby = require('./lobby');
const run = require('./run');
const deck = require('./deck');
const keyItems = require('./keyItems');
const trade = require('./trade');
const session = require('./session');

function registerAllSocketHandlers(socket, ctx) {
  lobby.register(socket, ctx);
  run.register(socket, ctx);
  deck.register(socket, ctx);
  keyItems.register(socket, ctx);
  trade.register(socket, ctx);
  session.register(socket, ctx);
}

module.exports = { registerAllSocketHandlers };
