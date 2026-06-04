/**
 * Development debug scenario socket handler.
 * Behavior matches the pre-refactor inline handler in index.js.
 */

function register(socket, ctx) {
  const { isDebugScenarioAllowed, applyDebugScenario } = ctx;

  socket.on('debugScenario', (data) => {
    const name = data && typeof data.name === 'string' ? data.name : '';
    if (!isDebugScenarioAllowed(socket)) {
      socket.emit('debugScenarioResult', { ok: false, reason: 'Debug scenarios are disabled' });
      return;
    }

    const result = applyDebugScenario(socket, name);
    socket.emit('debugScenarioResult', result);
  });
}

module.exports = { register };
