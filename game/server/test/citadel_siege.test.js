import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  ENCOUNTER_PHASES,
  ENCOUNTER_TRIGGER_RADIUS,
  tryActivateEncounter,
  isEncounterCleared,
} from '../encounters.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  cleanupAfterDamage,
  checkRunTerminalState,
  isRunObjectiveComplete,
} from '../progression.js';
import {
  getQuest,
  getEncounterConfig,
  formatObjectiveSummary,
  listQuests,
  getLayoutProfileForQuest,
  isBossLevelQuest,
  normalizeUnlockRequires,
  buildLevelUnlockGraph,
} from '../quests.js';
import {
  startTestServer,
  closeServer,
  connectClient,
  waitForEvent,
  testGameState,
} from './helpers.js';
import { setTestProvider } from '../index.js';
import { InMemoryProvider } from '../providers.js';

const require = createRequire(import.meta.url);
const users = require('../users.js');
const { enemyDefFor } = require('../simulation.js');

const QUEST_ID = 'citadel_siege';
const TIER = 1;
const SEED = 38702;
const ADD_COUNT = 6;
const UNLOCK_REQUIRES = [
  { questId: 'canyon_descent', tier: 2 },
  { questId: 'spire_ascent', tier: 2 },
  { questId: 'arena_trials', tier: 2 },
];
const TIER_II_BENCHMARKS = [
  { questId: 'spire_ascent', tier: 2 },
  { questId: 'arena_trials', tier: 2 },
  { questId: 'frost_crossing', tier: 2 },
];

function nodeFor(graph, questId, tier) {
  return graph.nodes.find((n) => n.questId === questId && n.tier === tier);
}

function bossArenaLayout(seed = SEED) {
  return generateLayout(seed, 'boss-arena');
}

function setPartySize(state, count, position = { x: -20, z: 0 }) {
  Object.keys(state.players).forEach((k) => delete state.players[k]);
  for (let i = 1; i <= count; i++) {
    state.players[`p${i}`] = {
      x: position.x + i,
      y: 0.5,
      z: position.z,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
      accountId: `acct-${i}`,
    };
  }
}

function deployQuestRun(state, { questId, tier, seed = SEED, partySize = 1, playerPosition } = {}) {
  setPartySize(state, partySize, playerPosition ?? { x: -20, z: 0 });
  state.selectedQuestId = questId;
  state.selectedQuestTier = tier;
  const profile = getLayoutProfileForQuest(questId, tier);
  state.layout = generateLayout(seed, profile);
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.gamePhase = 'playing';
  setGameState(state);
  const { setGameState: setSimulationGameState } = require('../simulation.js');
  setSimulationGameState(state);
  spawnEnemies();
  startDungeonRun();
  return state;
}

function deployCitadelSiegeRun(state, options = {}) {
  return deployQuestRun(state, { questId: QUEST_ID, tier: TIER, ...options });
}

function measureDeployedEncounterPressure(questId, tier, seed = SEED) {
  const state = createGameState();
  deployQuestRun(state, { questId, tier, seed });
  let totalHp = 0;
  let totalAttackDamage = 0;
  for (const enemy of state.enemies) {
    const def = enemyDefFor(enemy.type);
    totalHp += def.hp;
    totalAttackDamage += def.attackDamage;
  }
  return {
    totalHp,
    totalAttackDamage,
    enemyCount: state.enemies.length,
  };
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
  if (anchor && state.players.p1) {
    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;
  }
  tryActivateEncounter(state);
}

function completeAllTier2Prereqs(accountId) {
  users.completeQuestTier(accountId, 'canyon_descent', 2);
  users.completeQuestTier(accountId, 'spire_ascent', 2);
  users.completeQuestTier(accountId, 'arena_trials', 2);
}

describe('citadel_siege catalog', () => {
  it('exposes boss-level metadata on listQuests and formatObjectiveSummary', () => {
    const quest = getQuest(QUEST_ID, TIER);
    expect(quest.levelKind).toBe('boss_level');
    expect(quest.layoutProfile).toBe('boss-arena');
    expect(quest.objectiveType).toBe('stage_boss');
    expect(isBossLevelQuest(quest)).toBe(true);
    expect(getLayoutProfileForQuest(QUEST_ID, TIER)).toBe('boss-arena');
    expect(getEncounterConfig(quest)).toMatchObject({
      bossType: 'citadel_sovereign',
      landmark: 'arena_dais',
      addCount: ADD_COUNT,
    });
    expect(quest.encounter.addCount).toBeGreaterThan(0);
    expect(quest.encounter.addCount).toBeGreaterThan(4);
    expect(quest.unlockRequires).toEqual(UNLOCK_REQUIRES);
    expect(normalizeUnlockRequires(quest.unlockRequires)).toEqual(UNLOCK_REQUIRES);

    const summary = formatObjectiveSummary(quest);
    expect(summary).toBe('Defeat Citadel Sovereign and 6 supports');
    expect(summary).not.toContain('hostiles');
    expect(quest.description).toMatch(/supports/i);
    expect(quest.client.briefing).toMatch(/supports/i);
    expect(quest.dialogue.find((entry) => entry.trigger === 'run_start')?.text).toMatch(/supports/i);

    const boardRow = listQuests().find((entry) => entry.id === QUEST_ID);
    expect(boardRow?.objectiveSummary).toBe(summary);
    expect(boardRow?.signatureCardId).toBe('gravity_well');
    expect(boardRow?.rewardCurrency).toBeGreaterThanOrEqual(20);
  });

  it('emits a locked citadel_siege:1 node with triple unlockRequires on the level map', () => {
    const graph = buildLevelUnlockGraph('not-a-real-account');
    const node = nodeFor(graph, QUEST_ID, TIER);
    expect(node.isBoss).toBe(true);
    expect(node.unlockRequires).toEqual(UNLOCK_REQUIRES);
    expect(node.state).toBe('locked');
  });
});

