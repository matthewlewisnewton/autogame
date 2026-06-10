import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getQuest,
  getEncounterConfig,
  formatObjectiveSummary,
  getLayoutProfileForQuest,
  getLayoutGenerationOptions,
  isValidQuestSelection,
  listQuestVariants,
} from '../quests.js';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import {
  ENCOUNTER_PHASES,
  tryActivateEncounter,
  isEncounterCleared,
} from '../encounters.js';
import {
  spawnEnemies,
  gameState,
  resetGameState,
  checkRunTerminalState,
  setTestProvider,
  _timeouts,
  startDungeonRun,
  removeDeadEnemies,
  cleanupAfterDamage,
  recordEnemyDefeated,
  isRunObjectiveComplete,
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

const QUEST_ID = 'ember_descent';
const TIER_1 = 1;
const TIER_2 = 2;
const SEED = 4242;
const ADD_COUNT = 4;

function runSimulationInPrimaryLobby(fn) {
  const state = testGameState();
  if (!state) throw new Error('runSimulationInPrimaryLobby: no active lobby state');
  const sim = require('../simulation');
  const progression = require('../progression');
  sim.setGameState(state, _timeouts);
  progression.setGameState(state);
  return fn(state);
}

function layoutForEmberTier(tier, seed = questLayoutSeed(QUEST_ID, tier)) {
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

function deployEmberTierStageBoss(tier, seed = SEED) {
  const sim = require('../simulation');
  const progression = require('../progression');
  const layout = layoutForEmberTier(tier, seed);
  gameState.selectedQuestId = QUEST_ID;
  gameState.selectedQuestTier = tier;
  gameState.layout = layout;
  gameState.layoutSeed = seed;
  gameState.enemies = [];
  gameState.loot = [];
  gameState.gamePhase = 'playing';
  gameState.players = gameState.players || {};
  if (Object.keys(gameState.players).length === 0) {
    gameState.players.p1 = {
      x: 0,
      y: 0.5,
      z: 0,
      hp: 100,
      dead: false,
      extracted: false,
      accountId: 'test',
    };
  }
  progression.setGameState(gameState);
  sim.setGameState(gameState);
  spawnEnemies();
  startDungeonRun();
  return layout;
}

function bossEnemy(state) {
  return state.enemies.find((e) => e.id === state.run.encounter.bossEnemyId);
}

function activateEncounterForTest(state) {
  const bossId = state.run.encounter.bossEnemyId;
  const boss = state.enemies.find((e) => e.id === bossId);
  for (const enemy of state.enemies) {
    if (enemy.id !== bossId) enemy.hp = 0;
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  const player = Object.values(state.players)[0];
  player.x = boss.x;
  player.z = boss.z;
  tryActivateEncounter(state);
}

describe('ember_descent Tier 2 catalog and layout', () => {
  it('exposes Tier 2 in listQuestVariants with unlock metadata and stage-boss objective', () => {
    const tier2 = listQuestVariants().find(
      (v) => v.questId === QUEST_ID && v.tier === TIER_2
    );
    expect(tier2).toMatchObject({
      questId: QUEST_ID,
      tier: TIER_2,
      isTier2: true,
      objectiveType: 'stage_boss',
      unlockRequires: { questId: QUEST_ID, tier: TIER_1 },
    });
    expect(tier2.objectiveSummary).toBe(formatObjectiveSummary(getQuest(QUEST_ID, TIER_2)));
    expect(tier2.objectiveSummary.toLowerCase()).toContain('magma colossus');
    expect(isValidQuestSelection(QUEST_ID, TIER_2)).toBe(true);
    expect(getEncounterConfig(getQuest(QUEST_ID, TIER_2))).toMatchObject({
      bossType: 'magma_colossus',
      addCount: ADD_COUNT,
    });
  });

  it('keeps Tier 1 as defeat_enemies with unchanged enemy count', () => {
    const tier1 = getQuest(QUEST_ID, TIER_1);
    expect(tier1.objectiveType).toBe('defeat_enemies');
    expect(tier1.enemyCount).toBe(6);
  });

  it('resolves fire-cavern rigid layout options for Tier 2 only', () => {
    const tier1 = getQuest(QUEST_ID, TIER_1);
    const tier2 = getQuest(QUEST_ID, TIER_2);
    expect(tier1.layoutProfile).toBe('fire-cavern');
    expect(tier1.layoutMode).toBeUndefined();
    expect(tier2.layoutProfile).toBe('fire-cavern');
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

  it('Tier 2 rigid fire-cavern geometry is stable across seeds; Tier 1 default varies ramp count', () => {
    const tier2SeedA = layoutForEmberTier(TIER_2, 1);
    const tier2SeedB = layoutForEmberTier(TIER_2, 9999);
    expect(tier2SeedA.rooms).toEqual(tier2SeedB.rooms);
    expect(tier2SeedA.cover).toEqual(tier2SeedB.cover);
    expect(tier2SeedA.entryDecor).toEqual(tier2SeedB.entryDecor);

    const rampCounts = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      const layout = layoutForEmberTier(TIER_1, seed);
      rampCounts.add(layout.rooms.filter((r) => r.band === 'ramp').length);
    }
    expect(rampCounts.size).toBeGreaterThan(1);

    const tier1AtTier2Seed = layoutForEmberTier(TIER_1, questLayoutSeed(QUEST_ID, TIER_2));
    const tier2AtTier2Seed = layoutForEmberTier(TIER_2, questLayoutSeed(QUEST_ID, TIER_2));
    const geometryDiffers =
      JSON.stringify(tier1AtTier2Seed.rooms) !== JSON.stringify(tier2AtTier2Seed.rooms) ||
      JSON.stringify(tier1AtTier2Seed.cover) !== JSON.stringify(tier2AtTier2Seed.cover) ||
      JSON.stringify(tier1AtTier2Seed.entryDecor) !== JSON.stringify(tier2AtTier2Seed.entryDecor);
    expect(geometryDiffers).toBe(true);
  });
});

describe('ember_descent Tier 2 deploy spawns', () => {
  beforeEach(() => resetGameState());

  function deployEmberTier(tier, seed = SEED) {
    const layout = layoutForEmberTier(tier, seed);
    gameState.selectedQuestId = QUEST_ID;
    gameState.selectedQuestTier = tier;
    gameState.layout = layout;
    gameState.layoutSeed = seed;
    gameState.enemies = [];
    gameState.loot = [];
    gameState.run = { questTier: tier };
    spawnEnemies();
    return layout;
  }

  it('spawns dormant magma_colossus with exactly addCount support adds on Tier 2', () => {
    resetGameState();
    deployEmberTierStageBoss(TIER_2);
    const boss = bossEnemy(gameState);
    const adds = gameState.enemies.filter((e) => e.type !== 'magma_colossus');

    expect(gameState.enemies).toHaveLength(1 + ADD_COUNT);
    expect(boss.type).toBe('magma_colossus');
    expect(adds).toHaveLength(ADD_COUNT);
    expect(gameState.run.objective.type).toBe('stage_boss');
    expect(gameState.run.encounter.bossEnemyId).toBe(boss.id);
    expect(gameState.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
  });

  it('can roll field_medic into support adds under a fixed seed', () => {
    let sawMedic = false;
    for (const seed of [SEED, 1, 7, 42, 123, 256, 777, 2026]) {
      resetGameState();
      deployEmberTier(TIER_2, seed);
      if (gameState.enemies.some((e) => e.type === 'field_medic')) {
        sawMedic = true;
        break;
      }
    }
    expect(sawMedic).toBe(true);
  });

  it('tags at least one enemy on Tier 2 under a fixed seed', () => {
    deployEmberTier(TIER_2, SEED);
    const tagged = gameState.enemies.filter((e) => e.variant).length;
    expect(tagged).toBeGreaterThan(0);
    expect(gameState.enemies.filter((e) => e.type === 'magma_colossus')).toHaveLength(1);
  });

  it('leaves scripted Tier 1 enemies un-tagged on deploy', () => {
    resetGameState();
    const layout = layoutForEmberTier(TIER_1, SEED);
    gameState.selectedQuestId = QUEST_ID;
    gameState.selectedQuestTier = TIER_1;
    gameState.layout = layout;
    gameState.layoutSeed = SEED;
    gameState.enemies = [];
    gameState.loot = [];
    gameState.gamePhase = 'playing';
    gameState.players = {
      p1: {
        x: 0,
        y: 0.5,
        z: 0,
        hp: 100,
        dead: false,
        extracted: false,
        accountId: 'test',
      },
    };
    const progression = require('../progression');
    const sim = require('../simulation');
    progression.setGameState(gameState);
    sim.setGameState(gameState);
    spawnEnemies();
    startDungeonRun();
    expect(gameState.enemies.length).toBeGreaterThan(0);
    expect(gameState.enemies.every((e) => e.variant === null)).toBe(true);
  });
});

describe('ember_descent Tier 2 stage-boss encounter flow', () => {
  beforeEach(() => {
    resetGameState();
    deployEmberTierStageBoss(TIER_2);
  });

  it('activating the encounter starts the boss fight', () => {
    activateEncounterForTest(gameState);
    expect(gameState.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(gameState.run.encounter.locked).toBe(true);
  });

  it('recordEnemyDefeated does not complete the stage_boss objective', () => {
    const before = { ...gameState.run.objective };
    recordEnemyDefeated(5);
    expect(gameState.run.objective.bossDefeated).toBe(false);
    expect(gameState.run.objective.defeatedEnemies).toBeGreaterThan(before.defeatedEnemies);
    expect(isRunObjectiveComplete(gameState.run.objective)).toBe(false);
  });

  it('defeating the boss while active completes the run with victory', () => {
    activateEncounterForTest(gameState);
    bossEnemy(gameState).hp = 0;
    removeDeadEnemies();
    expect(isEncounterCleared(gameState.run)).toBe(true);
    expect(gameState.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(gameState.run.objective)).toBe(true);

    cleanupAfterDamage();
    checkRunTerminalState();
    expect(gameState.run.status).toBe('victory');
  });
});

describe('ember_descent Tier 1 victory unlocks Tier 2', () => {
  let tmpFile;
  let baseUrl;
  let socket;
  let accountId;

  beforeEach(async () => {
    tmpFile = path.join(
      os.tmpdir(),
      `ember-descent-tier2-unlock-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    baseUrl = await startTestServer();
    setTestProvider(new InMemoryProvider());

    users.createUser('ember_unlocker', 'testpass');
    accountId = users.findUserByUsername('ember_unlocker').accountId;
    const connected = await connectClient(baseUrl, accountId, { name: 'Ember Room' });
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

  it('persists Tier 2 unlock after clearing ember_descent Tier 1', async () => {
    const startGamePromise = waitForEvent(socket, 'startGame');
    socket.emit('playerReady', true);
    await startGamePromise;
    await waitForEvent(socket, 'stateUpdate');

    const state = testGameState();
    expect(state.run.questId).toBe(QUEST_ID);
    expect(state.run.questTier ?? TIER_1).toBe(TIER_1);
    expect(state.run.objective.type).toBe('defeat_enemies');
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
