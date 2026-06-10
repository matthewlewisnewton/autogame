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

const QUEST_ID = 'crystal_rescue';
const TIER_1 = 1;
const TIER_2 = 2;
const SEED = 4242;

function runSimulationInPrimaryLobby(fn) {
  const state = testGameState();
  if (!state) throw new Error('runSimulationInPrimaryLobby: no active lobby state');
  const sim = require('../simulation');
  const progression = require('../progression');
  sim.setGameState(state, _timeouts);
  return fn(state);
}

function layoutForCrystalTier(tier, seed = questLayoutSeed(QUEST_ID, tier)) {
  const profile = getLayoutProfileForQuest(QUEST_ID, tier);
  const options = getLayoutGenerationOptions(QUEST_ID, tier);
  return generateLayout(seed, profile, options);
}

function overlapsBox(layout, pos, items, pad = 0) {
  return items.some(
    (item) =>
      pos.x >= item.x - item.width / 2 - pad &&
      pos.x <= item.x + item.width / 2 + pad &&
      pos.z >= item.z - item.depth / 2 - pad &&
      pos.z <= item.z + item.depth / 2 + pad
  );
}

function overlapsCover(layout, pos) {
  return overlapsBox(layout, pos, layout.cover);
}

function overlapsPlatform(layout, pos) {
  return overlapsBox(layout, pos, layout.platforms);
}

function overlapsHazard(layout, pos) {
  return overlapsBox(layout, pos, layout.hazards);
}

function assertSpawnOnWalkableFloor(layout, pos) {
  expect(checkWallCollision(pos.x, pos.z, buildWallColliders(layout))).toBe(false);
  expect(overlapsCover(layout, pos)).toBe(false);
  expect(overlapsPlatform(layout, pos)).toBe(false);
  expect(overlapsHazard(layout, pos)).toBe(false);
}

