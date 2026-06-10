// Player-to-player card trade offer/response logic.
// Lobby-scoped functions take `state` as the first parameter (no module-level game state).

const crypto = require('crypto');
const {
  normalizePlayerInventory,
  getInventoryInstance,
  findAvailableInventoryInstance,
  inventoryToOwnedCards,
  validateDeck,
  isValidCardId,
} = require('./inventory');

function cancelTradesForPlayer(state, pendingTrades, playerId) {
  if (!pendingTrades || !playerId) return [];
  const cancelled = [];
  for (const [tradeId, trade] of Object.entries(pendingTrades)) {
    if (trade.fromPlayerId === playerId || trade.toPlayerId === playerId) {
      cancelled.push({ tradeId, ...trade });
      delete pendingTrades[tradeId];
    }
  }
  return cancelled;
}

function offerCardTrade(state, pendingTrades, offererId, targetPlayerId, offeredCardId, requestedCardId) {
  if (!pendingTrades) {
    return { ok: false, reason: 'Invalid trade state' };
  }
  if (offererId === targetPlayerId) {
    return { ok: false, reason: 'Cannot trade with yourself' };
  }

  const offerer = state.players[offererId];
  const target = state.players[targetPlayerId];
  if (!offerer) {
    return { ok: false, reason: 'Offerer not found' };
  }
  if (!target) {
    return { ok: false, reason: 'Target player not found' };
  }
  if (!isValidCardId(offeredCardId) || !isValidCardId(requestedCardId)) {
    return { ok: false, reason: 'Unknown card in trade offer' };
  }

  normalizePlayerInventory(offerer);
  normalizePlayerInventory(target);

  const offeredInstance = findAvailableInventoryInstance(
    offeredCardId,
    offerer.selectedDeck,
    offerer.inventory
  );
  if (!offeredInstance) {
    return { ok: false, reason: `No extra ${offeredCardId} available to offer` };
  }

  const requestedInstance = findAvailableInventoryInstance(
    requestedCardId,
    target.selectedDeck,
    target.inventory
  );
  if (!requestedInstance) {
    return { ok: false, reason: `Target has no extra ${requestedCardId} to trade` };
  }

  const tradeId = crypto.randomUUID();
  pendingTrades[tradeId] = {
    id: tradeId,
    fromPlayerId: offererId,
    toPlayerId: targetPlayerId,
    offeredCardId,
    requestedCardId,
    offeredInstanceId: offeredInstance.instanceId,
    createdAt: Date.now()
  };

  return {
    ok: true,
    tradeId,
    trade: pendingTrades[tradeId],
    targetUsername: target.username || targetPlayerId
  };
}

function respondCardTrade(state, pendingTrades, responderId, tradeId, accepted) {
  if (!pendingTrades) {
    return { ok: false, reason: 'Invalid trade state' };
  }

  const trade = pendingTrades[tradeId];
  if (!trade || trade.toPlayerId !== responderId) {
    return { ok: false, reason: 'Trade offer not found' };
  }

  if (!accepted) {
    delete pendingTrades[tradeId];
    return { ok: true, accepted: false, tradeId };
  }

  const offerer = state.players[trade.fromPlayerId];
  const responder = state.players[trade.toPlayerId];
  if (!offerer || !responder) {
    delete pendingTrades[tradeId];
    return { ok: false, reason: 'Trade players are no longer available' };
  }

  normalizePlayerInventory(offerer);
  normalizePlayerInventory(responder);

  const offeredInstance = getInventoryInstance(offerer.inventory, trade.offeredInstanceId);
  if (!offeredInstance || offeredInstance.cardId !== trade.offeredCardId) {
    delete pendingTrades[tradeId];
    return { ok: false, reason: 'Offered card is no longer available' };
  }
  if (offerer.selectedDeck.includes(offeredInstance.instanceId)) {
    delete pendingTrades[tradeId];
    return { ok: false, reason: 'Offered card is required by the offerer deck' };
  }

  const requestedInstance = findAvailableInventoryInstance(
    trade.requestedCardId,
    responder.selectedDeck,
    responder.inventory
  );
  if (!requestedInstance) {
    delete pendingTrades[tradeId];
    return { ok: false, reason: 'Requested card is no longer available' };
  }

  offerer.inventory = offerer.inventory.filter(entry => entry.instanceId !== offeredInstance.instanceId);
  responder.inventory = responder.inventory.filter(entry => entry.instanceId !== requestedInstance.instanceId);
  offerer.inventory.push({ ...requestedInstance });
  responder.inventory.push({ ...offeredInstance });
  offerer.ownedCards = inventoryToOwnedCards(offerer.inventory);
  responder.ownedCards = inventoryToOwnedCards(responder.inventory);

  const offererDeckCheck = validateDeck(offerer.selectedDeck, offerer.inventory);
  if (!offererDeckCheck.valid) {
    offerer.inventory = offerer.inventory.filter(entry => entry.instanceId !== requestedInstance.instanceId);
    responder.inventory = responder.inventory.filter(entry => entry.instanceId !== offeredInstance.instanceId);
    offerer.inventory.push({ ...offeredInstance });
    responder.inventory.push({ ...requestedInstance });
    offerer.ownedCards = inventoryToOwnedCards(offerer.inventory);
    responder.ownedCards = inventoryToOwnedCards(responder.inventory);
    delete pendingTrades[tradeId];
    return { ok: false, reason: offererDeckCheck.reason };
  }

  const responderDeckCheck = validateDeck(responder.selectedDeck, responder.inventory);
  if (!responderDeckCheck.valid) {
    offerer.inventory = offerer.inventory.filter(entry => entry.instanceId !== requestedInstance.instanceId);
    responder.inventory = responder.inventory.filter(entry => entry.instanceId !== offeredInstance.instanceId);
    offerer.inventory.push({ ...offeredInstance });
    responder.inventory.push({ ...requestedInstance });
    offerer.ownedCards = inventoryToOwnedCards(offerer.inventory);
    responder.ownedCards = inventoryToOwnedCards(responder.inventory);
    delete pendingTrades[tradeId];
    return { ok: false, reason: responderDeckCheck.reason };
  }

  delete pendingTrades[tradeId];
  return {
    ok: true,
    accepted: true,
    tradeId,
    offererId: offerer.id,
    responderId: responder.id,
    offeredInstanceId: offeredInstance.instanceId,
    requestedInstanceId: requestedInstance.instanceId
  };
}

module.exports = {
  cancelTradesForPlayer,
  offerCardTrade,
  respondCardTrade,
};
