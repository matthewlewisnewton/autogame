import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  QUEST_DEFS,
  getQuest,
  getEncounterConfig,
  formatObjectiveSummary,
  getLayoutProfileForQuest,
  getLayoutGenerationOptions,
  getEnemyPool,
  getGuaranteedEnemyType,
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

const QUEST_ID = 'frost_crossing';
const TIER_1 = 1;
const TIER_2 = 2;
const SEED = 4242;
const ADD_COUNT = 4;
const TIER_2_POOL_TYPES = ['grunt', 'skirmisher', 'glacial_thrower', 'rime_drifter', 'field_medic'];

function runSimulationInPrimaryLobby(fn) {
  const state = testGameState();
  if (!state) throw new Error('runSimulationInPrimaryLobby: no active lobby state');
  const sim = require('../simulation');
  const progression = require('../progression');
  sim.setGameState(state, _timeouts);
  progression.setGameState(state);
  return fn(state);
}

function layoutForFrostTier(tier, seed = questLayoutSeed(QUEST_ID, tier)) {
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

function deployFrostTierStageBoss(tier, seed = SEED) {
  const sim = require('../simulation');
  const progression = require('../progression');
  const layout = layoutForFrostTier(tier, seed);
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

describe('frost_crossing Tier 2 catalog and layout', () => {
  it('exposes a Tier 2 def with glacial tyrant encounter and unlock metadata', () => {
    expect(isValidQuestSelection(QUEST_ID, TIER_2)).toBe(true);
    const tier2 = getQuest(QUEST_ID, TIER_2);
    expect(tier2).toMatchObject({
      tier: TIER_2,
      name: 'Frost Crossing — Tier II',
      objectiveType: 'stage_boss',
      layoutProfile: 'ice-cavern',
      layoutMode: 'rigid',
      unlockRequires: { questId: QUEST_ID, tier: TIER_1 },
    });
    expect(getEncounterConfig(tier2)).toEqual({
      bossType: 'glacial_tyrant',
      landmark: 'ice_cairn',
      addCount: ADD_COUNT,
    });
  });

  it('exposes Tier 2 in listQuestVariants with briefing and dialogue', () => {
    const variant = listQuestVariants().find(
      (v) => v.questId === QUEST_ID && v.tier === TIER_2
    );
    expect(variant).toMatchObject({
      questId: QUEST_ID,
      tier: TIER_2,
      isTier2: true,
      objectiveType: 'stage_boss',
      unlockRequires: { questId: QUEST_ID, tier: TIER_1 },
    });
    const tier2 = getQuest(QUEST_ID, TIER_2);
    expect(variant.client?.name).toBe(tier2.client.name);
    expect(variant.client?.briefing).toBe(tier2.client.briefing);
    expect(variant.client?.briefing).toContain('Tier II');
    expect(variant.dialogue).toEqual(tier2.dialogue);
    expect(variant.objectiveSummary).toBe(formatObjectiveSummary(tier2));
  });

  it('formats objective summaries by boss type, not by tier', () => {
    expect(formatObjectiveSummary(getQuest(QUEST_ID, TIER_2))).toBe(
      'Defeat the Glacial Tyrant and 4 supports'
    );
    expect(formatObjectiveSummary(getQuest(QUEST_ID, TIER_1))).toBe(
      'Defeat the Permafrost Warden'
    );
  });

  it('resolves ice-cavern rigid layout options for Tier 2 only', () => {
    const tier1 = getQuest(QUEST_ID, TIER_1);
    const tier2 = getQuest(QUEST_ID, TIER_2);
    expect(tier1.layoutProfile).toBe('ice-cavern');
    expect(tier1.layoutMode).toBeUndefined();
    expect(tier2.layoutProfile).toBe('ice-cavern');
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

  it('uses a tier-specific seed and stable rigid geometry for Tier 2', () => {
    expect(questLayoutSeed(QUEST_ID, TIER_1)).not.toBe(questLayoutSeed(QUEST_ID, TIER_2));
    const tier2SeedA = layoutForFrostTier(TIER_2, 1);
    const tier2SeedB = layoutForFrostTier(TIER_2, 9999);
    expect(tier2SeedA.rooms).toEqual(tier2SeedB.rooms);
    expect(tier2SeedA.landmarks).toEqual(tier2SeedB.landmarks);
  });

  it('merges the tier2EnemyPool on Tier 2 and leaves Tier 1 untouched', () => {
    expect(QUEST_DEFS[QUEST_ID].tier2EnemyPool).toEqual([
      { type: 'glacial_thrower', weight: 2 },
      { type: 'field_medic', weight: 1 },
    ]);
    expect(getEnemyPool(QUEST_ID, TIER_2)).toEqual([
      { type: 'grunt', weight: 3 },
      { type: 'skirmisher', weight: 2 },
      { type: 'glacial_thrower', weight: 2 },
      { type: 'rime_drifter', weight: 1 },
      { type: 'glacial_thrower', weight: 2 },
      { type: 'field_medic', weight: 1 },
    ]);
    expect(getEnemyPool(QUEST_ID, TIER_1)).toBe(QUEST_DEFS[QUEST_ID].enemyPool);
    expect(getGuaranteedEnemyType(QUEST_ID)).toBe('glacial_thrower');
  });
});

describe('frost_crossing Tier 2 deploy spawns', () => {
  beforeEach(() => resetGameState());

  it('spawns one dormant glacial_tyrant on the ice_cairn treasure pad plus 4 pool adds', () => {
    const layout = deployFrostTierStageBoss(TIER_2);
    const cairn = layout.landmarks.find((lm) => lm.type === 'ice_cairn');
    const boss = bossEnemy(gameState);
    const tyrants = gameState.enemies.filter((e) => e.type === 'glacial_tyrant');
    const adds = gameState.enemies.filter((e) => e.type !== 'glacial_tyrant');

    expect(cairn).toBeDefined();
    expect(roomAt(layout, cairn.x, cairn.z)?.role).toBe('treasure');
    expect(gameState.enemies).toHaveLength(1 + ADD_COUNT);
    expect(tyrants).toHaveLength(1);
    expect(boss.type).toBe('glacial_tyrant');
    expect(boss.x).toBe(cairn.x);
    expect(boss.z).toBe(cairn.z);
    expect(adds).toHaveLength(ADD_COUNT);
    for (const add of adds) {
      expect(TIER_2_POOL_TYPES).toContain(add.type);
    }
    expect(gameState.run.objective.type).toBe('stage_boss');
    expect(gameState.run.encounter.bossEnemyId).toBe(boss.id);
    expect(gameState.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(gameState.run.scriptedEncounter).toBeUndefined();
  });
});

describe('frost_crossing Tier 2 stage-boss encounter flow', () => {
  beforeEach(() => {
    resetGameState();
    deployFrostTierStageBoss(TIER_2);
  });

  it('activating the encounter starts the boss fight', () => {
    activateEncounterForTest(gameState);
    expect(gameState.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(gameState.run.encounter.locked).toBe(true);
  });

  it('recordEnemyDefeated does not complete or inflate the stage_boss objective', () => {
    const before = gameState.run.objective.defeatedEnemies;
    recordEnemyDefeated(5);
    expect(gameState.run.objective.bossDefeated).toBe(false);
    expect(gameState.run.objective.defeatedEnemies).toBe(before);
    expect(isRunObjectiveComplete(gameState.run.objective)).toBe(false);
  });

  it('defeating all adds and the boss completes the run with victory', () => {
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

describe('frost_crossing Tier 1 victory unlocks Tier 2', () => {
  let tmpFile;
  let baseUrl;
  let socket;
  let accountId;

  beforeEach(async () => {
    tmpFile = path.join(
      os.tmpdir(),
      `frost-crossing-tier2-unlock-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    baseUrl = await startTestServer();
    setTestProvider(new InMemoryProvider());

    users.createUser('frost_unlocker', 'testpass');
    accountId = users.findUserByUsername('frost_unlocker').accountId;
    const connected = await connectClient(baseUrl, accountId, { name: 'Frost Room' });
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

  it('persists Tier 2 unlock after clearing frost_crossing Tier 1', async () => {
    const startGamePromise = waitForEvent(socket, 'startGame');
    socket.emit('playerReady', true);
    await startGamePromise;
    await waitForEvent(socket, 'stateUpdate');

    const state = testGameState();
    expect(state.run.questId).toBe(QUEST_ID);
    expect(state.run.questTier ?? TIER_1).toBe(TIER_1);
    expect(state.run.objective.type).toBe('stage_boss');
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(false);

    state.enemies = [];
    state.run.objective.bossDefeated = true;

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
