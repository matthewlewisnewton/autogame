import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { getObjectiveDef, isValidObjectiveType } from '../objectives.js';
import {
  gameState,
  resetGameState,
  setGameState,
  spawnEnemies,
  startDungeonRun,
  suspendRunToLobby,
  checkAllReady,
  isRunObjectiveComplete,
  buildRunSummary,
  // tickEscort must come from index.js (the wired game-loop path): the
  // ESM-imported escort.js instance has no checkRunTerminalState callback.
  tickEscort,
  updateEnemies,
  updateMinions,
  damageMinion,
} from '../index.js';
import { setGameState as setSimulationGameState, simNow } from '../simulation.js';
import {
  ESCORT_DESTINATION_RADIUS,
  getEscortMinion,
  isEscortAtDestination,
} from '../escort.js';

const require = createRequire(import.meta.url);
const {
  QUEST_DEFS, ESCORT_OBJECTIVE_FIXTURE_DEF, formatObjectiveSummary, getQuest,
} = require('../quests.js');
const {
  ESCORT_STALL_FAIL_MS,
  setEscortStallFailMsForTests,
} = require('../escort.js');

const SEED = 5151;
const FIXTURE_QUEST_ID = 'escort_objective_fixture';

function openPlazaLayout(seed = SEED) {
  return generateLayout(seed, 'open-plaza');
}

function setPartySize(state, count) {
  Object.keys(state.players).forEach((k) => delete state.players[k]);
  for (let i = 1; i <= count; i++) {
    state.players[`p${i}`] = {
      x: i * 2,
      y: 0.5,
      z: 0,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
    };
  }
}

function deployEscortRun(state, { seed = SEED, partySize = 1 } = {}) {
  setPartySize(state, partySize);
  state.selectedQuestId = FIXTURE_QUEST_ID;
  state.selectedQuestTier = 1;
  state.layout = openPlazaLayout(seed);
  state.layoutSeed = seed;
  state.enemies = [];
  state.minions = [];
  state.loot = [];
  state.gamePhase = 'playing';
  setGameState(state);
  setSimulationGameState(state);
  spawnEnemies();
  startDungeonRun();
  return state;
}

beforeAll(() => {
  QUEST_DEFS[FIXTURE_QUEST_ID] = ESCORT_OBJECTIVE_FIXTURE_DEF;
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('escort objective registry', () => {
  it('is a valid objective type with bulk spawn skipped', () => {
    expect(isValidObjectiveType('escort')).toBe(true);
    const def = getObjectiveDef('escort');
    expect(def.skipBulkCombatSpawn()).toBe(true);
  });

  it('createObjective tracks escort progress fields', () => {
    const quest = ESCORT_OBJECTIVE_FIXTURE_DEF.tiers[1];
    const objective = getObjectiveDef('escort').createObjective(quest, { enemyCount: 0 });
    expect(objective).toMatchObject({
      type: 'escort',
      totalEnemies: 1,
      defeatedEnemies: 0,
      reachedDestination: false,
    });
    expect(objective.label).toContain('Archivist Vale');
  });

  it('formatObjectiveSummary renders escort line', () => {
    const quest = ESCORT_OBJECTIVE_FIXTURE_DEF.tiers[1];
    expect(formatObjectiveSummary(quest)).toBe('Escort Archivist Vale to arena dais');
  });

  it('annex_escort tier 1 carries the escort ambush dialogue beacon', () => {
    const quest = getQuest('annex_escort', 1);
    expect(quest.dialogueBeacons).toContainEqual({
      beaconId: 'escort_ambush',
      trigger: 'onRoomEntered',
      roomIndex: 1,
      speaker: 'Archivist Vale',
      line: 'They found us!',
    });
  });
});

describe('escort deploy and follow behavior', () => {
  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
  });

  it('spawns escort minion attached to run.escort on deploy', () => {
    deployEscortRun(gameState);
    expect(gameState.run.escort).toBeDefined();
    expect(gameState.run.escort.npcName).toBe('Archivist Vale');
    const escort = getEscortMinion(gameState);
    expect(escort).toBeTruthy();
    expect(escort.isEscort).toBe(true);
    expect(escort.type).toBe('escort_npc');
  });

  it('escort follows the nearest living squad member when not under attack', () => {
    deployEscortRun(gameState);
    const escort = getEscortMinion(gameState);
    escort.x = 20;
    escort.z = 0;
    gameState.enemies = [];

    for (let i = 0; i < 30; i++) {
      updateMinions();
    }

    expect(escort.x).toBeLessThan(20);
    expect(Math.abs(escort.z - gameState.players.p1.z)).toBeLessThan(5);
  });
});