describe('crystal_rescue Tier 2 catalog and layout', () => {
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

  it('resolves open rigid layout options for Tier 2 only', () => {
    const tier1 = getQuest(QUEST_ID, TIER_1);
    const tier2 = getQuest(QUEST_ID, TIER_2);
    expect(tier1.layoutProfile).toBe('open');
    expect(tier1.layoutMode).toBeUndefined();
    expect(tier2.layoutProfile).toBe('open');
    expect(tier2.layoutMode).toBe('rigid');
    expect(tier2.itemCount).toBeGreaterThan(tier1.itemCount);
    expect(tier2.enemyCount).toBeGreaterThan(tier1.enemyCount);
    expect(tier2.rewardCurrency).toBeGreaterThan(tier1.rewardCurrency);
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

  it('Tier 2 rigid open geometry is stable across seeds; Tier 1 default dressing varies', () => {
    const tier2SeedA = layoutForCrystalTier(TIER_2, 1);
    const tier2SeedB = layoutForCrystalTier(TIER_2, 9999);
    expect(tier2SeedA.rooms).toEqual(tier2SeedB.rooms);
    expect(tier2SeedA.platforms).toEqual(tier2SeedB.platforms);
    expect(tier2SeedA.hazards).toEqual(tier2SeedB.hazards);
    expect(tier2SeedA.cover).toEqual(tier2SeedB.cover);
    expect(tier2SeedA.landmarks).toEqual(tier2SeedB.landmarks);

    const tier1Ref = layoutForCrystalTier(TIER_1, 1);
    let tier1Varies = false;
    for (let seed = 2; seed <= 50; seed++) {
      const other = layoutForCrystalTier(TIER_1, seed);
      if (
        JSON.stringify(tier1Ref.cover) !== JSON.stringify(other.cover) ||
        JSON.stringify(tier1Ref.hazards) !== JSON.stringify(other.hazards)
      ) {
        tier1Varies = true;
        break;
      }
    }
    expect(tier1Varies).toBe(true);

    const tier1AtTier2Seed = layoutForCrystalTier(TIER_1, questLayoutSeed(QUEST_ID, TIER_2));
    const tier2AtTier2Seed = layoutForCrystalTier(TIER_2, questLayoutSeed(QUEST_ID, TIER_2));
    const geometryDiffers =
      JSON.stringify(tier1AtTier2Seed.rooms) !== JSON.stringify(tier2AtTier2Seed.rooms) ||
      JSON.stringify(tier1AtTier2Seed.cover) !== JSON.stringify(tier2AtTier2Seed.cover) ||
      JSON.stringify(tier1AtTier2Seed.hazards) !== JSON.stringify(tier2AtTier2Seed.hazards) ||
      JSON.stringify(tier1AtTier2Seed.platforms) !== JSON.stringify(tier2AtTier2Seed.platforms) ||
      JSON.stringify(tier1AtTier2Seed.landmarks) !== JSON.stringify(tier2AtTier2Seed.landmarks);
    expect(geometryDiffers).toBe(true);
  });
});

describe('crystal_rescue Tier 2 deploy spawns', () => {
  beforeEach(() => resetGameState());

  function deployCrystalTier(tier, seed = SEED) {
    const layout = layoutForCrystalTier(tier, seed);
    gameState.selectedQuestId = QUEST_ID;
    gameState.selectedQuestTier = tier;
    gameState.layout = layout;
    gameState.layoutSeed = seed;
    gameState.enemies = [];
    gameState.loot = [];
    gameState.run = { questTier: tier };
    spawnEnemies(gameState);
  }

  it('places Tier 2 enemies and prisms on walkable floor clear of cover/platforms/hazards', () => {
    deployCrystalTier(TIER_2);
    const tier2Quest = getQuest(QUEST_ID, TIER_2);
    expect(gameState.enemies.length).toBe(tier2Quest.enemyCount);
    const crystals = gameState.loot.filter((l) => l.kind === 'crystal');
    expect(crystals.length).toBe(tier2Quest.itemCount);
    for (const enemy of gameState.enemies) {
      assertSpawnOnWalkableFloor(gameState.layout, enemy);
    }
    for (const crystal of crystals) {
      assertSpawnOnWalkableFloor(gameState.layout, crystal);
    }
  });

  it('tags at least one enemy on Tier 2 under a fixed seed', () => {
    deployCrystalTier(TIER_2, SEED);
    const tagged = gameState.enemies.filter((e) => e.variant).length;
    expect(tagged).toBeGreaterThan(0);
  });

  it('leaves all enemies un-tagged on Tier 1 for the same seed', () => {
    deployCrystalTier(TIER_1, SEED);
    expect(gameState.enemies.length).toBeGreaterThan(0);
    expect(gameState.enemies.every((e) => e.variant === null)).toBe(true);
  });
});

describe('crystal_rescue Tier 1 victory unlocks Tier 2', () => {
  let tmpFile;
  let baseUrl;
  let socket;
  let accountId;

  beforeEach(async () => {
    tmpFile = path.join(
      os.tmpdir(),
      `crystal-rescue-tier2-unlock-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    baseUrl = await startTestServer();
    setTestProvider(new InMemoryProvider());

    users.createUser('crystal_unlocker', 'testpass');
    accountId = users.findUserByUsername('crystal_unlocker').accountId;
    const connected = await connectClient(baseUrl, accountId, { name: 'Crystal Room' });
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

  it('persists Tier 2 unlock after clearing crystal_rescue Tier 1', async () => {
    const startGamePromise = waitForEvent(socket, 'startGame');
    socket.emit('playerReady', true);
    await startGamePromise;
    await waitForEvent(socket, 'stateUpdate');

    const state = testGameState();
    expect(state.run.questId).toBe(QUEST_ID);
    expect(state.run.questTier ?? TIER_1).toBe(TIER_1);
    expect(state.run.objective.type).toBe('collect_items');
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(false);

    state.run.objective.collectedItems = state.run.objective.totalItems;

    const runCompletePromise = waitForEvent(socket, 'runComplete');
    runSimulationInPrimaryLobby(() => checkRunTerminalState(gameState));
    const summary = await runCompletePromise;

    expect(summary.status).toBe('victory');
    expect(summary.questId).toBe(QUEST_ID);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(true);

    const onDisk = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    const record = onDisk.find((r) => r.accountId === accountId);
    expect(record.unlockedQuestTiers).toEqual({ [QUEST_ID]: [TIER_2] });
  });
});
