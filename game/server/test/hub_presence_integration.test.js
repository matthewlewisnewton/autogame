import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  startTestServer,
  closeServer,
  connectClient,
  waitForEvent,
  lobbyGameState,
  setServerUsersFilePath,
  clearServerUsers,
} from './helpers.js';
import { initAuth, resetAuthSecret } from '../auth.js';
import { clearAllSettings, resetSettingsPath } from '../settings.js';
import { HUB_LAYOUT } from '../index.js';
import { hubSpawnPosition } from '../simulation.js';

const cosmeticA = {
  bodyColor: '#112233',
  accentColor: '#445566',
  bodyShape: 'cone',
  hat: 'none',
  modelId: 'player',
  proportions: {
    height: 1.1,
    headSize: 0.9,
    torsoWidth: 1.0,
    armLength: 1.0,
    legLength: 1.0,
    shoulderWidth: 1.0,
  },
};

const cosmeticB = {
  bodyColor: '#aabbcc',
  accentColor: '#ddeeff',
  bodyShape: 'capsule',
  hat: 'beanie',
  modelId: 'player',
  proportions: {
    height: 0.95,
    headSize: 1.1,
    torsoWidth: 1.05,
    armLength: 0.9,
    legLength: 1.1,
    shoulderWidth: 0.95,
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerUser(baseUrl, username, password = 'password123') {
  const reg = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  expect(reg.status).toBe(201);
  const { accountId } = await reg.json();
  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  expect(login.status).toBe(200);
  const { token } = await login.json();
  return { accountId, token };
}

async function patchCosmetic(baseUrl, token, cosmetic) {
  const res = await fetch(`${baseUrl}/api/me/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cosmetic }),
  });
  expect(res.status).toBe(200);
  return res.json();
}

function waitForPresencePlayerCount(socket, count, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for hubPresenceUpdate with ${count} players`)),
      timeout,
    );
    const handler = (data) => {
      if (Object.keys(data.players).length === count) {
        clearTimeout(timer);
        socket.off('hubPresenceUpdate', handler);
        resolve(data);
      }
    };
    socket.on('hubPresenceUpdate', handler);
  });
}

function waitForPresenceWithoutPlayer(socket, playerId, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for hubPresenceUpdate without player ${playerId}`)),
      timeout,
    );
    const handler = (data) => {
      if (!(playerId in data.players)) {
        clearTimeout(timer);
        socket.off('hubPresenceUpdate', handler);
        resolve(data);
      }
    };
    socket.on('hubPresenceUpdate', handler);
  });
}

function waitForPlayerMoved(observerSocket, moverId, xBefore, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${moverId} to move in hubPresenceUpdate`)),
      timeout,
    );
    const handler = (data) => {
      const entry = data.players[moverId];
      if (entry && entry.x > xBefore) {
        clearTimeout(timer);
        observerSocket.off('hubPresenceUpdate', handler);
        resolve(data);
      }
    };
    observerSocket.on('hubPresenceUpdate', handler);
  });
}

async function connectTwoClientsInLobby(baseUrl, accountIdA, accountIdB) {
  const clientA = await connectClient(baseUrl, accountIdA, { name: 'Hub Presence Room' });
  const presencePromise = waitForPresencePlayerCount(clientA.socket, 2);
  const clientB = await connectClient(baseUrl, accountIdB, { joinLobbyId: clientA.lobbyId });
  const presenceUpdate = await presencePromise;
  expect(lobbyGameState(clientA.lobbyId).gamePhase).toBe('lobby');
  return { clientA, clientB, presenceUpdate };
}

