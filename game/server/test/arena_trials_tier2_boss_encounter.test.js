import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getQuest,
  getLayoutGenerationOptions,
  listQuestVariants,
} from '../quests.js';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import {
  gameState,
  resetGameState,
  spawnEnemies,
  startDungeonRun,
  cleanupAfterDamage,
  grantRunRewards,
  stateSnapshot,
  io as serverIo,
} from '../index.js';
import { isEncounterLocked } from '../bossEncounter.js';
import {
  startTestServer,
  closeServer,
  connectClient,
  waitForEvent,
  testGameState,
} from './helpers.js';
const require = createRequire(import.meta.url);
const users = require('../users.js');

const QUEST_ID = 'arena_trials';
const TIER_1 = 1;
const TIER_2 = 2;
const SEED = 4242;

function layoutForArenaTier(tier, seed = questLayoutSeed(QUEST_ID, tier)) {
  return generateLayout(
    seed,
    getQuest(QUEST_ID, tier).layoutProfile,
    getLayoutGenerationOptions(QUEST_ID, tier),
  );
}

function setPartySize(count) {
  Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
  for (let i = 1; i <= count; i++) {
    gameState.players[`p${i}`] = {
      x: 0,
      y: 0.5,
      z: 0,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
      currency: 0,
      accountId: `acct-${i}`,
    };
  }
}

function deployArenaTier2BossRun(seed = SEED) {
  setPartySize(1);
  gameState.selectedQuestId = QUEST_ID;
  gameState.selectedQuestTier = TIER_2;
  gameState.layout = layoutForArenaTier(TIER_2, seed);
  gameState.layoutSeed = seed;
  gameState.enemies = [];
  gameState.loot = [];
  gameState.gamePhase = 'playing';
  spawnEnemies();
  startDungeonRun();
}

function getStageBoss() {
  const bossId = gameState.run.encounter.bossEnemyId;
  return gameState.enemies.find((e) => e.id === bossId);
}

describe('arena_trials Tier 2 boss encounter catalog', () => {
  it('lists Tier 2 with stage-boss objective summary', () => {
    const tier2 = listQuestVariants().find(
      (v) => v.questId === QUEST_ID && v.tier === TIER_2,
    );
    expect(tier2.objectiveSummary).toBe('Defeat the trial warden');
    expect(getQuest(QUEST_ID, TIER_2).stageBossEncounter).toMatchObject({
      bossType: 'miniboss',
      trigger: 'deploy',
      rewardCurrencyBonus: 5,
    });
  });
});

describe('arena_trials Tier 2 boss encounter deploy and victory', () => {
  beforeEach(() => resetGameState());

  it('deploys with one active stage boss and locked ambient spawns', () => {
    deployArenaTier2BossRun();
    expect(gameState.enemies.length).toBe(1);
    expect(gameState.run.encounter.status).toBe('active');
    expect(isEncounterLocked(gameState.run)).toBe(true);
    expect(getStageBoss()?.type).toBe('miniboss');
    expect(gameState.run.objective.totalEnemies).toBe(1);
  });

  it('includes run.encounter on stateSnapshot', () => {
    deployArenaTier2BossRun();
    const snap = stateSnapshot();
    expect(snap.run.encounter).toMatchObject({
      status: 'active',
      bossType: 'miniboss',
      trigger: 'deploy',
      rewardCurrencyBonus: 5,
    });
    expect(snap.run.encounter.bossEnemyId).toBe(getStageBoss()?.id);
  });

  it('clears encounter, grants bonus currency, and completes the run on boss defeat', () => {
    deployArenaTier2BossRun();
    expect(gameState.run.rewardCurrency).toBe(15);

    const boss = getStageBoss();
    boss.hp = 0;

    const emitCalls = [];
    const originalEmit = serverIo.emit;
    serverIo.emit = (event, data) => emitCalls.push({ event, data });

    cleanupAfterDamage();

    serverIo.emit = originalEmit;

    expect(gameState.run.encounter.status).toBe('cleared');
    expect(gameState.run.rewardCurrency).toBe(20);
    expect(gameState.run.objective.defeatedEnemies).toBe(1);
    expect(gameState.run.status).toBe('victory');

    const victoryEmits = emitCalls.filter((c) => c.event === 'runComplete');
    expect(victoryEmits.length).toBe(1);
    expect(victoryEmits[0].data.status).toBe('victory');
    expect(victoryEmits[0].data.rewards.currency).toBe(20);

    grantRunRewards('p1', { status: 'victory' });
    expect(gameState.players.p1.runRewards.currency).toBe(20);
  });

  it('leaves Tier 1 deploy unchanged (mob pack, no encounter)', () => {
    gameState.selectedQuestId = QUEST_ID;
    gameState.selectedQuestTier = TIER_1;
    gameState.layout = layoutForArenaTier(TIER_1, SEED);
    gameState.layoutSeed = SEED;
    gameState.enemies = [];
    gameState.loot = [];
    gameState.gamePhase = 'playing';
    spawnEnemies();
    startDungeonRun();

    expect(gameState.run.encounter).toBeUndefined();
    expect(gameState.enemies.length).toBe(getQuest(QUEST_ID, TIER_1).enemyCount);
  });
});

