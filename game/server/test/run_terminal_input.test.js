import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runGameLoopTick } from '../index.js';
import {
  startTestServer,
  closeServer,
  connectClient,
  waitForEvent,
  playerForSocket,
  lobbyStateForSocket,
} from './helpers.js';

async function connectAndStartRun(baseUrl) {
  const { socket } = await connectClient(baseUrl);
  const startGamePromise = waitForEvent(socket, 'startGame');
  socket.emit('playerReady', true);
  await startGamePromise;
  return { socket };
}

function testLoot(overrides) {
  return {
    y: 0,
    kind: 'gold',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('run terminal input freeze', () => {
  let baseUrl;

  beforeEach(async () => {
    baseUrl = await startTestServer();
  });

  afterEach(async () => {
    await closeServer();
  });

  it('lootPickup after victory does not credit currency or remove loot', async () => {
    const { socket } = await connectAndStartRun(baseUrl);
    const player = playerForSocket(socket);
    const state = lobbyStateForSocket(socket);

    state.run.status = 'victory';

    const startCurrency = player.currency;
    const startEarned = player.currencyEarnedThisRun ?? 0;

    const loot = testLoot({
      id: 'loot-terminal-victory',
      x: player.x,
      z: player.z,
      value: 50,
    });
    state.loot.push(loot);

    socket.emit('lootPickup', { lootId: loot.id });

    expect(player.currency).toBe(startCurrency);
    expect(player.currencyEarnedThisRun ?? 0).toBe(startEarned);
    expect(state.loot.some((entry) => entry.id === loot.id)).toBe(true);
  });

  it('lootPickup after failed does not credit currency or remove loot', async () => {
    const { socket } = await connectAndStartRun(baseUrl);
    const player = playerForSocket(socket);
    const state = lobbyStateForSocket(socket);

    state.run.status = 'failed';

    const startCurrency = player.currency;
    const startEarned = player.currencyEarnedThisRun ?? 0;

    const loot = testLoot({
      id: 'loot-terminal-failed',
      x: player.x,
      z: player.z,
      value: 25,
    });
    state.loot.push(loot);

    socket.emit('lootPickup', { lootId: loot.id });

    expect(player.currency).toBe(startCurrency);
    expect(player.currencyEarnedThisRun ?? 0).toBe(startEarned);
    expect(state.loot.some((entry) => entry.id === loot.id)).toBe(true);
  });

  it('move after victory does not change position on the next simulation tick', async () => {
    const { socket } = await connectAndStartRun(baseUrl);
    const player = playerForSocket(socket);
    const state = lobbyStateForSocket(socket);

    state.run.status = 'victory';

    const startX = player.x;
    const startZ = player.z;

    socket.emit('move', { dx: 1, dz: 0, rotation: 0 });

    expect(player.inputActive).toBeFalsy();
    expect(player.inputDx || 0).toBe(0);
    expect(player.inputDz || 0).toBe(0);

    runGameLoopTick();

    expect(player.x).toBe(startX);
    expect(player.z).toBe(startZ);
  });

  it('move after failed does not change position on the next simulation tick', async () => {
    const { socket } = await connectAndStartRun(baseUrl);
    const player = playerForSocket(socket);
    const state = lobbyStateForSocket(socket);

    state.run.status = 'failed';
    player.inputActive = true;
    player.inputDx = 1;
    player.inputDz = 0;
    player.lastInputTime = Date.now();

    const startX = player.x;
    const startZ = player.z;

    socket.emit('move', { dx: 1, dz: 0, rotation: 0 });

    runGameLoopTick();

    expect(player.x).toBe(startX);
    expect(player.z).toBe(startZ);
  });
});
