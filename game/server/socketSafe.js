// Guards Socket.IO event handlers so a single thrown/rejected handler cannot
// tear down the Node process during dev/harness runs.

function logSocketHandlerFailure(event, err) {
  const detail = err && err.stack ? err.stack : err;
  console.error(`[socket:${event}] handler error:`, detail);
}

/**
 * Wrap a socket listener so sync throws and async rejections are logged, not fatal.
 * @param {string} event
 * @param {(...args: unknown[]) => unknown} handler
 */
function wrapSocketListener(event, handler) {
  return function socketListenerWrapper(...args) {
    try {
      const result = handler.apply(this, args);
      if (result && typeof result.then === 'function') {
        result.catch((err) => logSocketHandlerFailure(event, err));
      }
    } catch (err) {
      logSocketHandlerFailure(event, err);
    }
  };
}

/**
 * Patch socket.on so every registered listener is wrapped once.
 * @param {import('socket.io').Socket} socket
 */
function patchSocketOn(socket) {
  if (socket._autogameSafeOnPatched) return;
  socket._autogameSafeOnPatched = true;
  const originalOn = socket.on.bind(socket);
  socket.on = (event, handler) => originalOn(event, wrapSocketListener(event, handler));
}

module.exports = {
  wrapSocketListener,
  patchSocketOn,
};
