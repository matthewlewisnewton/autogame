import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateLayout, sampleFloorY } from '../dungeon.js';
import { ENCOUNTER_PHASES } from '../encounters.js';
import { createGameState } from '../game-state.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
} from '../progression.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS } = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');

const SEED = 4242;
const FIXTURE_QUEST_ID = 'canyon_stage_boss_fixture';
const ADD_COUNT = 4;

function sunkenCanyonRigidLayout(seed = SEED) {
  return generateLayout(seed, 'sunken-canyon', { layoutMode: 'rigid' });
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

function setPartySize(state, count) {
  Object.keys(state.players).forEach((k) => delete state.players[k]);
  for (let i = 1; i <= count; i++) {
    state.players[`p${i}`] = {
      x: i,
      y: 0.5,
      z: 0,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
    };
  }
}

function deployCanyonStageBossRun(state, { seed = SEED } = {}) {
  setPartySize(state, 1);
  state.selectedQuestId = FIXTURE_QUEST_ID;
  state.selectedQuestTier = 1;
  state.layout = sunkenCanyonRigidLayout(seed);
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

beforeAll(() => {
  QUEST_DEFS[FIXTURE_QUEST_ID] = {
    id: FIXTURE_QUEST_ID,
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Canyon Stage Boss Fixture',
        description: 'Fixture canyon stage boss quest',
        objectiveType: 'stage_boss',
        rewardCurrency: 1,
        layoutProfile: 'sunken-canyon',
        layoutMode: 'rigid',
        encounter: {
          bossType: 'miniboss',
          landmark: 'canyon_monolith',
          addCount: ADD_COUNT,
        },
      },
    },
  };
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('canyon stage_boss spawn (rigid sunken-canyon)', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
  });

  it('spawns one dormant miniboss at canyon_monolith with addCount adds and no bulk pack', () => {
    deployCanyonStageBossRun(state);
    const monolith = state.layout.landmarks.find((lm) => lm.type === 'canyon_monolith');

    const bosses = state.enemies.filter((e) => e.type === 'miniboss');
    const adds = state.enemies.filter((e) => e.type !== 'miniboss');

    expect(monolith).toBeDefined();
    expect(bosses).toHaveLength(1);
    expect(bosses[0].x).toBe(monolith.x);
    expect(bosses[0].z).toBe(monolith.z);
    expect(adds).toHaveLength(ADD_COUNT);
    expect(state.enemies).toHaveLength(1 + ADD_COUNT);
  });

  it('splits adds across plateau and canyon bands with boss in the canyon', () => {
    deployCanyonStageBossRun(state);
    const layout = state.layout;
    const boss = state.enemies.find((e) => e.type === 'miniboss');
    const adds = state.enemies.filter((e) => e.type !== 'miniboss');
    const addBands = adds.map((e) => bandAt(layout, e));

    expect(bandAt(layout, boss)).toBe('canyon');
    expect(addBands.filter((b) => b === 'plateau').length).toBeGreaterThanOrEqual(1);
    expect(addBands.filter((b) => b === 'canyon').length).toBeGreaterThanOrEqual(1);
    expect(addBands.some((b) => b === 'ramp')).toBe(false);
  });

  it('places the boss floor below plateau add elevations', () => {
    deployCanyonStageBossRun(state);
    const layout = state.layout;
    const boss = state.enemies.find((e) => e.type === 'miniboss');
    const plateauAdd = state.enemies
      .filter((e) => e.type !== 'miniboss')
      .find((e) => bandAt(layout, e) === 'plateau');

    expect(plateauAdd).toBeDefined();
    const bossY = sampleFloorY(layout, boss.x, boss.z);
    const plateauY = sampleFloorY(layout, plateauAdd.x, plateauAdd.z);
    expect(bossY).toBeLessThan(plateauY);
  });

  it('wires bossEnemyId and starts encounter dormant on run open', () => {
    deployCanyonStageBossRun(state);
    const boss = state.enemies.find((e) => e.type === 'miniboss');

    expect(state.run.encounter.bossEnemyId).toBe(boss.id);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state._pendingEncounterBossId).toBeUndefined();
  });
});
