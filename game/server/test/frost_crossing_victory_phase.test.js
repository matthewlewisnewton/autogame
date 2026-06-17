import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  ENCOUNTER_TRIGGER_RADIUS,
  tryActivateEncounter,
} from '../encounters.js';
import {
  setTestProvider,
  checkRunTerminalState,
  cleanupAfterDamage,
  removeDeadEnemies,
  suspendRunToLobby,
  maybeSuspendRun,
  hotStateSnapshot,
  _timeouts,
} from '../index.js';
import { ensureTerminalRunStaysInDungeon } from '../progression.js';
import {
  startTestServer,
  closeServer,
  connectClient,
  waitForEvent,
  testGameState,
} from './helpers.js';
import { InMemoryProvider } from '../providers.js';

const require = createRequire(import.meta.url);
const users = require('../users.js');

const QUEST_ID = 'frost_crossing';
const TIER_1 = 1;

function runSimulationInPrimaryLobby(fn) {
  const state = testGameState();
  if (!state) throw new Error('runSimulationInPrimaryLobby: no active lobby state');
  const sim = require('../simulation');
  const progression = require('../progression');
  sim.setGameState(state, _timeouts);
  progression.setGameState(state);
  return fn(state);
}

function bossEnemy(state) {
  return state.enemies.find((e) => e.id === state.run.encounter.bossEnemyId);
}

function defeatFrostCrossingBoss(state) {
  for (const enemy of [...state.enemies]) {
    if (enemy.id !== state.run.encounter.bossEnemyId) enemy.hp = 0;
  }
  removeDeadEnemies();

  const anchor = state.run.encounter.spawnAnchor;
  const player = Object.values(state.players)[0];
  if (anchor && player) {
    player.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    player.z = anchor.z;
  }
  tryActivateEncounter(state);
  bossEnemy(state).hp = 0;
}

async function collectPostVictoryStateUpdates(socket, trigger) {
  const updates = [];
  let sawRunComplete = false;
  const onStateUpdate = (payload) => {
    if (sawRunComplete) updates.push(payload);
  };
  const onRunComplete = () => {
    sawRunComplete = true;
  };

  socket.on('stateUpdate', onStateUpdate);
  socket.on('runComplete', onRunComplete);

  try {
    const runCompletePromise = waitForEvent(socket, 'runComplete');
    await trigger();
    await runCompletePromise;
    await new Promise((resolve) => setTimeout(resolve, 400));
    return updates;
  } finally {
    socket.off('stateUpdate', onStateUpdate);
    socket.off('runComplete', onRunComplete);
  }
}

