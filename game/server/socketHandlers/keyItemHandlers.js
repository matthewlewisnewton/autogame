// ── Key-item Socket Handlers ──
// Registers key-item socket.on handlers extracted from lobbyHandlers.js.

const { CLIENT_TO_SERVER } = require('../../shared/events.js');
const keyItemEffects = require('../keyItemEffects');
const { getKeyItemDef, savePlayerData } = require('../progression');

function register(socket, ctx) {
  const { withLobbyPlayer, withLobbyFromSocket } = ctx;

  socket.on(CLIENT_TO_SERVER.EQUIP_KEY_ITEM, (data) => {
    withLobbyPlayer(socket, {
      requirePhase: 'lobby',
      phaseMismatch: { event: 'keyItemError', payload: { reason: 'not_in_lobby' } },
    }, (state, lobby, player) => {
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

  socket.on(CLIENT_TO_SERVER.USE_KEY_ITEM, (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
      keyItemEffects.handleUseKeyItem(socket, state, lobby, data);
    });
  });
}

module.exports = { register };