describe('arena_trials Tier 2 boss encounter via debug scenario', () => {
  let baseUrl;
  let prevAllowDebug;

  beforeEach(async () => {
    prevAllowDebug = process.env.ALLOW_DEBUG_SCENARIOS;
    process.env.ALLOW_DEBUG_SCENARIOS = '1';
    baseUrl = await startTestServer();
  });

  afterEach(async () => {
    await closeServer();
    if (prevAllowDebug === undefined) {
      delete process.env.ALLOW_DEBUG_SCENARIOS;
    } else {
      process.env.ALLOW_DEBUG_SCENARIOS = prevAllowDebug;
    }
  });

  it('arena-trials-tier-2 shortcut matches normal deploy boss state', async () => {
    const { socket } = await connectClient(baseUrl);
    const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
    socket.emit('debugScenario', { name: 'arena-trials-tier-2' });
    const result = await debugResultPromise;

    expect(result.ok).toBe(true);

    const state = testGameState();
    expect(state.run.encounter?.status).toBe('active');
    expect(state.enemies.length).toBe(1);
    expect(state.enemies[0].type).toBe('miniboss');
    expect(state.run.objective.totalEnemies).toBe(1);

    socket.disconnect();
  });
});

describe('arena_trials Tier 2 boss encounter with account unlock', () => {
  let tmpFile;
  let baseUrl;
  let socket;
  let accountId;

  beforeEach(async () => {
    tmpFile = path.join(
      os.tmpdir(),
      `arena-trials-tier2-boss-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    baseUrl = await startTestServer();
  });

  afterEach(async () => {
    if (socket?.connected) socket.disconnect();
    await closeServer();
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('deploys Tier 2 boss fight when the account has the tier unlocked', async () => {
    users.createUser('arena_t2_boss', 'testpass');
    accountId = users.findUserByUsername('arena_t2_boss').accountId;
    users.unlockQuestTier(accountId, QUEST_ID, TIER_2);

    const connected = await connectClient(baseUrl, accountId, { name: 'Arena Boss Room' });
    socket = connected.socket;
    socket.emit('selectQuest', { questId: QUEST_ID, tier: TIER_2 });
    await waitForEvent(socket, 'questUpdate');

    const startGamePromise = waitForEvent(socket, 'startGame');
    socket.emit('playerReady', true);
    await startGamePromise;
    await waitForEvent(socket, 'stateUpdate');

    const state = testGameState();
    expect(state.run.questTier).toBe(TIER_2);
    expect(state.run.encounter?.status).toBe('active');
    expect(state.enemies.length).toBe(1);
    expect(state.enemies[0].type).toBe('miniboss');
  });
});