describe('hub presence multiplayer integration', () => {
  let baseUrl;
  let tmpUserFile;
  let tmpDataDir;
  let clients = [];

  beforeEach(async () => {
    clients = [];
    tmpUserFile = path.join(
      os.tmpdir(),
      `hub-presence-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-presence-data-'));
    process.env.PERSISTENCE_PATH = tmpDataDir;
    setServerUsersFilePath(tmpUserFile);
    clearServerUsers();
    resetSettingsPath();
    clearAllSettings();
    resetAuthSecret();
    initAuth();
    baseUrl = await startTestServer();
  });

  afterEach(async () => {
    for (const client of clients) {
      if (client?.socket?.connected) client.socket.disconnect();
    }
    await closeServer();
    delete process.env.PERSISTENCE_PATH;
    try { fs.unlinkSync(tmpUserFile); } catch {}
    try { fs.rmSync(tmpDataDir, { recursive: true, force: true }); } catch {}
  });

  it('hubPresenceUpdate includes both players cosmetics matching account config', async () => {
    const { accountId: accountIdA, token: tokenA } = await registerUser(baseUrl, 'alice');
    const { accountId: accountIdB, token: tokenB } = await registerUser(baseUrl, 'bob');
    await patchCosmetic(baseUrl, tokenA, cosmeticA);
    await patchCosmetic(baseUrl, tokenB, cosmeticB);

    const clientA = await connectClient(baseUrl, accountIdA, { name: 'Cosmetic Room' });
    clients.push(clientA);
    const updateOnAPromise = waitForPresencePlayerCount(clientA.socket, 2);
    const clientB = await connectClient(baseUrl, accountIdB, { joinLobbyId: clientA.lobbyId });
    clients.push(clientB);
    const updateOnBPromise = waitForPresencePlayerCount(clientB.socket, 2);

    const [updateOnA, updateOnB] = await Promise.all([updateOnAPromise, updateOnBPromise]);
    expect(lobbyGameState(clientA.lobbyId).gamePhase).toBe('lobby');

    for (const update of [updateOnA, updateOnB]) {
      expect(update.players[clientA.socket._playerId].cosmetic).toEqual(cosmeticA);
      expect(update.players[clientB.socket._playerId].cosmetic).toEqual(cosmeticB);
    }
  });

  it('client B hubPresenceUpdate shows client A moved from hub spawn while B is unchanged', async () => {
    const { accountId: accountIdA } = await registerUser(baseUrl, 'mover-a');
    const { accountId: accountIdB } = await registerUser(baseUrl, 'mover-b');
    const { clientA, clientB } = await connectTwoClientsInLobby(baseUrl, accountIdA, accountIdB);
    clients.push(clientA, clientB);

    const spawn = hubSpawnPosition(HUB_LAYOUT);
    const playerAId = clientA.socket._playerId;
    const playerBId = clientB.socket._playerId;
    const state = lobbyGameState(clientA.lobbyId);

    expect(state.players[playerAId].x).toBeCloseTo(spawn.x, 1);
    expect(state.players[playerAId].z).toBeCloseTo(spawn.z, 1);
    const aXBefore = state.players[playerAId].x;
    const bXBefore = state.players[playerBId].x;
    const bZBefore = state.players[playerBId].z;

    const updatePromise = waitForPlayerMoved(clientB.socket, playerAId, aXBefore);
    clientA.socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 1 });
    const update = await updatePromise;

    expect(update.players[playerAId].x).toBeGreaterThan(aXBefore);
    expect(update.players[playerAId].x).not.toBeCloseTo(spawn.x, 0);
    expect(update.players[playerBId].x).toBeCloseTo(bXBefore, 5);
    expect(update.players[playerBId].z).toBeCloseTo(bZBefore, 5);
  });

  it('host receives hubPresenceUpdate containing guest before guest moves', async () => {
    const { accountId: accountIdA } = await registerUser(baseUrl, 'host-join');
    const { accountId: accountIdB } = await registerUser(baseUrl, 'guest-join');

    const clientA = await connectClient(baseUrl, accountIdA, { name: 'Join Room' });
    clients.push(clientA);
    const joinUpdatePromise = waitForPresencePlayerCount(clientA.socket, 2);

    const clientB = await connectClient(baseUrl, accountIdB, { joinLobbyId: clientA.lobbyId });
    clients.push(clientB);

    const update = await joinUpdatePromise;
    const spawn = hubSpawnPosition(HUB_LAYOUT);
    const guestId = clientB.socket._playerId;

    expect(update.players[guestId]).toBeDefined();
    expect(update.players[guestId].x).toBeCloseTo(spawn.x, 1);
    expect(update.players[guestId].z).toBeCloseTo(spawn.z, 1);
    expect(Object.keys(update.players)).toHaveLength(2);
  });

  it('leaveLobby removes guest from host hubPresenceUpdate', async () => {
    const { accountId: accountIdA } = await registerUser(baseUrl, 'host-leave');
    const { accountId: accountIdB } = await registerUser(baseUrl, 'guest-leave');
    const { clientA, clientB } = await connectTwoClientsInLobby(baseUrl, accountIdA, accountIdB);
    clients.push(clientA, clientB);
    await sleep(60);

    const leaveUpdatePromise = waitForPresenceWithoutPlayer(
      clientA.socket,
      clientB.socket._playerId,
    );
    clientB.socket.emit('leaveLobby');
    await waitForEvent(clientB.socket, 'lobbyLeft');

    const update = await leaveUpdatePromise;
    expect(update.players[clientB.socket._playerId]).toBeUndefined();
    expect(update.players[clientA.socket._playerId]).toBeDefined();
    expect(Object.keys(update.players)).toHaveLength(1);
  });
});