describe('frost_crossing Tier 1 victory phase snapshots', () => {
  let tmpFile;
  let baseUrl;
  let socket;

  beforeEach(async () => {
    tmpFile = path.join(
      os.tmpdir(),
      `frost-victory-phase-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    baseUrl = await startTestServer();
    setTestProvider(new InMemoryProvider());

    users.createUser('frost_phase', 'testpass');
    const accountId = users.findUserByUsername('frost_phase').accountId;
    const connected = await connectClient(baseUrl, accountId, { name: 'Frost Phase Room' });
    socket = connected.socket;
    socket.emit('selectQuest', { questId: QUEST_ID, tier: TIER_1 });
    await waitForEvent(socket, 'questUpdate');
  });

  afterEach(async () => {
    if (socket?.connected) socket.disconnect();
    await closeServer();
    setTestProvider(null);
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('keeps gamePhase playing after checkRunTerminalState resolves victory', async () => {
    socket.emit('playerReady', true);
    await waitForEvent(socket, 'startGame');
    await waitForEvent(socket, 'stateUpdate');

    runSimulationInPrimaryLobby((state) => {
      state.run.objective.bossDefeated = true;
      state.enemies = [];
      void checkRunTerminalState();
    });

    await waitForEvent(socket, 'runComplete');

    const state = testGameState();
    expect(state.gamePhase).toBe('playing');
    expect(state.run?.status).toBe('victory');
  });

  it('does not emit lobby-phase stateUpdate payloads after runComplete until returnToLobby', async () => {
    socket.emit('playerReady', true);
    await waitForEvent(socket, 'startGame');
    await waitForEvent(socket, 'stateUpdate');

    const updates = await collectPostVictoryStateUpdates(socket, async () => {
      await runSimulationInPrimaryLobby(async (state) => {
        defeatFrostCrossingBoss(state);
        await cleanupAfterDamage();
      });
    });

    expect(updates.length).toBeGreaterThan(0);
    for (const snapshot of updates) {
      expect(snapshot.gamePhase).not.toBe('lobby');
      expect(snapshot.run?.status).toBe('victory');
      expect(snapshot.run).toBeTruthy();
    }

    const state = testGameState();
    expect(state.gamePhase).toBe('playing');
    expect(state.run?.status).toBe('victory');
  });

  it('corrects spurious lobby drift in hot snapshots while the run is terminal', async () => {
    socket.emit('playerReady', true);
    await waitForEvent(socket, 'startGame');
    await waitForEvent(socket, 'stateUpdate');

    await collectPostVictoryStateUpdates(socket, async () => {
      await runSimulationInPrimaryLobby(async (state) => {
        defeatFrostCrossingBoss(state);
        await cleanupAfterDamage();
      });
    });

    runSimulationInPrimaryLobby((state) => {
      state.gamePhase = 'lobby';
      ensureTerminalRunStaysInDungeon(state);
      const snapshot = hotStateSnapshot();
      expect(snapshot.gamePhase).toBe('playing');
      expect(snapshot.run?.status).toBe('victory');
      expect(snapshot.run).toBeTruthy();
    });
  });

  it('does not suspend a terminal victory run back to the lobby', async () => {
    socket.emit('playerReady', true);
    await waitForEvent(socket, 'startGame');
    await waitForEvent(socket, 'stateUpdate');

    await collectPostVictoryStateUpdates(socket, async () => {
      await runSimulationInPrimaryLobby(async (state) => {
        defeatFrostCrossingBoss(state);
        await cleanupAfterDamage();
      });
    });

    runSimulationInPrimaryLobby((state) => {
      suspendRunToLobby();
      maybeSuspendRun();
      expect(state.gamePhase).toBe('playing');
      expect(state.run?.status).toBe('victory');
    });
  });

  it('emits runComplete before hot snapshots expose terminal run.status', async () => {
    socket.emit('playerReady', true);
    await waitForEvent(socket, 'startGame');
    await waitForEvent(socket, 'stateUpdate');

    const ordering = { runCompleteAt: null, victorySnapshotAt: null };
    const onRunComplete = () => {
      if (ordering.runCompleteAt == null) ordering.runCompleteAt = Date.now();
    };
    const onStateUpdate = (payload) => {
      if (ordering.victorySnapshotAt == null && payload.run?.status === 'victory') {
        ordering.victorySnapshotAt = Date.now();
      }
    };

    socket.on('runComplete', onRunComplete);
    socket.on('stateUpdate', onStateUpdate);

    try {
      await runSimulationInPrimaryLobby(async (state) => {
        defeatFrostCrossingBoss(state);
        await cleanupAfterDamage();
      });
      await waitForEvent(socket, 'runComplete');
      await new Promise((resolve) => setTimeout(resolve, 400));
    } finally {
      socket.off('runComplete', onRunComplete);
      socket.off('stateUpdate', onStateUpdate);
    }

    expect(ordering.runCompleteAt).not.toBeNull();
    expect(ordering.victorySnapshotAt).not.toBeNull();
    expect(ordering.runCompleteAt).toBeLessThanOrEqual(ordering.victorySnapshotAt);
  });

  it('emits runComplete after frost-crossing-boss-low-hp boss kill', async () => {
    const prevAllowDebug = process.env.ALLOW_DEBUG_SCENARIOS;
    process.env.ALLOW_DEBUG_SCENARIOS = '1';

    try {
      socket.emit('debugScenario', { name: 'frost-crossing-tier-1' });
      await waitForEvent(socket, 'debugScenarioResult');

      socket.emit('debugScenario', { name: 'frost-crossing-boss-low-hp' });
      await waitForEvent(socket, 'debugScenarioResult');

      const runCompletePromise = waitForEvent(socket, 'runComplete');
      runSimulationInPrimaryLobby((state) => {
        const boss = bossEnemy(state);
        boss.hp = 0;
      });
      await cleanupAfterDamage();

      const summary = await runCompletePromise;
      expect(summary?.status).toBe('victory');
      expect(testGameState().run?.status).toBe('victory');
    } finally {
      if (prevAllowDebug === undefined) delete process.env.ALLOW_DEBUG_SCENARIOS;
      else process.env.ALLOW_DEBUG_SCENARIOS = prevAllowDebug;
    }
  });
});
