// ── Key-item Socket Handlers ──
// Registers key-item socket.on handlers extracted from lobbyHandlers.js.

function register(socket, ctx) {
  const { getUnlockedKeyItems } = ctx;

  socket.on('listKeyItems', () => {
    const items = getUnlockedKeyItems().map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      cooldownMs: def.cooldownMs,
    }));
    socket.emit('keyItemsListed', { items });
  });
}

module.exports = { register };
