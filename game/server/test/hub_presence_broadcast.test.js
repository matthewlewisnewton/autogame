import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  startTestServer,
  closeServer,
  connectClient,
  waitForEvent,
  lobbyGameState,
} from './helpers.js';
import { runGameLoopTick } from '../index.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertPresencePlayer(entry) {
  expect(entry).toMatchObject({
    x: expect.any(Number),
    y: expect.any(Number),
    z: expect.any(Number),
    rotation: expect.any(Number),
    username: expect.any(String),
    cosmetic: expect.any(Object),
  });
}

async function connectTwoClients(baseUrl, accountIdA, accountIdB) {
  const host = await connectClient(baseUrl, accountIdA, { name: 'Presence Room' });
  const guest = await connectClient(baseUrl, accountIdB, { joinLobbyId: host.lobbyId });
  return { host, guest };
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

function waitForGuestMoved(hostSocket, guestId, xBefore, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out waiting for guest position in hubPresenceUpdate')),
      timeout,
    );
    const handler = (data) => {
      const entry = data.players[guestId];
      if (entry && entry.x > xBefore) {
        clearTimeout(timer);
        hostSocket.off('hubPresenceUpdate', handler);
        resolve(data);
      }
    };
    hostSocket.on('hubPresenceUpdate', handler);
  });
}

describe('hubPresenceUpdate broadcast', () => {
  let baseUrl;
  let host;
  let guest;

  beforeEach(async () => {
    baseUrl = await startTestServer();
  });

  afterEach(async () => {
    if (host?.socket?.connected) host.socket.disconnect();
    if (guest?.socket?.connected) guest.socket.disconnect();
    await closeServer();
  });

  it('join adds the second player to hubPresenceUpdate received by the first client', async () => {
    host = await connectClient(baseUrl, 'host-presence');
    const joinUpdatePromise = waitForPresencePlayerCount(host.socket, 2);

    guest = await connectClient(baseUrl, 'guest-presence', { joinLobbyId: host.lobbyId });

    const update = await joinUpdatePromise;
    expect(update).toMatchObject({
      lobbyId: host.lobbyId,
      revision: expect.any(Number),
      players: expect.any(Object),
    });
    expect(update.players[host.socket._playerId]).toBeDefined();
    expect(update.players[guest.socket._playerId]).toBeDefined();
    assertPresencePlayer(update.players[guest.socket._playerId]);
    expect(Object.keys(update.players)).toHaveLength(2);
  });

  it('leave removes the departed player from hubPresenceUpdate', async () => {
    ({ host, guest } = await connectTwoClients(baseUrl, 'host-leave', 'guest-leave'));
    await sleep(60);

    const leaveUpdatePromise = waitForPresenceWithoutPlayer(host.socket, guest.socket._playerId);
    guest.socket.emit('leaveLobby');
    await waitForEvent(guest.socket, 'lobbyLeft');

    const update = await leaveUpdatePromise;
    expect(update.lobbyId).toBe(host.lobbyId);
    expect(update.players[guest.socket._playerId]).toBeUndefined();
    expect(update.players[host.socket._playerId]).toBeDefined();
    expect(Object.keys(update.players)).toHaveLength(1);
  });

  it('lobby move is reflected in hubPresenceUpdate after a tick', async () => {
    ({ host, guest } = await connectTwoClients(baseUrl, 'host-move', 'guest-move'));

    const guestId = guest.socket._playerId;
    const xBefore = lobbyGameState(host.lobbyId).players[guestId].x;

    const updatePromise = waitForGuestMoved(host.socket, guestId, xBefore);
    guest.socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 1 });
    const update = await updatePromise;

    assertPresencePlayer(update.players[guestId]);
    expect(update.players[guestId].x).toBeGreaterThan(xBefore);
  });

  it('does not emit hubPresenceUpdate on game-loop ticks during playing phase', async () => {
    ({ host, guest } = await connectTwoClients(baseUrl, 'host-playing', 'guest-playing'));
    host.socket.emit('playerReady', true);
    guest.socket.emit('playerReady', true);
    await waitForEvent(host.socket, 'startGame');
    expect(lobbyGameState(host.lobbyId).gamePhase).toBe('playing');

    let hubPresenceCount = 0;
    host.socket.on('hubPresenceUpdate', () => {
      hubPresenceCount += 1;
    });

    runGameLoopTick();
    await sleep(60);

    expect(hubPresenceCount).toBe(0);
  });
});
