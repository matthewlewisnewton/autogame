import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  ENCOUNTER_PHASES,
  tryActivateEncounter,
  isEncounterCleared,
} from '../encounters.js';
import { getObjectiveDef } from '../objectives.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  cleanupAfterDamage,
  recordEnemyDefeated,
  isRunObjectiveComplete,
} from '../progression.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS } = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');
const {
  registerEncounterRewardHook,
  clearEncounterRewardHooks,
} = require('../encounters.js');

const SEED = 6161;
const FIXTURE_QUEST_ID = 'stage_boss_defeat_fixture';

function openPlazaLayout(seed = SEED) {
  return generateLayout(seed, 'open-plaza');
}

function setPartySize(state, count, position = { x: 0, z: 0 }) {
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

function deployStageBossRun(state, { seed = SEED, partySize = 1 } = {}) {
  setPartySize(state, partySize);
  state.selectedQuestId = FIXTURE_QUEST_ID;
  state.selectedQuestTier = 1;
  state.layout = openPlazaLayout(seed);
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

function activateEncounterForTest(state) {
  const bossId = state.run.encounter.bossEnemyId;
  for (const enemy of state.enemies) {
    if (enemy.id !== bossId) enemy.hp = 0;
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  tryActivateEncounter(state);
}

beforeAll(() => {
  QUEST_DEFS[FIXTURE_QUEST_ID] = {
    id: FIXTURE_QUEST_ID,
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Stage Boss Defeat Fixture',
        description: 'Fixture for boss defeat hook tests',
        objectiveType: 'stage_boss',
        rewardCurrency: 1,
        layoutProfile: 'open-plaza',
        encounter: {
          bossType: 'miniboss',
          landmark: 'arena_dais',
          addCount: 2,
        },
      },
    },
  };
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('stage boss defeat hook', () => {
  let state;
  const rewardHookCalls = [];

  beforeEach(() => {
    state = createGameState();
    deployStageBossRun(state);
    rewardHookCalls.length = 0;
    clearEncounterRewardHooks();
    registerEncounterRewardHook((gameState, bossEnemyArg, run) => {
      rewardHookCalls.push({ gameState, bossEnemy: bossEnemyArg, run });
    });
  });

  it('killing adds without the boss leaves the run playing', () => {
    const bossId = state.run.encounter.bossEnemyId;
    for (const enemy of state.enemies) {
      if (enemy.id !== bossId) enemy.hp = 0;
    }

    removeDeadEnemies();

    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.run.objective.bossDefeated).toBe(false);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(false);
    expect(state.run.status).toBe('playing');
    expect(state.enemies.some((e) => e.id === bossId)).toBe(true);
  });

  it('recordEnemyDefeated does not complete the stage_boss objective', () => {
    const before = { ...state.run.objective };
    recordEnemyDefeated(5);
    expect(state.run.objective.bossDefeated).toBe(false);
    expect(state.run.objective.defeatedEnemies).toBeGreaterThan(before.defeatedEnemies);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(false);
  });

  it('killing the boss while active clears the encounter and completes the objective', () => {
    activateEncounterForTest(state);
    const boss = bossEnemy(state);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);

    boss.hp = 0;
    removeDeadEnemies();

    expect(isEncounterCleared(state.run)).toBe(true);
    expect(state.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);
    expect(rewardHookCalls).toHaveLength(1);
    expect(rewardHookCalls[0].bossEnemy.id).toBe(boss.id);
  });

  it('cleanupAfterDamage ends the run with victory when the boss dies', () => {
    activateEncounterForTest(state);
    bossEnemy(state).hp = 0;

    cleanupAfterDamage();

    expect(state.run.status).toBe('victory');
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);
  });

  it('does not clear the encounter when the boss dies before activation', () => {
    const boss = bossEnemy(state);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

    boss.hp = 0;
    removeDeadEnemies();

    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.run.objective.bossDefeated).toBe(false);
    expect(rewardHookCalls).toHaveLength(0);
  });

  it('does not re-run defeat hooks when the encounter is already cleared', () => {
    activateEncounterForTest(state);
    const def = getObjectiveDef('stage_boss');
    def.onBossDefeated(state.run, bossEnemy(state));
    state.run.encounter.phase = ENCOUNTER_PHASES.CLEARED;

    const extraBoss = {
      id: state.run.encounter.bossEnemyId,
      type: 'miniboss',
      x: 0,
      z: 0,
      hp: 0,
    };
    state.enemies.push(extraBoss);

    removeDeadEnemies();

    expect(rewardHookCalls).toHaveLength(0);
    expect(state.run.objective.bossDefeated).toBe(true);
  });

  it('still clears the encounter when miniboss loot rolls succeed', () => {
    activateEncounterForTest(state);
    const boss = bossEnemy(state);
    const lootBefore = state.loot.length;

    boss.hp = 0;
    removeDeadEnemies();

    expect(isEncounterCleared(state.run)).toBe(true);
    expect(state.loot.length).toBeGreaterThanOrEqual(lootBefore);
  });
});