describe('escort death fail', () => {
  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
    deployEscortRun(gameState);
    gameState.enemies = [];
  });

  it('marks the run failed with a clear objective label when escort dies', () => {
    const escort = getEscortMinion(gameState);
    damageMinion(escort, escort.maxHp);
    updateMinions();

    expect(gameState.run.status).toBe('failed');
    expect(gameState.run.escort.failed).toBe(true);
    expect(gameState.run.objective.label).toContain('Archivist Vale was lost');
    expect(gameState.run.objective.label).toContain('escort failed');
  });

  it('summary payload carries the distinct escort failReason', () => {
    const escort = getEscortMinion(gameState);
    damageMinion(escort, escort.maxHp);
    updateMinions();

    expect(gameState.run.status).toBe('failed');
    const summary = buildRunSummary('failed');
    expect(summary.failReason).toBe('Archivist Vale was lost — escort failed');
  });
});

describe('escort destination complete', () => {
  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
    deployEscortRun(gameState);
  });

  it('reaches victory on arrival while ambush enemies are still alive', () => {
    const escort = getEscortMinion(gameState);
    expect(gameState.enemies.some((enemy) => enemy.hp > 0)).toBe(true);
    expect(gameState.run.scriptedEncounter.rooms['room:0'].cleared).toBe(false);
    expect(gameState.run.objective.defeatedEnemies).toBeLessThan(
      gameState.run.objective.totalEnemies,
    );

    const dais = gameState.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    escort.x = dais.x;
    escort.z = dais.z;

    tickEscort(gameState);
    expect(isEscortAtDestination(gameState.run, gameState.layout, escort)).toBe(true);
    expect(gameState.run.objective.reachedDestination).toBe(true);
    expect(isRunObjectiveComplete(gameState.run.objective)).toBe(true);

    expect(gameState.enemies.some((enemy) => enemy.hp > 0)).toBe(true);
    expect(gameState.run.scriptedEncounter.rooms['room:0'].cleared).toBe(false);
    expect(gameState.run.status).toBe('victory');
  });

  it('keeps HUD enemy-progress fields on the objective after arrival victory', () => {
    const escort = getEscortMinion(gameState);
    const dais = gameState.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    escort.x = dais.x;
    escort.z = dais.z;

    tickEscort(gameState);
    expect(gameState.run.status).toBe('victory');
    expect(gameState.run.objective.totalEnemies).toBeGreaterThan(0);
    expect(gameState.run.objective.defeatedEnemies).toBe(0);
  });

  it('lobby run summary path reports victory on arrival', () => {
    const escort = getEscortMinion(gameState);
    const dais = gameState.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    escort.x = dais.x;
    escort.z = dais.z;

    tickEscort(gameState);
    expect(gameState.run.status).toBe('victory');

    const summary = buildRunSummary(gameState.run.status);
    expect(summary.status).toBe('victory');
    expect(summary.objective.reachedDestination).toBe(true);
    expect(summary.failReason).toBeNull();
  });
});

describe('escort follow with nearby living enemy', () => {
  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
    deployEscortRun(gameState);
  });

  it('follows the player onto the dais while a wave-0 grunt remains alive', () => {
    const dais = gameState.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    const destination = gameState.run.escort.destination;
    const escort = getEscortMinion(gameState);

    gameState.players.p1.x = dais.x;
    gameState.players.p1.z = dais.z;

    const startX = destination.x + ESCORT_DESTINATION_RADIUS + 4.5;
    escort.x = startX;
    escort.z = destination.z;

    expect(gameState.enemies.some((enemy) => enemy.hp > 0)).toBe(true);
    expect(gameState.run.scriptedEncounter.rooms['room:0'].cleared).toBe(false);

    const startDistToDais = Math.abs(startX - destination.x);

    for (let i = 0; i < 120; i++) {
      updateEnemies();
      updateMinions();
    }

    expect(Math.abs(escort.x - destination.x)).toBeLessThan(startDistToDais);
    expect(isEscortAtDestination(gameState.run, gameState.layout, escort)).toBe(true);

    tickEscort(gameState);
    expect(gameState.run.status).toBe('victory');
  });

  it('holds position when a grunt within range has LOS and targets the escort', () => {
    const dais = gameState.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    const escort = getEscortMinion(gameState);
    const grunt = gameState.enemies.find((enemy) => enemy.hp > 0);
    expect(grunt).toBeTruthy();

    gameState.players.p1.x = dais.x;
    gameState.players.p1.z = dais.z;

    grunt.x = 0;
    grunt.z = 0;
    escort.x = 2;
    escort.z = 0;

    const startX = escort.x;
    const startZ = escort.z;

    for (let i = 0; i < 40; i++) {
      updateEnemies();
      updateMinions();
    }

    expect(Math.abs(escort.x - startX)).toBeLessThan(0.5);
    expect(Math.abs(escort.z - startZ)).toBeLessThan(0.5);
  });
});