describe('citadel_siege deploy and encounter flow', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
  });

  it('spawns a dormant citadel_sovereign with support adds wired to the arena dais', () => {
    deployCitadelSiegeRun(state);
    const dais = state.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    const boss = bossEnemy(state);

    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.run.objective.addCount).toBe(ADD_COUNT);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.run.encounter.bossEnemyId).toBeTruthy();
    expect(state.enemies).toHaveLength(1 + ADD_COUNT);
    expect(boss.type).toBe('citadel_sovereign');
    expect(boss.x).toBe(dais.x);
    expect(boss.z).toBe(dais.z);
    expect(enemyDefFor('citadel_sovereign').name).toBe('Citadel Sovereign');
    expect(enemyDefFor('citadel_sovereign').hp).toBe(420);
  });

  it('citadel_siege exceeds Tier-II prerequisite encounter pressure', () => {
    const capstone = measureDeployedEncounterPressure(QUEST_ID, TIER, SEED);
    expect(capstone.enemyCount).toBe(1 + ADD_COUNT);

    for (const benchmark of TIER_II_BENCHMARKS) {
      const reference = measureDeployedEncounterPressure(
        benchmark.questId,
        benchmark.tier,
        SEED,
      );
      expect(capstone.totalHp).toBeGreaterThan(reference.totalHp);
      expect(capstone.totalAttackDamage).toBeGreaterThan(reference.totalAttackDamage);
    }
  });

  it('activates the encounter when a player enters the trigger radius', () => {
    deployCitadelSiegeRun(state);
    activateEncounterForTest(state);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(state.run.encounter.locked).toBe(true);
  });

  it('completes with victory when the active boss is defeated', () => {
    deployCitadelSiegeRun(state);
    activateEncounterForTest(state);
    bossEnemy(state).hp = 0;
    removeDeadEnemies();

    expect(isEncounterCleared(state.run)).toBe(true);
    expect(state.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);

    cleanupAfterDamage();
    checkRunTerminalState();
    expect(state.run.status).toBe('victory');
  });
});

describe('citadel_siege triple-prereq gating', () => {
  let tmpFile;
  let accountId;

  beforeEach(() => {
    tmpFile = path.join(
      os.tmpdir(),
      `citadel-siege-unlock-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    users.createUser('citadel_runner', 'testpass');
    accountId = users.findUserByUsername('citadel_runner').accountId;
  });

  afterEach(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('returns false when only one or two Tier-II prereqs are completed', () => {
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(false);

    users.completeQuestTier(accountId, 'canyon_descent', 2);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(false);

    users.completeQuestTier(accountId, 'spire_ascent', 2);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(false);
  });

  it('returns true only when all three Tier-II prereqs are completed', () => {
    completeAllTier2Prereqs(accountId);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(true);
  });
});

describe('citadel_siege socket selectQuest gating', () => {
  let tmpFile;
  let baseUrl;
  let socket;
  let accountId;

  beforeEach(async () => {
    tmpFile = path.join(
      os.tmpdir(),
      `citadel-siege-socket-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    baseUrl = await startTestServer();
    setTestProvider(new InMemoryProvider());

    users.createUser('citadel_socket', 'testpass');
    accountId = users.findUserByUsername('citadel_socket').accountId;
    const connected = await connectClient(baseUrl, accountId, { name: 'Citadel Room' });
    socket = connected.socket;
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

  it('rejects selectQuest with tier_locked until all three Tier-II prereqs are met', async () => {
    users.completeQuestTier(accountId, 'canyon_descent', 2);
    users.completeQuestTier(accountId, 'spire_ascent', 2);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(false);

    const errorPromise = waitForEvent(socket, 'questError');
    socket.emit('selectQuest', { questId: QUEST_ID, tier: TIER });
    const err = await errorPromise;
    expect(err.reason).toBe('tier_locked');
    expect(testGameState().selectedQuestId).not.toBe(QUEST_ID);
  });

  it('allows selectQuest after all three Tier-II completions', async () => {
    completeAllTier2Prereqs(accountId);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(true);

    const updatePromise = waitForEvent(socket, 'questUpdate');
    socket.emit('selectQuest', { questId: QUEST_ID, tier: TIER });
    const update = await updatePromise;
    expect(update.selectedQuestId).toBe(QUEST_ID);
    expect(update.selectedQuestTier).toBe(TIER);
    expect(testGameState().selectedQuestId).toBe(QUEST_ID);
  });
});
