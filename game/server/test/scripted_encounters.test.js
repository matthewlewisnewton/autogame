import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import {
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  suspendRunToLobby,
  checkAllReady,
  gameState,
  resetGameState,
  setGameState,
} from '../index.js';
import { setGameState as setSimulationGameState } from '../simulation.js';
import { isScriptedQuest, countAuthoredScriptedEnemies } from '../scriptedEncounters.js';

const require = createRequire(import.meta.url);
const {
  QUEST_DEFS,
  SCRIPTED_ENCOUNTER_FIXTURE_DEF,
  getQuest,
  getScriptedEncounterConfig,
  getLayoutProfileForQuest,
} = require('../quests.js');

const FIXTURE_QUEST_ID = 'scripted_encounter_fixture';
const SEED = 4242;

function registerFixtureQuest() {
  QUEST_DEFS[FIXTURE_QUEST_ID] = SCRIPTED_ENCOUNTER_FIXTURE_DEF;
}

function deployScriptedFixture(seed = SEED) {
  gameState.selectedQuestId = FIXTURE_QUEST_ID;
  gameState.selectedQuestTier = 1;
  gameState.layout = generateLayout(seed, getLayoutProfileForQuest(FIXTURE_QUEST_ID, 1));
  gameState.layoutSeed = seed;
  gameState.enemies = [];
  gameState.loot = [];
  gameState.gamePhase = 'playing';
  gameState.players = {
    p1: {
      id: 'p1',
      x: gameState.layout.rooms[0].x,
      y: 0.5,
      z: gameState.layout.rooms[0].z,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
      ready: true,
      connected: true,
      hand: [{
        id: 'iron_sword',
        charges: 10,
        remainingCharges: 4,
      }],
    },
  };
  setGameState(gameState);
  setSimulationGameState(gameState);
  spawnEnemies();
  startDungeonRun();
  return gameState;
}

beforeAll(() => {
  registerFixtureQuest();
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('scripted encounter quest config', () => {
  beforeEach(() => {
    registerFixtureQuest();
  });

  it('parses scriptedEncounters on resolved quest objects', () => {
    const quest = getQuest(FIXTURE_QUEST_ID, 1);
    expect(quest).not.toBeNull();
    expect(getScriptedEncounterConfig(quest)).toEqual(
      SCRIPTED_ENCOUNTER_FIXTURE_DEF.tiers[1].scriptedEncounters,
    );
    expect(isScriptedQuest(quest)).toBe(true);
    expect(countAuthoredScriptedEnemies(quest)).toBe(3);
  });
});

describe('scripted wave sequencing', () => {
  beforeEach(() => {
    registerFixtureQuest();
    resetGameState();
    setSimulationGameState(gameState);
  });

  it('deploys wave 0 only and skips bulk enemyPool spawns', () => {
    deployScriptedFixture();
    expect(gameState.run.scriptedEncounter).toBeDefined();
    const roomState = gameState.run.scriptedEncounter.rooms['room:0'];
    expect(roomState.waveIndex).toBe(0);
    expect(roomState.enemyIds).toHaveLength(2);
    expect(gameState.enemies).toHaveLength(2);
    expect(gameState.enemies.every((enemy) => enemy.type === 'grunt')).toBe(true);
    expect(gameState.run.objective.totalEnemies).toBe(3);
    expect(gameState.run.objective.defeatedEnemies).toBe(0);
  });

  it('advances wave 0 to wave 1 when the active wave is cleared', () => {
    deployScriptedFixture();
    const roomState = () => gameState.run.scriptedEncounter.rooms['room:0'];

    for (const enemy of [...gameState.enemies]) {
      enemy.hp = 0;
    }
    removeDeadEnemies();

    expect(roomState().waveIndex).toBe(1);
    expect(roomState().enemyIds).toHaveLength(1);
    expect(gameState.enemies).toHaveLength(1);
    expect(gameState.enemies[0].type).toBe('skirmisher');
    expect(gameState.run.objective.defeatedEnemies).toBe(2);
  });

  it('keeps objective totals in sync through scripted kills', () => {
    deployScriptedFixture();

    gameState.enemies[0].hp = 0;
    removeDeadEnemies();
    expect(gameState.run.objective.defeatedEnemies).toBe(1);

    gameState.enemies[0].hp = 0;
    removeDeadEnemies();
    expect(gameState.run.objective.defeatedEnemies).toBe(2);

    gameState.enemies[0].hp = 0;
    removeDeadEnemies();
    expect(gameState.run.objective.defeatedEnemies).toBe(3);
    expect(gameState.run.scriptedEncounter.rooms['room:0'].cleared).toBe(true);
    expect(gameState.enemies).toHaveLength(0);
  });

  it('is deterministic for a fixed layout seed', () => {
    deployScriptedFixture(9001);
    const first = gameState.enemies.map((enemy) => ({
      type: enemy.type,
      x: enemy.x,
      z: enemy.z,
    }));

    resetGameState();
    setSimulationGameState(gameState);
    deployScriptedFixture(9001);
    const second = gameState.enemies.map((enemy) => ({
      type: enemy.type,
      x: enemy.x,
      z: enemy.z,
    }));

    expect(second).toEqual(first);
  });
});

describe('scripted encounter checkpoint round-trip', () => {
  beforeEach(() => {
    registerFixtureQuest();
    resetGameState();
    setSimulationGameState(gameState);
  });

  it('preserves scriptedEncounter state and re-links living wave enemy ids', () => {
    deployScriptedFixture();

    gameState.enemies[0].hp = 0;
    removeDeadEnemies();

    const survivingEnemyId = gameState.enemies[0].id;
    const checkpointEnemyIds = gameState.run.scriptedEncounter.rooms['room:0'].enemyIds.slice();
    const checkpointWaveIndex = gameState.run.scriptedEncounter.rooms['room:0'].waveIndex;
    const checkpointDefeated = gameState.run.objective.defeatedEnemies;

    suspendRunToLobby();

    expect(gameState.suspendedCheckpoint.run.scriptedEncounter).toBeDefined();
    expect(gameState.suspendedCheckpoint.run._scriptedEncounterConfig).toBeDefined();

    gameState.players.p1.ready = true;
    gameState.players.p1.connected = true;
    checkAllReady();

    const roomState = gameState.run.scriptedEncounter.rooms['room:0'];
    expect(roomState.waveIndex).toBe(checkpointWaveIndex);
    expect(roomState.enemyIds).toEqual(checkpointEnemyIds);
    expect(gameState.run.objective.defeatedEnemies).toBe(checkpointDefeated);
    expect(gameState.enemies).toHaveLength(1);
    expect(gameState.enemies[0].id).toBe(survivingEnemyId);
    expect(roomState.enemyIds).toContain(survivingEnemyId);
  });
});
