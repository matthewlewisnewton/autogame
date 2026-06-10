import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  updateQuestScriptTriggers,
  cleanupAfterDamage,
  stateSnapshot,
  isRunObjectiveComplete,
} from '../progression.js';
const require = createRequire(import.meta.url);
const {
  QUEST_DEFS,
  getQuest,
  getQuestScript,
  getLayoutProfileForQuest,
} = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');

const SEED = 7171;
const FIXTURE_QUEST_ID = 'quest_script_integration_fixture';

const RUN_START_SPAWNS = [
  { type: 'grunt', x: 1, z: 2 },
];

const ENTER_ROOM_SPAWNS = [
  { type: 'skirmisher', x: 3, z: 4 },
];

const CHAIN_SPAWNS = [
  { type: 'miniboss', x: 5, z: 6 },
];

const TOTAL_SCRIPTED_ENEMIES =
  RUN_START_SPAWNS.length + ENTER_ROOM_SPAWNS.length + CHAIN_SPAWNS.length;

function crowdedLayout(seed = SEED) {
  return generateLayout(seed, 'crowded');
}

function pickDistantRoom(layout, fromRoom) {
  let best = null;
  let bestDist = -1;
  for (const room of layout.rooms) {
    if (room === fromRoom) continue;
    const dist = Math.hypot(room.x - fromRoom.x, room.z - fromRoom.z);
    if (dist > bestDist) {
      bestDist = dist;
      best = room;
    }
  }
  return best;
}

function deployScriptedRun(state, { seed = SEED, triggerRoom } = {}) {
  const layout = crowdedLayout(seed);
  const startRoom = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
  const room = triggerRoom ?? pickDistantRoom(layout, startRoom);

  QUEST_DEFS[FIXTURE_QUEST_ID].tiers[1].script.waves[1].room = {
    x: room.x,
    z: room.z,
  };

  state.selectedQuestId = FIXTURE_QUEST_ID;
  state.selectedQuestTier = 1;
  state.layout = layout;
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.gamePhase = 'playing';
  state.players = {
    p1: {
      x: startRoom.x,
      y: 0.5,
      z: startRoom.z,
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
  return { state, startRoom, triggerRoom: room };
}

function waveState(state, waveId) {
  return state.run.waveScript.waves.find((wave) => wave.id === waveId);
}

function snapshotWaveSummary() {
  const snap = stateSnapshot();
  expect(snap.run?.waveScript).toBeTruthy();
  return snap.run.waveScript.waves.map((wave) => ({
    id: wave.id,
    trigger: wave.trigger,
    status: wave.status,
  }));
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
        name: 'Integration Fixture',
        description: 'Full scripted lifecycle with run_start, enter_room, and waveCleared',
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
              room: { x: 0, z: 0 },
              spawns: ENTER_ROOM_SPAWNS,
            },
            {
              id: 'wave_chain',
              trigger: { waveCleared: 'wave_enter_room' },
              spawns: CHAIN_SPAWNS,
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

describe('quest script integration — snapshot and full lifecycle', () => {
  it('exposes wave id, trigger, and status on stateSnapshot().run.waveScript.waves', () => {
    const state = createGameState();
    deployScriptedRun(state);

    expect(snapshotWaveSummary()).toEqual([
      { id: 'wave_run_start', trigger: 'run_start', status: 'spawned' },
      { id: 'wave_enter_room', trigger: 'enter_room', status: 'pending' },
      { id: 'wave_chain', trigger: { waveCleared: 'wave_enter_room' }, status: 'pending' },
    ]);

    const serialized = JSON.stringify(stateSnapshot().run.waveScript);
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it('completes a fully scripted defeat_enemies run with snapshot status updates at each step', () => {
    const state = createGameState();
    const { triggerRoom } = deployScriptedRun(state);

    expect(state.run.objective.totalEnemies).toBe(TOTAL_SCRIPTED_ENEMIES);
    expect(state.enemies).toHaveLength(RUN_START_SPAWNS.length);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(false);

    state.players.p1.x = triggerRoom.x;
    state.players.p1.z = triggerRoom.z;
    updateQuestScriptTriggers();

    expect(snapshotWaveSummary()).toEqual([
      { id: 'wave_run_start', trigger: 'run_start', status: 'spawned' },
      { id: 'wave_enter_room', trigger: 'enter_room', status: 'spawned' },
      { id: 'wave_chain', trigger: { waveCleared: 'wave_enter_room' }, status: 'pending' },
    ]);
    expect(state.enemies).toHaveLength(
      RUN_START_SPAWNS.length + ENTER_ROOM_SPAWNS.length,
    );

    defeatWave(state, 'wave_run_start');
    expect(snapshotWaveSummary()).toEqual([
      { id: 'wave_run_start', trigger: 'run_start', status: 'cleared' },
      { id: 'wave_enter_room', trigger: 'enter_room', status: 'spawned' },
      { id: 'wave_chain', trigger: { waveCleared: 'wave_enter_room' }, status: 'pending' },
    ]);

    defeatWave(state, 'wave_enter_room');
    expect(snapshotWaveSummary()).toEqual([
      { id: 'wave_run_start', trigger: 'run_start', status: 'cleared' },
      { id: 'wave_enter_room', trigger: 'enter_room', status: 'cleared' },
      { id: 'wave_chain', trigger: { waveCleared: 'wave_enter_room' }, status: 'spawned' },
    ]);
    expect(state.enemies).toHaveLength(CHAIN_SPAWNS.length);

    defeatWave(state, 'wave_chain');
    expect(snapshotWaveSummary()).toEqual([
      { id: 'wave_run_start', trigger: 'run_start', status: 'cleared' },
      { id: 'wave_enter_room', trigger: 'enter_room', status: 'cleared' },
      { id: 'wave_chain', trigger: { waveCleared: 'wave_enter_room' }, status: 'cleared' },
    ]);
    expect(state.enemies).toHaveLength(0);
    expect(state.run.objective.defeatedEnemies).toBe(TOTAL_SCRIPTED_ENEMIES);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);
  });

  it('performs no bulk combat spawn for the scripted fixture', () => {
    const state = createGameState();
    deployScriptedRun(state);

    expect(state.enemies).toHaveLength(RUN_START_SPAWNS.length);
    expect(state.enemies.every((enemy) => enemy.type === 'grunt')).toBe(true);
  });
});

describe('unscripted quest regression', () => {
  it('training_caverns tier 1 has no script and bulk-spawns enemyCount enemies', () => {
    const quest = getQuest('training_caverns', 1);
    expect(getQuestScript(quest)).toBeNull();

    const state = createGameState();
    state.selectedQuestId = 'training_caverns';
    state.selectedQuestTier = 1;
    state.layout = generateLayout(SEED, getLayoutProfileForQuest('training_caverns', 1));
    state.layoutSeed = SEED;
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

    expect(state.run.waveScript).toBeUndefined();
    expect(state.enemies).toHaveLength(quest.enemyCount);
    expect(state.run.objective.totalEnemies).toBe(quest.enemyCount);
    expect(stateSnapshot().run.waveScript).toBeUndefined();
    expect(isRunObjectiveComplete(state.run.objective)).toBe(false);
  });
});
