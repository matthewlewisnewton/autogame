import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  updateQuestScriptTriggers,
} from '../progression.js';
import {
  resolveWaveRoom,
  isPlayerInRoom,
} from '../questScript.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS } = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');

const SEED = questLayoutSeed('quest_script_enter_room_fixture', 1);
const FIXTURE_QUEST_ID = 'quest_script_enter_room_fixture';

const RUN_START_SPAWNS = [
  { type: 'grunt', x: 1, z: 2 },
];

const ENTER_ROOM_SPAWNS = [
  { type: 'miniboss', x: 5, z: 6 },
];

function crowdedLayout(seed = SEED) {
  return generateLayout(seed, 'crowded');
}

function roomAt(layout, x, z) {
  return layout.rooms.find((room) => {
    const hw = room.width / 2;
    const hd = room.depth / 2;
    return x >= room.x - hw && x <= room.x + hw && z >= room.z - hd && z <= room.z + hd;
  });
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

function positionOutsideRoom(room) {
  return {
    x: room.x + room.width / 2 + 2,
    z: room.z,
  };
}

function deployScriptedRun(state, { seed = SEED, enterRoomBinding } = {}) {
  const layout = crowdedLayout(seed);
  const startRoom = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
  const triggerRoom = enterRoomBinding?.landmark
    ? resolveWaveRoom(layout, enterRoomBinding)
    : layout.rooms.find(
      (r) => r.x === enterRoomBinding.x && r.z === enterRoomBinding.z,
    ) || pickDistantRoom(layout, startRoom);

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
  return { state, startRoom, triggerRoom };
}

beforeAll(() => {
  QUEST_DEFS[FIXTURE_QUEST_ID] = {
    id: FIXTURE_QUEST_ID,
    enemyPool: [{ type: 'grunt', weight: 1 }],
    tiers: {
      1: {
        name: 'Enter Room Fixture',
        description: 'Fixture scripted quest with delayed enter_room wave',
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
          ],
        },
      },
    },
  };
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('quest script enter_room triggers', () => {
  it('keeps enter_room waves pending with zero spawns until a player enters the bound room', () => {
    const state = createGameState();
    const layout = crowdedLayout();
    const startRoom = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
    const distantRoom = pickDistantRoom(layout, startRoom);
    QUEST_DEFS[FIXTURE_QUEST_ID].tiers[1].script.waves[1].room = {
      x: distantRoom.x,
      z: distantRoom.z,
    };

    const { triggerRoom } = deployScriptedRun(state, {
      enterRoomBinding: { x: distantRoom.x, z: distantRoom.z },
    });

    expect(state.run.waveScript[1]).toMatchObject({
      id: 'wave_enter_room',
      status: 'pending',
      spawnedEnemyIds: [],
    });
    expect(state.enemies.some((enemy) => enemy.type === 'miniboss')).toBe(false);

    const outside = positionOutsideRoom(triggerRoom);
    state.players.p1.x = outside.x;
    state.players.p1.z = outside.z;
    updateQuestScriptTriggers();

    expect(state.run.waveScript[1].status).toBe('pending');
    expect(state.enemies.some((enemy) => enemy.type === 'miniboss')).toBe(false);

    state.players.p1.x = triggerRoom.x;
    state.players.p1.z = triggerRoom.z;
    updateQuestScriptTriggers();

    expect(state.run.waveScript[1].status).toBe('spawned');
    expect(state.run.waveScript[1].spawnedEnemyIds).toHaveLength(ENTER_ROOM_SPAWNS.length);
    for (const expected of ENTER_ROOM_SPAWNS) {
      const match = state.enemies.find(
        (enemy) => enemy.type === expected.type
          && Math.abs(enemy.x - expected.x) < 1e-6
          && Math.abs(enemy.z - expected.z) < 1e-6,
      );
      expect(match).toBeTruthy();
    }
  });

  it('does not re-spawn when the player re-enters the trigger room', () => {
    const state = createGameState();
    const layout = crowdedLayout();
    const startRoom = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
    const distantRoom = pickDistantRoom(layout, startRoom);
    QUEST_DEFS[FIXTURE_QUEST_ID].tiers[1].script.waves[1].room = {
      x: distantRoom.x,
      z: distantRoom.z,
    };

    const { triggerRoom, startRoom: deployedStart } = deployScriptedRun(state, {
      enterRoomBinding: { x: distantRoom.x, z: distantRoom.z },
    });

    state.players.p1.x = triggerRoom.x;
    state.players.p1.z = triggerRoom.z;
    updateQuestScriptTriggers();
    const countAfterFirstEnter = state.enemies.length;

    state.players.p1.x = deployedStart.x;
    state.players.p1.z = deployedStart.z;
    updateQuestScriptTriggers();
    state.players.p1.x = triggerRoom.x;
    state.players.p1.z = triggerRoom.z;
    updateQuestScriptTriggers();

    expect(state.enemies.length).toBe(countAfterFirstEnter);
    expect(state.run.waveScript[1].status).toBe('spawned');
  });

  it('ignores dead and extracted players for enter_room activation', () => {
    const state = createGameState();
    const layout = crowdedLayout();
    const startRoom = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
    const distantRoom = pickDistantRoom(layout, startRoom);
    QUEST_DEFS[FIXTURE_QUEST_ID].tiers[1].script.waves[1].room = {
      x: distantRoom.x,
      z: distantRoom.z,
    };

    const { triggerRoom } = deployScriptedRun(state, {
      enterRoomBinding: { x: distantRoom.x, z: distantRoom.z },
    });

    state.players.p1.x = triggerRoom.x;
    state.players.p1.z = triggerRoom.z;
    state.players.p1.dead = true;
    updateQuestScriptTriggers();
    expect(state.run.waveScript[1].status).toBe('pending');

    state.players.p1.dead = false;
    state.players.p1.extracted = true;
    updateQuestScriptTriggers();
    expect(state.run.waveScript[1].status).toBe('pending');
  });

  it('resolves landmark room bindings via layout.landmarks position', () => {
    const layout = generateLayout(SEED, 'crowded', { layoutMode: 'rigid' });
    const dais = layout.landmarks.find((lm) => lm.type === 'vault_dais');
    expect(dais).toBeTruthy();

    const room = resolveWaveRoom(layout, { landmark: 'vault_dais' });
    expect(room).toBeTruthy();
    expect(isPlayerInRoom({ x: dais.x, z: dais.z }, room)).toBe(true);
    expect(roomAt(layout, dais.x, dais.z)).toBe(room);

    QUEST_DEFS[FIXTURE_QUEST_ID].tiers[1].script.waves[1].room = {
      landmark: 'vault_dais',
    };

    const state = createGameState();
    const startRoom = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
    state.selectedQuestId = FIXTURE_QUEST_ID;
    state.selectedQuestTier = 1;
    state.layout = layout;
    state.layoutSeed = SEED;
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

    const outside = positionOutsideRoom(room);
    state.players.p1.x = outside.x;
    state.players.p1.z = outside.z;
    updateQuestScriptTriggers();
    expect(state.run.waveScript[1].status).toBe('pending');

    state.players.p1.x = dais.x;
    state.players.p1.z = dais.z;
    updateQuestScriptTriggers();
    expect(state.run.waveScript[1].status).toBe('spawned');
  });
});
