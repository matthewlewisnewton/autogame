import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  cleanupAfterDamage,
} from '../progression.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS } = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');

const SEED = 6161;
const FIXTURE_QUEST_ID = 'quest_script_wave_chain_fixture';

const WAVE_A_SPAWNS = [
  { type: 'grunt', x: 1, z: 2 },
  { type: 'grunt', x: 1.5, z: 2.5 },
];

const WAVE_B_SPAWNS = [
  { type: 'skirmisher', x: 3, z: 4 },
];

const WAVE_C_SPAWNS = [
  { type: 'miniboss', x: 5, z: 6 },
];

function crowdedLayout(seed = SEED) {
  return generateLayout(seed, 'crowded');
}

function deployScriptedRun(state, { seed = SEED } = {}) {
  state.selectedQuestId = FIXTURE_QUEST_ID;
  state.selectedQuestTier = 1;
  state.layout = crowdedLayout(seed);
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.gamePhase = 'playing';
  state.players = {
    p1: {
      x: 0,
      y: 0.5,
      z: 0,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
    },
  };
  setGameState(state);
  setSimulationGameState(state);
  spawnEnemies();
  startDungeonRun();
  return state;
}

function waveState(state, waveId) {
  return state.run.waveScript.find((wave) => wave.id === waveId);
}

function enemiesForWave(state, waveId) {
  const ids = new Set(waveState(state, waveId).spawnedEnemyIds);
  return state.enemies.filter((enemy) => ids.has(enemy.id));
}

function defeatWave(state, waveId) {
  for (const enemy of enemiesForWave(state, waveId)) {
    enemy.hp = 0;
  }
  cleanupAfterDamage();
}

beforeAll(() => {
  QUEST_DEFS[FIXTURE_QUEST_ID] = {
    id: FIXTURE_QUEST_ID,
    enemyPool: [{ type: 'grunt', weight: 1 }],
    tiers: {
      1: {
        name: 'Wave Chain Fixture',
        description: 'Fixture scripted quest with run_start and waveCleared chain',
        objectiveType: 'defeat_enemies',
        enemyCount: 99,
        rewardCurrency: 1,
        layoutProfile: 'crowded',
        script: {
          waves: [
            {
              id: 'wave_a',
              trigger: 'run_start',
              spawns: WAVE_A_SPAWNS,
            },
            {
              id: 'wave_b',
              trigger: { waveCleared: 'wave_a' },
              spawns: WAVE_B_SPAWNS,
            },
            {
              id: 'wave_c',
              trigger: { waveCleared: 'wave_b' },
              spawns: WAVE_C_SPAWNS,
            },
          ],
        },
      },
    },
  };
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('quest script waveCleared chaining', () => {
  it('spawns only run_start wave at deploy; later waves stay pending', () => {
    const state = createGameState();
    deployScriptedRun(state);

    expect(waveState(state, 'wave_a').status).toBe('spawned');
    expect(waveState(state, 'wave_b').status).toBe('pending');
    expect(waveState(state, 'wave_c').status).toBe('pending');
    expect(state.enemies).toHaveLength(WAVE_A_SPAWNS.length);
    expect(state.enemies.some((enemy) => enemy.type === 'skirmisher')).toBe(false);
    expect(state.enemies.some((enemy) => enemy.type === 'miniboss')).toBe(false);
  });

  it('chains three waves in order as each prior wave is fully defeated', () => {
    const state = createGameState();
    deployScriptedRun(state);

    defeatWave(state, 'wave_a');
    expect(waveState(state, 'wave_a').status).toBe('cleared');
    expect(waveState(state, 'wave_b').status).toBe('spawned');
    expect(waveState(state, 'wave_c').status).toBe('pending');
    expect(state.enemies).toHaveLength(WAVE_B_SPAWNS.length);
    for (const expected of WAVE_B_SPAWNS) {
      const match = state.enemies.find(
        (enemy) => enemy.type === expected.type
          && Math.abs(enemy.x - expected.x) < 1e-6
          && Math.abs(enemy.z - expected.z) < 1e-6,
      );
      expect(match).toBeTruthy();
    }

    defeatWave(state, 'wave_b');
    expect(waveState(state, 'wave_b').status).toBe('cleared');
    expect(waveState(state, 'wave_c').status).toBe('spawned');
    expect(state.enemies).toHaveLength(WAVE_C_SPAWNS.length);
    for (const expected of WAVE_C_SPAWNS) {
      const match = state.enemies.find(
        (enemy) => enemy.type === expected.type
          && Math.abs(enemy.x - expected.x) < 1e-6
          && Math.abs(enemy.z - expected.z) < 1e-6,
      );
      expect(match).toBeTruthy();
    }

    defeatWave(state, 'wave_c');
    expect(waveState(state, 'wave_c').status).toBe('cleared');
    expect(state.enemies).toHaveLength(0);
    expect(state.run.objective.defeatedEnemies).toBe(
      WAVE_A_SPAWNS.length + WAVE_B_SPAWNS.length + WAVE_C_SPAWNS.length,
    );
  });

  it('does not re-fire waves already spawned or cleared when a prior wave clears again', () => {
    const state = createGameState();
    deployScriptedRun(state);

    defeatWave(state, 'wave_a');
    const countAfterB = state.enemies.length;
    const bIds = [...waveState(state, 'wave_b').spawnedEnemyIds];

    waveState(state, 'wave_a').status = 'cleared';
    cleanupAfterDamage();

    expect(state.enemies.length).toBe(countAfterB);
    expect(waveState(state, 'wave_b').spawnedEnemyIds).toEqual(bIds);
    expect(waveState(state, 'wave_b').status).toBe('spawned');
    expect(waveState(state, 'wave_c').status).toBe('pending');
  });

  it('keeps a spawned wave uncleared until every spawned enemy is removed', () => {
    const state = createGameState();
    deployScriptedRun(state);

    const [firstEnemy] = enemiesForWave(state, 'wave_a');
    firstEnemy.hp = 0;
    cleanupAfterDamage();

    expect(waveState(state, 'wave_a').status).toBe('spawned');
    expect(waveState(state, 'wave_b').status).toBe('pending');
    expect(state.enemies.length).toBe(WAVE_A_SPAWNS.length - 1);
  });
});
