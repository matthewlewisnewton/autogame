const { createSocketHandlerCtx } = require('./ctx');
const lifecycle = require('./lifecycle');

function registerAll(socket, ctx) {
  lifecycle.register(socket, ctx);
}

module.exports = {
  createSocketHandlerCtx,
  registerAll,
};
