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
const { enemyDefFor } = require('../simulation.js');
const { ENEMY_MS_DROPS, ENEMY_CARD_DROPS } = require('../config.js');

const QUEST_ID = 'arena_trials';
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

function deployArenaTierStageBoss(tier, seed = SEED) {
  const sim = require('../simulation');
  const progression = require('../progression');
  const layout = layoutForArenaTier(tier, seed);
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
  tryActivateEncounter(state);
}

describe('arena_champion boss type and reward', () => {
  it('defines arena_champion distinct from the generic miniboss', () => {
    const champion = enemyDefFor('arena_champion');
    const miniboss = enemyDefFor('miniboss');
    expect(champion).toBeDefined();
    expect(champion.name).toBe('Plaza Sovereign');
    expect(typeof champion.description).toBe('string');
    expect(champion.description.length).toBeGreaterThan(0);
    expect(champion.hp).toBeGreaterThan(miniboss.hp);
    expect(champion.hp).toBeGreaterThan(300);
    expect(champion.attackDamage).toBeGreaterThan(miniboss.attackDamage);
    expect(champion.attackStyle).toBeDefined();
    expect(champion.attackRange).toBeDefined();
    expect(champion.chaseSpeed).toBeDefined();
  });

  it('does not throw when resolving the arena_champion def', () => {
    expect(() => enemyDefFor('arena_champion')).not.toThrow();
  });

  it('grants a magic-stone reward strictly greater than the miniboss reward', () => {
    expect(ENEMY_MS_DROPS.arena_champion).toBeGreaterThan(ENEMY_MS_DROPS.miniboss);
    expect(ENEMY_MS_DROPS.miniboss).toBe(50);
    expect(ENEMY_CARD_DROPS.arena_champion).toBeDefined();
  });
});

describe('arena_trials Tier 2 catalog and layout', () => {
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
    expect(tier2.objectiveSummary).toContain('trial warden');
    expect(isValidQuestSelection(QUEST_ID, TIER_2)).toBe(true);
    expect(getEncounterConfig(getQuest(QUEST_ID, TIER_2))).toMatchObject({
      bossType: 'arena_champion',
      landmark: 'arena_dais',
      addCount: ADD_COUNT,
    });
  });

  it('keeps Tier 1 as defeat_enemies with unchanged enemy count', () => {
    const tier1 = getQuest(QUEST_ID, TIER_1);
    expect(tier1.objectiveType).toBe('defeat_enemies');
    expect(tier1.enemyCount).toBe(6);
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
    return layout;
  }

  it('places Tier 2 adds on walkable floor clear of cover', () => {
    const layout = deployArenaTier(TIER_2);
    const adds = gameState.enemies.filter((e) => e.type !== 'arena_champion');
    expect(adds.length).toBe(ADD_COUNT);
    expect(adds.every((e) => e.type !== 'miniboss')).toBe(true);
    for (const enemy of adds) {
      assertOnFloor(layout, enemy);
    }
  });

  it('spawns dormant arena_champion on arena_dais with encounter wiring after run open', () => {
    resetGameState();
    const layout = deployArenaTierStageBoss(TIER_2);
    const dais = layout.landmarks.find((lm) => lm.type === 'arena_dais');
    const boss = bossEnemy(gameState);

    expect(gameState.enemies).toHaveLength(1 + ADD_COUNT);
    expect(boss.type).toBe('arena_champion');
    expect(boss.x).toBe(dais.x);
    expect(boss.z).toBe(dais.z);
    expect(gameState.run.objective.type).toBe('stage_boss');
    expect(gameState.run.encounter.bossEnemyId).toBe(boss.id);
    expect(gameState.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
  });

  it('tags at least one enemy on Tier 2 under a fixed seed', () => {
    deployArenaTier(TIER_2, SEED);
    const tagged = gameState.enemies.filter((e) => e.variant).length;
    expect(tagged).toBeGreaterThan(0);
  });

  it('leaves all enemies un-tagged on Tier 1 for the same geometry', () => {
    deployArenaTier(TIER_1, SEED);
    expect(gameState.enemies.length).toBe(getQuest(QUEST_ID, TIER_1).enemyCount);
    expect(gameState.enemies.every((e) => e.variant === null)).toBe(true);
  });
});

describe('arena_trials Tier 2 stage-boss encounter flow', () => {
  beforeEach(() => {
    resetGameState();
    deployArenaTierStageBoss(TIER_2);
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
