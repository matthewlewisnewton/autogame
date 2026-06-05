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
  buildWallColliders,
  checkWallCollision,
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

const QUEST_ID = 'arena_trials';
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

function layoutForArenaTier(tier, seed = questLayoutSeed(QUEST_ID, tier)) {
  const profile = getLayoutProfileForQuest(QUEST_ID, tier);
  const options = getLayoutGenerationOptions(QUEST_ID, tier);
  return generateLayout(seed, profile, options);
}

function assertOnFloor(layout, pos) {
  const half = layout.rooms[0].width / 2;
  expect(Math.abs(pos.x)).toBeLessThanOrEqual(half);
  expect(Math.abs(pos.z)).toBeLessThanOrEqual(half);
  expect(checkWallCollision(pos.x, pos.z, buildWallColliders(layout))).toBe(false);
}

describe('arena_trials Tier 2 catalog and layout', () => {
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

  it('resolves open-plaza rigid layout options for Tier 2 only', () => {
    const tier1 = getQuest(QUEST_ID, TIER_1);
    const tier2 = getQuest(QUEST_ID, TIER_2);
    expect(tier1.layoutProfile).toBe('open-plaza');
    expect(tier1.layoutMode).toBeUndefined();
    expect(tier2.layoutProfile).toBe('open-plaza');
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

  it('Tier 2 rigid cover is stable across seeds; Tier 1 default cover varies', () => {
    const tier2SeedA = layoutForArenaTier(TIER_2, 1);
    const tier2SeedB = layoutForArenaTier(TIER_2, 9999);
    expect(tier2SeedA.cover).toEqual(tier2SeedB.cover);
    expect(tier2SeedA.hazards).toEqual(tier2SeedB.hazards);

    const tier1Ref = layoutForArenaTier(TIER_1, 1);
    let tier1Varies = false;
    for (let seed = 2; seed <= 50; seed++) {
      const other = layoutForArenaTier(TIER_1, seed);
      if (
        JSON.stringify(tier1Ref.cover) !== JSON.stringify(other.cover) ||
        JSON.stringify(tier1Ref.hazards) !== JSON.stringify(other.hazards)
      ) {
        tier1Varies = true;
        break;
      }
    }
    expect(tier1Varies).toBe(true);

    const tier1AtTier2Seed = layoutForArenaTier(TIER_1, questLayoutSeed(QUEST_ID, TIER_2));
    const tier2AtTier2Seed = layoutForArenaTier(TIER_2, questLayoutSeed(QUEST_ID, TIER_2));
    const coverDiffers =
      JSON.stringify(tier1AtTier2Seed.cover) !== JSON.stringify(tier2AtTier2Seed.cover) ||
      JSON.stringify(tier1AtTier2Seed.hazards) !== JSON.stringify(tier2AtTier2Seed.hazards);
    expect(coverDiffers).toBe(true);
  });
});

describe('arena_trials Tier 2 deploy spawns', () => {
  beforeEach(() => resetGameState());

  function deployArenaTier(tier, seed = SEED) {
    const layout = layoutForArenaTier(tier, seed);
    gameState.selectedQuestId = QUEST_ID;
    gameState.selectedQuestTier = tier;
    gameState.layout = layout;
    gameState.layoutSeed = seed;
    gameState.enemies = [];
    gameState.loot = [];
    gameState.run = { questTier: tier };
    spawnEnemies();
  }

  it('places Tier 2 enemies on walkable floor clear of cover', () => {
    deployArenaTier(TIER_2);
    expect(gameState.enemies.length).toBe(getQuest(QUEST_ID, TIER_2).enemyCount);
    for (const enemy of gameState.enemies) {
      assertOnFloor(gameState.layout, enemy);
    }
  });

  it('tags at least one enemy on Tier 2 under a fixed seed', () => {
    deployArenaTier(TIER_2, SEED);
    const tagged = gameState.enemies.filter((e) => e.variant).length;
    expect(tagged).toBeGreaterThan(0);
  });

  it('leaves all enemies un-tagged on Tier 1 for the same geometry', () => {
    deployArenaTier(TIER_1, SEED);
    expect(gameState.enemies.length).toBeGreaterThan(0);
    expect(gameState.enemies.every((e) => e.variant === null)).toBe(true);
  });
});

describe('arena_trials Tier 1 victory unlocks Tier 2', () => {
  let tmpFile;
  let baseUrl;
  let socket;
  let accountId;

  beforeEach(async () => {
    tmpFile = path.join(
      os.tmpdir(),
      `arena-trials-tier2-unlock-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    baseUrl = await startTestServer();
    setTestProvider(new InMemoryProvider());

    users.createUser('arena_unlocker', 'testpass');
    accountId = users.findUserByUsername('arena_unlocker').accountId;
    const connected = await connectClient(baseUrl, accountId, { name: 'Arena Room' });
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

  it('persists Tier 2 unlock after clearing arena_trials Tier 1', async () => {
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
