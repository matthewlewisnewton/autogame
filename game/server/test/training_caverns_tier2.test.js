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
  ENCOUNTER_TRIGGER_RADIUS,
  tryActivateEncounter,
  isEncounterCleared,
} from '../encounters.js';
import {
  spawnEnemies,
  gameState,
  resetGameState,
  checkRunTerminalState,
  buildWallColliders,
  checkWallCollision,
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

const QUEST_ID = 'training_caverns';
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

function layoutForTrainingTier(tier, seed = questLayoutSeed(QUEST_ID, tier)) {
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

function overlapsCover(layout, pos) {
  return layout.cover.some(
    (c) =>
      pos.x >= c.x - c.width / 2 &&
      pos.x <= c.x + c.width / 2 &&
      pos.z >= c.z - c.depth / 2 &&
      pos.z <= c.z + c.depth / 2
  );
}

function assertCombatSpawnOnFloor(layout, pos) {
  expect(checkWallCollision(pos.x, pos.z, buildWallColliders(layout))).toBe(false);
  expect(overlapsCover(layout, pos)).toBe(false);
  const room = roomAt(layout, pos.x, pos.z);
  expect(room?.role).toBe('combat');
}

function deployTrainingTierStageBoss(tier, seed = SEED) {
  const sim = require('../simulation');
  const progression = require('../progression');
  const layout = layoutForTrainingTier(tier, seed);
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
  for (const enemy of state.enemies) {
    if (enemy.id !== bossId) enemy.hp = 0;
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  const anchor = state.run.encounter.spawnAnchor;
  const player = Object.values(state.players)[0];
  if (anchor && player) {
    player.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    player.z = anchor.z;
  }
  tryActivateEncounter(state);
}

describe('training_caverns Tier 2 catalog and layout', () => {
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
    expect(tier2.objectiveSummary).toContain('annex overseer');
    expect(isValidQuestSelection(QUEST_ID, TIER_2)).toBe(true);
    expect(getEncounterConfig(getQuest(QUEST_ID, TIER_2))).toMatchObject({
      bossType: 'annex_overseer',
      landmark: 'vault_dais',
      addCount: ADD_COUNT,
    });
  });

  it('keeps Tier 1 as scripted defeat_enemies without bulk enemyCount', () => {
    const tier1 = getQuest(QUEST_ID, TIER_1);
    expect(tier1.objectiveType).toBe('defeat_enemies');
    expect(tier1.enemyCount).toBeUndefined();
    expect(tier1.scriptedEncounters).toBeDefined();
  });

  it('resolves crowded rigid layout options for Tier 2 only', () => {
    const tier1 = getQuest(QUEST_ID, TIER_1);
    const tier2 = getQuest(QUEST_ID, TIER_2);
    expect(tier1.layoutProfile).toBe('crowded');
    expect(tier1.layoutMode).toBeUndefined();
    expect(tier2.layoutProfile).toBe('crowded');
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

  it('Tier 2 rigid crowded geometry is stable across seeds; Tier 1 default cover varies', () => {
    const tier2SeedA = layoutForTrainingTier(TIER_2, 1);
    const tier2SeedB = layoutForTrainingTier(TIER_2, 9999);
    expect(tier2SeedA.rooms).toEqual(tier2SeedB.rooms);
    expect(tier2SeedA.cover).toEqual(tier2SeedB.cover);
    expect(tier2SeedA.landmarks).toEqual(tier2SeedB.landmarks);

    const tier1Ref = layoutForTrainingTier(TIER_1, 1);
    let tier1Varies = false;
    for (let seed = 2; seed <= 50; seed++) {
      const other = layoutForTrainingTier(TIER_1, seed);
      if (JSON.stringify(tier1Ref.cover) !== JSON.stringify(other.cover)) {
        tier1Varies = true;
        break;
      }
    }
    expect(tier1Varies).toBe(true);

    const tier1AtTier2Seed = layoutForTrainingTier(TIER_1, questLayoutSeed(QUEST_ID, TIER_2));
    const tier2AtTier2Seed = layoutForTrainingTier(TIER_2, questLayoutSeed(QUEST_ID, TIER_2));
    const geometryDiffers =
      JSON.stringify(tier1AtTier2Seed.rooms) !== JSON.stringify(tier2AtTier2Seed.rooms) ||
      JSON.stringify(tier1AtTier2Seed.cover) !== JSON.stringify(tier2AtTier2Seed.cover) ||
      JSON.stringify(tier1AtTier2Seed.landmarks) !== JSON.stringify(tier2AtTier2Seed.landmarks);
    expect(geometryDiffers).toBe(true);
  });
});

describe('training_caverns Tier 2 deploy spawns', () => {
  beforeEach(() => resetGameState());

  function deployTrainingTier(tier, seed = SEED) {
    const layout = layoutForTrainingTier(tier, seed);
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

  it('places Tier 2 adds on walkable floor in combat rooms clear of cover', () => {
    const layout = deployTrainingTier(TIER_2, 123);
    const adds = gameState.enemies.filter((e) => e.type !== 'annex_overseer');
    expect(adds.length).toBe(ADD_COUNT);
    for (const enemy of adds) {
      assertCombatSpawnOnFloor(layout, enemy);
    }
  });

  it('spawns dormant annex_overseer on vault_dais with encounter wiring after run open', () => {
    resetGameState();
    const layout = deployTrainingTierStageBoss(TIER_2);
    const dais = layout.landmarks.find((lm) => lm.type === 'vault_dais');
    const boss = bossEnemy(gameState);

    expect(gameState.enemies).toHaveLength(1 + ADD_COUNT);
    expect(boss.type).toBe('annex_overseer');
    expect(boss.x).toBe(dais.x);
    expect(boss.z).toBe(dais.z);
    expect(gameState.run.objective.type).toBe('stage_boss');
    expect(gameState.run.encounter.bossEnemyId).toBe(boss.id);
    expect(gameState.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
  });

  it('tags at least one enemy on Tier 2 under a fixed seed', () => {
    deployTrainingTier(TIER_2, SEED);
    const tagged = gameState.enemies.filter((e) => e.variant).length;
    expect(tagged).toBeGreaterThan(0);
  });

  it('spawns scripted wave-0 grunts on Tier 1 without variant tags', () => {
    deployTrainingTier(TIER_1, SEED);
    startDungeonRun();
    expect(gameState.enemies.length).toBe(2);
    expect(gameState.enemies.every((e) => e.variant === null)).toBe(true);
  });
});

describe('training_caverns Tier 2 stage-boss encounter flow', () => {
  beforeEach(() => {
    resetGameState();
    deployTrainingTierStageBoss(TIER_2);
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

describe('training_caverns Tier 1 victory unlocks Tier 2', () => {
  let tmpFile;
  let baseUrl;
  let socket;
  let accountId;

  beforeEach(async () => {
    tmpFile = path.join(
      os.tmpdir(),
      `training-caverns-tier2-unlock-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    baseUrl = await startTestServer();
    setTestProvider(new InMemoryProvider());

    users.createUser('training_unlocker', 'testpass');
    accountId = users.findUserByUsername('training_unlocker').accountId;
    const connected = await connectClient(baseUrl, accountId, { name: 'Training Room' });
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

  it('persists Tier 2 unlock after clearing training_caverns Tier 1', async () => {
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
