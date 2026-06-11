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
  canDamageEnemy,
  tryActivateEncounter,
  isEncounterCleared,
  isEncounterLocked,
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
  startTestServer,
  closeServer,
  connectClient,
  waitForEvent,
  lobbyStateForSocket,
  playerForSocket,
} from './helpers.js';

// users.js/quests.js/simulation.js are resolved via CJS so the gate, the run
// lifecycle, and the damage pipeline all share the same module instances that
// progression.js reads lazily at call time (see rift_convergence_e2e.test.js).
const require = createRequire(import.meta.url);
const users = require('../users.js');
const { QUEST_DEFS, getEnemyPool, getLayoutProfileForQuest } = require('../quests.js');
const {
  ENEMY_DEFS,
  damageEnemy,
  setGameState: setSimulationGameState,
} = require('../simulation.js');

const QUEST_ID = 'citadel_assault';
const TIER = 1;
const SEED = 38713;
const ADD_COUNT = 5;
const BOSS_HP = 460;
const REWARD_CURRENCY = 26;
const PREREQS = [
  { questId: 'canyon_descent', tier: 2 },
  { questId: 'spire_ascent', tier: 2 },
  { questId: 'arena_trials', tier: 2 },
];

function setSoloPlayer(state, accountId, position = { x: -20, z: 0 }) {
  Object.keys(state.players).forEach((k) => delete state.players[k]);
  state.players.p1 = {
    x: position.x,
    y: 0.5,
    z: position.z,
    rotation: 0,
    hp: 100,
    dead: false,
    extracted: false,
    currency: 0,
    runCardDropIds: [],
    accountId,
  };
}

function deployCitadelAssaultRun(state, accountId, { seed = SEED } = {}) {
  setSoloPlayer(state, accountId);
  state.selectedQuestId = QUEST_ID;
  state.selectedQuestTier = TIER;
  state.layout = generateLayout(seed, getLayoutProfileForQuest(QUEST_ID, TIER));
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.gamePhase = 'playing';
  setGameState(state);
  setSimulationGameState(state);
  spawnEnemies();
  startDungeonRun();
  return state;
}

function bossEnemy(state) {
  return state.enemies.find((e) => e.id === state.run.encounter.bossEnemyId);
}

