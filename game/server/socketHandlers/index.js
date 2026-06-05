const { createSocketHandlerCtx } = require('./ctx');
const lifecycle = require('./lifecycle');
const lobby = require('./lobby');
const deck = require('./deck');
const trade = require('./trade');
const keyItem = require('./keyItem');

function registerAll(socket, ctx) {
  lifecycle.register(socket, ctx);
  lobby.register(socket, ctx);
  deck.register(socket, ctx);
  trade.register(socket, ctx);
  keyItem.register(socket, ctx);
}

module.exports = {
  createSocketHandlerCtx,
  registerAll,
};
