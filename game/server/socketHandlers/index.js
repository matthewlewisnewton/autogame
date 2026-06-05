const { createSocketHandlerCtx } = require('./ctx');
const lifecycle = require('./lifecycle');
const lobby = require('./lobby');

function registerAll(socket, ctx) {
  lifecycle.register(socket, ctx);
  lobby.register(socket, ctx);
}

module.exports = {
  createSocketHandlerCtx,
  registerAll,
};