describe('escort stall fail safeguard', () => {
  const TEST_STALL_MS = 1000;

  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
    deployEscortRun(gameState);
    gameState.enemies = [];
    setEscortStallFailMsForTests(TEST_STALL_MS);
  });

  afterEach(() => {
    setEscortStallFailMsForTests();
  });

  it('fails the run when squad waits at destination and escort stays pinned', () => {
    const dais = gameState.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    const destination = gameState.run.escort.destination;
    const escort = getEscortMinion(gameState);

    gameState.players.p1.x = dais.x;
    gameState.players.p1.z = dais.z;

    const pinnedX = destination.x + ESCORT_DESTINATION_RADIUS + 4;
    escort.x = pinnedX;
    escort.z = destination.z;

    tickEscort(gameState);
    expect(gameState.run.status).toBe('playing');
    expect(gameState.run.escort.stallWaitStartedAt).not.toBeNull();

    gameState.run.escort.stallWaitStartedAt = simNow() - TEST_STALL_MS - 100;
    tickEscort(gameState);

    expect(gameState.run.status).toBe('failed');
    expect(gameState.run.escort.failed).toBe(true);
    expect(gameState.run.objective.label).toContain('Archivist Vale failed to reach extraction');
    expect(gameState.run.objective.label).toContain('escort stalled');
    const summary = buildRunSummary('failed');
    expect(summary.failReason).toContain('stalled');
  });

  it('resets stall progress when the escort moves closer to the destination', () => {
    const dais = gameState.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    const destination = gameState.run.escort.destination;
    const escort = getEscortMinion(gameState);

    gameState.players.p1.x = dais.x;
    gameState.players.p1.z = dais.z;

    escort.x = destination.x + ESCORT_DESTINATION_RADIUS + 6;
    escort.z = destination.z;
    tickEscort(gameState);
    expect(gameState.run.escort.stallWaitStartedAt).not.toBeNull();

    gameState.run.escort.stallWaitStartedAt = simNow() - TEST_STALL_MS - 100;
    escort.x = destination.x + ESCORT_DESTINATION_RADIUS + 2;
    tickEscort(gameState);

    expect(gameState.run.status).toBe('playing');
    expect(gameState.run.escort.stallWaitStartedAt).not.toBeNull();
    expect(simNow() - gameState.run.escort.stallWaitStartedAt).toBeLessThan(TEST_STALL_MS);
  });

  it('resets stall progress when the squad leaves the destination wait zone', () => {
    const dais = gameState.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    const destination = gameState.run.escort.destination;
    const escort = getEscortMinion(gameState);

    gameState.players.p1.x = dais.x;
    gameState.players.p1.z = dais.z;
    escort.x = destination.x + ESCORT_DESTINATION_RADIUS + 4;
    escort.z = destination.z;

    tickEscort(gameState);
    expect(gameState.run.escort.stallWaitStartedAt).not.toBeNull();

    gameState.players.p1.x = destination.x + ESCORT_DESTINATION_RADIUS + 20;
    tickEscort(gameState);

    expect(gameState.run.escort.stallWaitStartedAt).toBeNull();
    expect(gameState.run.status).toBe('playing');
  });
});

describe('escort checkpoint round-trip', () => {
  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
    deployEscortRun(gameState);
    gameState.players.p1.ready = true;
    gameState.players.p1.connected = true;
  });

  it('preserves escort state alongside scriptedEncounter', () => {
    const escort = getEscortMinion(gameState);
    escort.x = 7;
    escort.z = -3;
    const savedEscortId = gameState.run.escort.minionId;

    suspendRunToLobby();
    expect(gameState.suspendedCheckpoint.run.escort).toBeDefined();
    expect(gameState.suspendedCheckpoint.run.scriptedEncounter).toBeDefined();

    gameState.players.p1.ready = true;
    checkAllReady();

    expect(gameState.run.escort.minionId).toBe(savedEscortId);
    const restoredEscort = getEscortMinion(gameState);
    expect(restoredEscort.x).toBe(7);
    expect(restoredEscort.z).toBe(-3);
  });
});