describe('citadel_assault end-to-end unlock → run → defeat lifecycle', () => {
  let tmpFile;
  let accountId;
  let twoPrereqAccountId;

  beforeEach(() => {
    tmpFile = path.join(
      os.tmpdir(),
      `citadel-e2e-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    users.createUser('citadel_e2e_runner', 'pass');
    users.createUser('citadel_e2e_two_prereqs', 'pass');
    accountId = users.findUserByUsername('citadel_e2e_runner').accountId;
    twoPrereqAccountId = users.findUserByUsername('citadel_e2e_two_prereqs').accountId;
  });

  afterEach(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('admits a qualified account, plays dormant → active → cleared, and pays the capstone purse', () => {
    // ── Gate: ALL THREE tier-2 prereqs are required; two of three stays locked.
    users.completeQuestTier(twoPrereqAccountId, 'canyon_descent', 2);
    users.completeQuestTier(twoPrereqAccountId, 'spire_ascent', 2);
    expect(users.isQuestTierUnlocked(twoPrereqAccountId, QUEST_ID, TIER)).toBe(false);

    for (const prereq of PREREQS) {
      users.completeQuestTier(accountId, prereq.questId, prereq.tier);
    }
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(true);

    // ── Run start: boss-arena layout, stage_boss objective for 6, dormant encounter.
    const state = deployCitadelAssaultRun(createGameState(), accountId);
    expect(getLayoutProfileForQuest(QUEST_ID, TIER)).toBe('boss-arena');
    expect(state.layout.profile).toBe('boss-arena');
    expect(state.run.questId).toBe(QUEST_ID);
    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.run.objective.totalEnemies).toBe(1 + ADD_COUNT);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.enemies).toHaveLength(1 + ADD_COUNT);

    // Exactly one Citadel Sovereign, wired as the encounter boss, on the dais.
    const sovereigns = state.enemies.filter((e) => e.type === 'citadel_sovereign');
    expect(sovereigns).toHaveLength(1);
    const boss = bossEnemy(state);
    expect(boss.type).toBe('citadel_sovereign');
    expect(boss.hp).toBe(BOSS_HP);
    expect(ENEMY_DEFS.citadel_sovereign.hp).toBe(BOSS_HP);

    const dais = state.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    expect(boss.x).toBe(dais.x);
    expect(boss.z).toBe(dais.z);
    const anchor = state.run.encounter.spawnAnchor;
    expect(anchor).toEqual({ x: dais.x, z: dais.z });

    // Five adds drawn ONLY from the quest's enemy pool types.
    const poolTypes = new Set(getEnemyPool(QUEST_ID, TIER).map((entry) => entry.type));
    const adds = state.enemies.filter((e) => e.id !== boss.id);
    expect(adds).toHaveLength(ADD_COUNT);
    for (const add of adds) {
      expect(
        poolTypes.has(add.type),
        `${add.type} is not in the citadel_assault enemy pool`,
      ).toBe(true);
      expect(add.hp).toBeGreaterThan(0);
    }

    // ── Dormant: the boss is invulnerable; adds are not.
    expect(canDamageEnemy(state, boss)).toBe(false);
    const dormantHp = boss.hp;
    const blocked = damageEnemy(boss, 9999);
    expect(blocked.killed).toBe(false);
    expect(boss.hp).toBe(dormantHp);

    // Activation needs BOTH conditions: with adds alive nothing happens, even
    // though the player starts far from the dais anyway.
    expect(tryActivateEncounter(state)).toBe(false);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

    for (const add of adds) {
      expect(canDamageEnemy(state, add)).toBe(true);
      damageEnemy(add, add.hp);
    }
    removeDeadEnemies();
    expect(state.run.objective.defeatedEnemies).toBe(ADD_COUNT);

    // Adds down but player still outside the trigger radius: stays dormant.
    expect(tryActivateEncounter(state)).toBe(false);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

    // ── Activate: step within ENCOUNTER_TRIGGER_RADIUS of the dais anchor.
    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;

    expect(tryActivateEncounter(state)).toBe(true);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(isEncounterLocked(state.run)).toBe(true);

    // ── Active: a fixed damage chip now lands for exactly its amount.
    expect(canDamageEnemy(state, boss)).toBe(true);
    const chip = damageEnemy(boss, 60);
    expect(chip.hpBefore - boss.hp).toBe(60);
    expect(boss.hp).toBe(BOSS_HP - 60);

    damageEnemy(boss, boss.hp);
    removeDeadEnemies();

    expect(isEncounterCleared(state.run)).toBe(true);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.CLEARED);
    expect(state.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);

    // ── Victory: terminal check records completion and pays the 26-stone purse.
    expect(QUEST_DEFS[QUEST_ID].tiers[TIER].rewardCurrency).toBe(REWARD_CURRENCY);
    expect(users.hasCompletedQuestTier(accountId, QUEST_ID, TIER)).toBe(false);
    expect(state.players.p1.currency).toBe(0);
    cleanupAfterDamage();
    checkRunTerminalState();
    expect(state.run.status).toBe('victory');
    expect(users.hasCompletedQuestTier(accountId, QUEST_ID, TIER)).toBe(true);
    expect(state.players.p1.currency).toBe(REWARD_CURRENCY);
    expect(state.players.p1.runRewards.currency).toBe(REWARD_CURRENCY);
  });
});

describe('citadel debug scenarios (QA shortcuts)', () => {
  let baseUrl;
  let prevAllowDebug;
  let tmpFile;

  function createScenarioAccount(username) {
    users.createUser(username, 'pass');
    return users.findUserByUsername(username).accountId;
  }

  function citadelNode(graph) {
    return graph.nodes.find((n) => n.questId === QUEST_ID && n.tier === TIER);
  }

  beforeEach(async () => {
    prevAllowDebug = process.env.ALLOW_DEBUG_SCENARIOS;
    process.env.ALLOW_DEBUG_SCENARIOS = '1';
    tmpFile = path.join(
      os.tmpdir(),
      `citadel-scenario-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    baseUrl = await startTestServer();
  });

  afterEach(async () => {
    await closeServer();
    if (prevAllowDebug === undefined) {
      delete process.env.ALLOW_DEBUG_SCENARIOS;
    } else {
      process.env.ALLOW_DEBUG_SCENARIOS = prevAllowDebug;
    }
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('citadel-unlocked records all three prereqs and unlocks the capstone node', async () => {
    const accountId = createScenarioAccount('citadel_unlocked_qa');
    const { socket } = await connectClient(baseUrl, accountId);

    const resultPromise = waitForEvent(socket, 'debugScenarioResult');
    socket.emit('debugScenario', { name: 'citadel-unlocked' });
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    expect(result.scenario).toBe('citadel-unlocked');
    expect(citadelNode(result.levelUnlockGraph).state).toBe('unlocked');

    for (const prereq of PREREQS) {
      expect(users.hasCompletedQuestTier(accountId, prereq.questId, prereq.tier)).toBe(true);
    }
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(true);

    const state = lobbyStateForSocket(socket);
    expect(state.gamePhase).toBe('lobby');
    expect(state.selectedQuestId).toBe(QUEST_ID);
    expect(state.selectedQuestTier).toBe(TIER);
  });

  it('citadel-one-prereq records one prereq and keeps the capstone node locked', async () => {
    const accountId = createScenarioAccount('citadel_one_prereq_qa');
    const { socket } = await connectClient(baseUrl, accountId);

    const resultPromise = waitForEvent(socket, 'debugScenarioResult');
    socket.emit('debugScenario', { name: 'citadel-one-prereq' });
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    expect(result.scenario).toBe('citadel-one-prereq');
    expect(citadelNode(result.levelUnlockGraph).state).toBe('locked');

    expect(users.hasCompletedQuestTier(accountId, 'canyon_descent', 2)).toBe(true);
    expect(users.hasCompletedQuestTier(accountId, 'spire_ascent', 2)).toBe(false);
    expect(users.hasCompletedQuestTier(accountId, 'arena_trials', 2)).toBe(false);
    expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER)).toBe(false);

    const state = lobbyStateForSocket(socket);
    expect(state.gamePhase).toBe('lobby');
  });

  it('citadel-boss deploys the dormant sovereign run with the player outside the trigger radius', async () => {
    const accountId = createScenarioAccount('citadel_boss_qa');
    const { socket } = await connectClient(baseUrl, accountId);

    const resultPromise = waitForEvent(socket, 'debugScenarioResult');
    socket.emit('debugScenario', { name: 'citadel-boss' });
    const result = await resultPromise;
    await waitForEvent(socket, 'stateUpdate');

    expect(result.ok).toBe(true);
    expect(result.scenario).toBe('citadel-boss');

    const state = lobbyStateForSocket(socket);
    expect(state.gamePhase).toBe('playing');
    expect(state.selectedQuestId).toBe(QUEST_ID);
    expect(state.selectedQuestTier).toBe(TIER);
    expect(state.run.questId).toBe(QUEST_ID);
    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

    const boss = state.enemies.find((e) => e.id === state.run.encounter.bossEnemyId);
    expect(boss.type).toBe('citadel_sovereign');
    expect(boss.hp).toBe(BOSS_HP);

    const poolTypes = new Set(getEnemyPool(QUEST_ID, TIER).map((entry) => entry.type));
    const adds = state.enemies.filter((e) => e.id !== boss.id && e.hp > 0);
    expect(adds).toHaveLength(ADD_COUNT);
    for (const add of adds) {
      expect(
        poolTypes.has(add.type),
        `${add.type} is not in the citadel_assault enemy pool`,
      ).toBe(true);
    }

    const player = playerForSocket(socket);
    const anchor = state.run.encounter.spawnAnchor;
    const dist = Math.hypot(player.x - anchor.x, player.z - anchor.z);
    expect(dist).toBeGreaterThan(ENCOUNTER_TRIGGER_RADIUS);
  });
});
