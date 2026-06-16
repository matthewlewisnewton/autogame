const { isRedisEnabled } = require('./redis');
const lobbyRegistry = require('./lobbyRegistry');

function getFlyMachineId() {
  const raw = process.env.FLY_MACHINE_ID;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isFlyReplayEnabled() {
  return isRedisEnabled() && getFlyMachineId() !== null;
}

function normalizeLobbyId(lobbyId) {
  if (lobbyId == null) {
    return null;
  }
  const normalized = String(lobbyId).trim();
  return normalized.length > 0 ? normalized : null;
}

async function resolveLobbyRouting(lobbyId) {
  if (!isFlyReplayEnabled()) {
    return { action: 'self' };
  }

  const normalizedLobbyId = normalizeLobbyId(lobbyId);
  if (!normalizedLobbyId) {
    return { action: 'self' };
  }

  const localMachineId = getFlyMachineId();
  const owner = await lobbyRegistry.getLobbyOwner(normalizedLobbyId);

  if (owner === null) {
    return { action: 'self', claimOwner: true };
  }

  if (owner === localMachineId) {
    return { action: 'self' };
  }

  return { action: 'replay', machineId: owner };
}

module.exports = {
  getFlyMachineId,
  isFlyReplayEnabled,
  resolveLobbyRouting,
};
