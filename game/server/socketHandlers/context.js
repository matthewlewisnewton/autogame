/**
 * Assemble per-connection context for socket handler modules.
 * Helpers are passed in from index.js to avoid circular requires
 * (mirrors cardEffects.setCallbacks / keyItemEffects.setCallbacks).
 */
const { DECK_MAX_SIZE } = require('../config');
const {
  CARD_DEFS,
  normalizePlayerInventory,
  getInventoryInstance,
  cardIdForDeckEntry,
  findAvailableInventoryInstance,
  canAddCardInstanceToDeck,
  validateDeck,
  evolveCard,
  sellCard,
  grindCard,
  healAtMedic,
  unlockHatForPlayer,
  stateSnapshot,
} = require('../progression');
const { findUserByAccountId, unlockHat: unlockHatForAccount } = require('../users');
const { backfillUnlockedHats } = require('../cosmetic');

const deckHelpers = {
  DECK_MAX_SIZE,
  CARD_DEFS,
  normalizePlayerInventory,
  getInventoryInstance,
  cardIdForDeckEntry,
  findAvailableInventoryInstance,
  canAddCardInstanceToDeck,
  validateDeck,
  evolveCard,
  sellCard,
  grindCard,
  healAtMedic,
  unlockHatForPlayer,
  stateSnapshot,
  findUserByAccountId,
  backfillUnlockedHats,
  unlockHatForAccount,
};

function buildSocketContext(socket, session, helpers) {
  const { playerId, sessionPlayer, accountId, username } = session;
  return {
    socket,
    playerId,
    sessionPlayer,
    accountId,
    username,
    io: helpers.io,
    withLobbyFromSocket: helpers.withLobbyFromSocket,
    withLobbyPlayer: helpers.withLobbyPlayer,
    broadcastLobbyUpdate: helpers.broadcastLobbyUpdate,
    findSocketByPlayerId: helpers.findSocketByPlayerId,
    savePlayerData: helpers.savePlayerData,
    getLobbyForSocket: helpers.getLobbyForSocket,
    getLobbyForPlayer: helpers.getLobbyForPlayer,
    softDisconnectPlayerFromLobby: helpers.softDisconnectPlayerFromLobby,
    removeSession: helpers.removeSession,
    lobbies: helpers.lobbies,
    withLobbyContext: helpers.withLobbyContext,
    applyLayoutForQuest: helpers.applyLayoutForQuest,
    ensureShopOffer: helpers.ensureShopOffer,
    joinPlayerToLobby: helpers.joinPlayerToLobby,
    reconnectPlayerToLobby: helpers.reconnectPlayerToLobby,
    joinLobbyWithPhasePolicy: helpers.joinLobbyWithPhasePolicy,
    leaveLobbyForSocket: helpers.leaveLobbyForSocket,
    buildSessionFromPlayer: helpers.buildSessionFromPlayer,
    ...deckHelpers,
  };
}

module.exports = { buildSocketContext, deckHelpers };
