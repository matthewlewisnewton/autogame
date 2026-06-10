import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { getObjectiveDef, isValidObjectiveType } from '../objectives.js';
import {
  gameState,
  resetGameState,
  setGameState,
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  suspendRunToLobby,
  checkAllReady,
  isRunObjectiveComplete,
  checkRunTerminalState,
  updateMinions,
  damageMinion,
} from '../index.js';
import { setGameState as setSimulationGameState } from '../simulation.js';
import {
  getEscortMinion,
  isEscortAtDestination,
  tickEscort,
} from '../escort.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS, ESCORT_OBJECTIVE_FIXTURE_DEF, formatObjectiveSummary } = require('../quests.js');

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
});

describe('escort destination complete', () => {
  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
    deployEscortRun(gameState);
  });

  it('completes when waves are cleared and escort reaches the destination', () => {
    const escort = getEscortMinion(gameState);
    for (const enemy of gameState.enemies) {
      enemy.hp = 0;
    }
    removeDeadEnemies();
    expect(gameState.run.scriptedEncounter.rooms['room:0'].cleared).toBe(true);

    const dais = gameState.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    escort.x = dais.x;
    escort.z = dais.z;

    tickEscort(gameState);
    expect(isEscortAtDestination(gameState.run, gameState.layout, escort)).toBe(true);
    expect(gameState.run.objective.reachedDestination).toBe(true);
    expect(isRunObjectiveComplete(gameState.run.objective)).toBe(true);

    checkRunTerminalState();
    expect(gameState.run.status).toBe('victory');
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
