import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateLayout, mulberry32 } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  spawnCombatEnemies,
} from '../progression.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS } = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');

const SEED = 5151;
const FIXTURE_QUEST_ID = 'quest_script_run_start_fixture';

const RUN_START_SPAWNS = [
  { type: 'grunt', x: 1, z: 2 },
  { type: 'skirmisher', x: 3, z: 4 },
];

const ENTER_ROOM_SPAWNS = [
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

beforeAll(() => {
  QUEST_DEFS[FIXTURE_QUEST_ID] = {
    id: FIXTURE_QUEST_ID,
    enemyPool: [{ type: 'grunt', weight: 1 }],
    tiers: {
      1: {
        name: 'Run Start Fixture',
        description: 'Fixture scripted defeat_enemies quest with mixed triggers',
        objectiveType: 'defeat_enemies',
        enemyCount: 99,
        rewardCurrency: 1,
        layoutProfile: 'crowded',
        script: {
          waves: [
            {
              id: 'wave_run_start',
              trigger: 'run_start',
              spawns: RUN_START_SPAWNS,
            },
            {
              id: 'wave_enter_room',
              trigger: 'enter_room',
              room: { x: 10, z: 10 },
              spawns: ENTER_ROOM_SPAWNS,
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

describe('quest script run_start spawn', () => {
  it('creates run.waveScript with pending/spawned/cleared-ready entries per wave', () => {
    const state = createGameState();
    deployScriptedRun(state);

    expect(state.run.waveScript).toHaveLength(2);
    expect(state.run.waveScript[0]).toMatchObject({
      id: 'wave_run_start',
      trigger: 'run_start',
      status: 'spawned',
    });
    expect(state.run.waveScript[0].spawnedEnemyIds).toHaveLength(RUN_START_SPAWNS.length);
    expect(state.run.waveScript[1]).toMatchObject({
      id: 'wave_enter_room',
      trigger: 'enter_room',
      status: 'pending',
      spawnedEnemyIds: [],
    });
  });

  it('spawns only run_start enemies at deploy with matching types and positions', () => {
    const state = createGameState();
    deployScriptedRun(state);

    expect(state.enemies).toHaveLength(RUN_START_SPAWNS.length);
    for (const expected of RUN_START_SPAWNS) {
      const match = state.enemies.find(
        (enemy) => enemy.type === expected.type
          && Math.abs(enemy.x - expected.x) < 1e-6
          && Math.abs(enemy.z - expected.z) < 1e-6,
      );
      expect(match).toBeTruthy();
    }
    expect(state.enemies.some((enemy) => enemy.type === 'miniboss')).toBe(false);
  });

  it('leaves spawnCombatEnemies with zero scripted-tier spawns', () => {
    const state = createGameState();
    state.selectedQuestId = FIXTURE_QUEST_ID;
    state.selectedQuestTier = 1;
    state.layout = crowdedLayout();
    state.layoutSeed = SEED;
    state.enemies = [];
    setGameState(state);

    const quest = require('../quests.js').getQuest(FIXTURE_QUEST_ID, 1);
    const before = state.enemies.length;
    spawnCombatEnemies(state.layout, mulberry32(SEED + 1000), quest);
    expect(state.enemies.length - before).toBe(0);
  });

  it('sets defeat_enemies objective total from scripted spawn count', () => {
    const state = createGameState();
    deployScriptedRun(state);

    expect(state.run.objective.type).toBe('defeat_enemies');
    expect(state.run.objective.totalEnemies).toBe(
      RUN_START_SPAWNS.length + ENTER_ROOM_SPAWNS.length,
    );
  });
});
