import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  ENCOUNTER_PHASES,
  ENCOUNTER_TRIGGER_RADIUS,
  tryActivateEncounter,
} from '../encounters.js';
import {
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  cleanupAfterDamage,
  checkRunTerminalState,
  buildRunSummary,
  isRunObjectiveComplete,
} from '../progression.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS } = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');

const SEED = 6161;
const FIXTURE_QUEST_ID = 'stage_boss_defeat_fixture';
const ADD_COUNT = 2;

// Real combat-path bug (ticket 282): removeDeadEnemies → recordEnemyDefeated is a
// no-op for stage_boss because objectives.js lacks onEnemyDefeated / defeatedEnemies.

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
  setSimulationGameState(state);
  spawnEnemies(state);
  startDungeonRun(state);
  return state;
}

function bossEnemy(state) {
  return state.enemies.find((e) => e.id === state.run.encounter.bossEnemyId);
}

function activateEncounterAfterAddsCleared(state) {
  const anchor = state.run.encounter.spawnAnchor;
  state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
  state.players.p1.z = anchor.z;
  expect(tryActivateEncounter(state)).toBe(true);
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
          addCount: ADD_COUNT,
        },
      },
    },
  };
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('stage boss hostiles-purged count (ticket 282)', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
    deployStageBossRun(state);
  });

  it('counts boss and every add in objective and run summary after full combat removal path', () => {
    const bossId = state.run.encounter.bossEnemyId;
    const expectedDefeated = 1 + ADD_COUNT;

    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.run.objective.addCount).toBe(ADD_COUNT);

    for (const enemy of state.enemies) {
      if (enemy.id !== bossId) enemy.hp = 0;
    }
    removeDeadEnemies(state);

    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.enemies.some((e) => e.id === bossId)).toBe(true);

    activateEncounterAfterAddsCleared(state);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);

    bossEnemy(state).hp = 0;
    cleanupAfterDamage(state);
    checkRunTerminalState(state);

    expect(state.run.status).toBe('victory');
    expect(state.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(state, state.run.objective)).toBe(true);

    expect(state.run.objective.defeatedEnemies).toBe(expectedDefeated);
    expect(buildRunSummary(state, 'victory').defeatedEnemies).toBe(expectedDefeated);
  });
});
