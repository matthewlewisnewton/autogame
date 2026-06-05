import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getQuest,
  getLayoutProfileForQuest,
  getLayoutGenerationOptions,
  isValidQuestSelection,
  listQuestVariants,
} from '../quests.js';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import {
  spawnEnemies,
  gameState,
  resetGameState,
  checkRunTerminalState,
  setTestProvider,
  _timeouts,
} from '../index.js';
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

const QUEST_ID = 'canyon_descent';
const TIER_1 = 1;
const TIER_2 = 2;
const SEED = 4242;

function runSimulationInPrimaryLobby(fn) {
  const state = testGameState();
  if (!state) throw new Error('runSimulationInPrimaryLobby: no active lobby state');
  const sim = require('../simulation');
  const progression = require('../progression');
  sim.setGameState(state, _timeouts);
  progression.setGameState(state);
  return fn(state);
}

function layoutForCanyonTier(tier, seed = questLayoutSeed(QUEST_ID, tier)) {
  const profile = getLayoutProfileForQuest(QUEST_ID, tier);
  const options = getLayoutGenerationOptions(QUEST_ID, tier);
  return generateLayout(seed, profile, options);
}

function roomAt(layout, x, z) {
  return layout.rooms.find((r) => {
    const hw = r.width / 2;
    const hd = r.depth / 2;
    return x >= r.x - hw && x <= r.x + hw && z >= r.z - hd && z <= r.z + hd;
  });
}

function bandAt(layout, pos) {
  const room = roomAt(layout, pos.x, pos.z);
  return room ? room.band : null;
}

function roomsByBand(layout, band) {
  return layout.rooms.filter((r) => r.band === band);
}

describe('canyon_descent Tier 2 catalog and layout', () => {
  it('exposes Tier 2 in listQuestVariants with unlock metadata', () => {
    const tier2 = listQuestVariants().find(
      (v) => v.questId === QUEST_ID && v.tier === TIER_2
    );
    expect(tier2).toMatchObject({
      questId: QUEST_ID,
      tier: TIER_2,
      isTier2: true,
      unlockRequires: { questId: QUEST_ID, tier: TIER_1 },
    });
    expect(isValidQuestSelection(QUEST_ID, TIER_2)).toBe(true);
  });

  it('resolves sunken-canyon rigid layout options for Tier 2 only', () => {
    const tier1 = getQuest(QUEST_ID, TIER_1);
    const tier2 = getQuest(QUEST_ID, TIER_2);
    expect(tier1.layoutProfile).toBe('sunken-canyon');
    expect(tier1.layoutMode).toBeUndefined();
    expect(tier2.layoutProfile).toBe('sunken-canyon');
    expect(tier2.layoutMode).toBe('rigid');
    expect(getLayoutGenerationOptions(QUEST_ID, TIER_1)).toEqual({
      slopes: true,
      layoutMode: 'default',
    });
    expect(getLayoutGenerationOptions(QUEST_ID, TIER_2)).toEqual({
      slopes: true,
      layoutMode: 'rigid',
    });
  });

  it('uses a tier-specific seed distinct from Tier 1', () => {
    expect(questLayoutSeed(QUEST_ID, TIER_1)).not.toBe(questLayoutSeed(QUEST_ID, TIER_2));
  });

  it('Tier 2 rigid canyon geometry is stable across seeds; Tier 1 default varies ramps or cover', () => {
    const tier2SeedA = layoutForCanyonTier(TIER_2, 1);
    const tier2SeedB = layoutForCanyonTier(TIER_2, 9999);
    expect(tier2SeedA.rooms).toEqual(tier2SeedB.rooms);
    expect(tier2SeedA.cover).toEqual(tier2SeedB.cover);
    expect(tier2SeedA.cliffLips).toEqual(tier2SeedB.cliffLips);
    expect(tier2SeedA.edgeHazards).toEqual(tier2SeedB.edgeHazards);
    expect(tier2SeedA.landmarks).toEqual(tier2SeedB.landmarks);

    const rampCounts = new Set();
    const coverSets = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      const layout = layoutForCanyonTier(TIER_1, seed);
      rampCounts.add(roomsByBand(layout, 'ramp').length);
      coverSets.add(JSON.stringify(layout.cover));
    }
    expect(rampCounts.size).toBeGreaterThan(1);
    expect(coverSets.size).toBeGreaterThan(1);

    const tier1AtTier2Seed = layoutForCanyonTier(TIER_1, questLayoutSeed(QUEST_ID, TIER_2));
    const tier2AtTier2Seed = layoutForCanyonTier(TIER_2, questLayoutSeed(QUEST_ID, TIER_2));
    const geometryDiffers =
      JSON.stringify(tier1AtTier2Seed.rooms) !== JSON.stringify(tier2AtTier2Seed.rooms) ||
      JSON.stringify(tier1AtTier2Seed.cover) !== JSON.stringify(tier2AtTier2Seed.cover) ||
      JSON.stringify(tier1AtTier2Seed.landmarks) !== JSON.stringify(tier2AtTier2Seed.landmarks);
    expect(geometryDiffers).toBe(true);
  });
});

