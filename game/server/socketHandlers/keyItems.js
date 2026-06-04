const { getKeyItemDef } = require('../progression');
const keyItemEffects = require('../keyItemEffects');

function register(socket, ctx) {
  const { withLobbyFromSocket, savePlayerData } = ctx;

  socket.on('equipKeyItem', (data) => {
    withLobbyFromSocket(socket, (state) => {
      if (state.gamePhase !== 'lobby') {
        socket.emit('keyItemError', { reason: 'not_in_lobby' });
        return;
      }

      const player = state.players[socket.playerId];
      if (!player) return;

      const keyItemId = data && typeof data.keyItemId === 'string' ? data.keyItemId : null;
      if (!keyItemId) {
        socket.emit('keyItemError', { reason: 'missing_key_item_id' });
        return;
      }

      const def = getKeyItemDef(keyItemId);
      if (!def) {
        socket.emit('keyItemError', { reason: 'unknown_item' });
        return;
      }

      player.equippedKeyItemId = keyItemId;
      savePlayerData(socket.playerId);

      socket.emit('keyItemEquipped', { keyItemId });
    });
  });

  socket.on('useKeyItem', (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
      keyItemEffects.handleUseKeyItem(socket, state, lobby, data);
    });
  });
}

module.exports = { register };