describe('canyon_descent Tier 2 deploy spawns', () => {
  beforeEach(() => resetGameState());

  function deployCanyonTier(tier, seed = SEED) {
    const layout = layoutForCanyonTier(tier, seed);
    gameState.selectedQuestId = QUEST_ID;
    gameState.selectedQuestTier = tier;
    gameState.layout = layout;
    gameState.layoutSeed = seed;
    gameState.enemies = [];
    gameState.loot = [];
    gameState.run = { questTier: tier };
    spawnEnemies();
  }

  it('spawns enemyCount with plateau and canyon band distribution', () => {
    deployCanyonTier(TIER_2);
    expect(gameState.enemies.length).toBe(getQuest(QUEST_ID, TIER_2).enemyCount);
    const bands = gameState.enemies.map((e) => bandAt(gameState.layout, e));
    expect(bands.filter((b) => b === 'plateau').length).toBeGreaterThanOrEqual(1);
    expect(bands.filter((b) => b === 'canyon').length).toBeGreaterThan(gameState.enemies.length / 2);
    expect(bands.some((b) => b === 'ramp')).toBe(false);
    for (const enemy of gameState.enemies) {
      const room = roomAt(gameState.layout, enemy.x, enemy.z);
      expect(room?.role).not.toBe('connector');
      expect(room?.band).not.toBe('ramp');
    }
  });

  it('tags at least one enemy on Tier 2 under a fixed seed', () => {
    deployCanyonTier(TIER_2, SEED);
    const tagged = gameState.enemies.filter((e) => e.variant).length;
    expect(tagged).toBeGreaterThan(0);
  });

  it('leaves all enemies un-tagged on Tier 1 for the same seed', () => {
    deployCanyonTier(TIER_1, SEED);
    expect(gameState.enemies.length).toBeGreaterThan(0);
    expect(gameState.enemies.every((e) => e.variant === null)).toBe(true);
  });
});

describe('canyon_descent Tier 1 victory unlocks Tier 2', () => {
  let tmpFile;
  let baseUrl;
  let socket;
  let accountId;

  beforeEach(async () => {
    tmpFile = path.join(
      os.tmpdir(),
      `canyon-descent-tier2-unlock-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    baseUrl = await startTestServer();
    setTestProvider(new InMemoryProvider());

    users.createUser('canyon_unlocker', 'testpass');
    accountId = users.findUserByUsername('canyon_unlocker').accountId;
    const connected = await connectClient(baseUrl, accountId, { name: 'Canyon Room' });
    socket = connected.socket;
    socket.emit('selectQuest', { questId: QUEST_ID, tier: TIER_1 });
    await waitForEvent(socket, 'questUpdate');
  });

  afterEach(async () => {
    if (socket && socket.connected) socket.disconnect();
    await closeServer();
    setTestProvider(null);
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('persists Tier 2 unlock after clearing canyon_descent Tier 1', async () => {
    const startGamePromise = waitForEvent(socket, 'startGame');
    socket.emit('playerReady', true);
    await startGamePromise;
    await waitForEvent(socket, 'stateUpdate');

    const state = testGameState();
    expect(state.run.questId).toBe(QUEST_ID);
    expect(state.run.questTier ?? TIER_1).toBe(TIER_1);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(false);

    state.enemies = [];
    state.run.objective.totalEnemies = 1;
    state.run.objective.defeatedEnemies = 1;

    const runCompletePromise = waitForEvent(socket, 'runComplete');
    runSimulationInPrimaryLobby(() => checkRunTerminalState());
    const summary = await runCompletePromise;

    expect(summary.status).toBe('victory');
    expect(summary.questId).toBe(QUEST_ID);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(true);

    const onDisk = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    const record = onDisk.find((r) => r.accountId === accountId);
    expect(record.unlockedQuestTiers).toEqual({ [QUEST_ID]: [TIER_2] });
  });
});
