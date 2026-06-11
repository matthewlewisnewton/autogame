import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach } from 'vitest';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  updateScriptedEncounters,
  cleanupAfterDamage,
  removeDeadEnemies,
  isRunObjectiveComplete,
  checkRunTerminalState,
} from '../progression.js';
import {
  ENCOUNTER_PHASES,
  ENCOUNTER_TRIGGER_RADIUS,
  tryActivateEncounter,
  isEncounterCleared,
} from '../encounters.js';

const require = createRequire(import.meta.url);
const {
  getQuest,
  getEncounterConfig,
  formatObjectiveSummary,
  listQuestVariants,
  getLayoutProfileForQuest,
  getLayoutGenerationOptions,
} = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');

const QUEST_ID = 'frost_crossing';
const TIER = 1;
const SEED = questLayoutSeed(QUEST_ID, TIER);

function iceCavernLayout(seed = SEED) {
  return generateLayout(
    seed,
    getLayoutProfileForQuest(QUEST_ID, TIER),
    getLayoutGenerationOptions(QUEST_ID, TIER),
  );
}

function deployFrostCrossing(state, seed = SEED) {
  const layout = iceCavernLayout(seed);
  const startRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];
  const iceRoom = layout.rooms.find((room) => room.band === 'ice');

  state.selectedQuestId = QUEST_ID;
  state.selectedQuestTier = TIER;
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
      runCardDropIds: [],
      pendingSummons: new Set(),
    },
  };
  setGameState(state);
  setSimulationGameState(state);
  spawnEnemies();
  startDungeonRun();
  return { layout, startRoom, iceRoom };
}

function killScriptedWave(state, roomKey, waveIndex) {
  for (const enemy of [...state.enemies]) {
    if (
      enemy.scriptedWave?.roomKey === roomKey
      && enemy.scriptedWave?.waveIndex === waveIndex
    ) {
      enemy.hp = 0;
    }
  }
  removeDeadEnemies();
}

function killSingleScriptedEnemy(state, roomKey, waveIndex) {
  const target = state.enemies.find(
    (enemy) =>
      enemy.scriptedWave?.roomKey === roomKey
      && enemy.scriptedWave?.waveIndex === waveIndex,
  );
  expect(target).toBeDefined();
  target.hp = 0;
  removeDeadEnemies();
  return target;
}

function expectStageBossCounterUnchanged(state) {
  expect(state.run.objective).toMatchObject({
    defeatedEnemies: 0,
    totalEnemies: 1,
    bossDefeated: false,
  });
  expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
  expect(state.run.status).toBe('playing');
  expect(isRunObjectiveComplete(state.run.objective)).toBe(false);
}

function enterRoom(state, room) {
  state.players.p1.x = room.x;
  state.players.p1.z = room.z;
  updateScriptedEncounters();
}

function bossEnemy(state) {
  return state.enemies.find((e) => e.id === state.run.encounter.bossEnemyId);
}

function clearAllScriptedHostiles(state, iceRoom) {
  killScriptedWave(state, 'room:0', 0);
  enterRoom(state, iceRoom);
  killScriptedWave(state, 'band:ice', 0);
  killScriptedWave(state, 'band:ice', 1);
  for (const enemy of [...state.enemies]) {
    if (enemy.id !== state.run.encounter.bossEnemyId) enemy.hp = 0;
  }
  removeDeadEnemies();
}

function activateEncounterForTest(state) {
  const bossId = state.run.encounter.bossEnemyId;
  for (const enemy of state.enemies) {
    if (enemy.id !== bossId) enemy.hp = 0;
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  const anchor = state.run.encounter.spawnAnchor;
  const player = Object.values(state.players)[0];
  if (anchor && player) {
    player.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    player.z = anchor.z;
  }
  tryActivateEncounter(state);
}

describe('frost_crossing Tier 1 stage-boss catalog', () => {
  it('exposes stage_boss objective with permafrost encounter metadata', () => {
    const quest = getQuest(QUEST_ID, TIER);
    expect(quest.objectiveType).toBe('stage_boss');
    expect(getEncounterConfig(quest)).toMatchObject({
      bossType: 'permafrost_warden',
      landmark: 'ice_cairn',
      addCount: 0,
    });
    expect(quest.scriptedEncounters.passageLocks).toHaveLength(1);
    expect(quest.scriptedEncounters.rooms.some((room) => room.band === 'ice')).toBe(true);
  });

  it('uses permafrost-specific objective summary on the quest board', () => {
    const variant = listQuestVariants().find(
      (v) => v.questId === QUEST_ID && v.tier === TIER,
    );
    expect(variant.objectiveType).toBe('stage_boss');
    expect(variant.objectiveSummary).toBe(formatObjectiveSummary(getQuest(QUEST_ID, TIER)));
    expect(variant.objectiveSummary.toLowerCase()).toContain('permafrost warden');
  });
});

describe('frost_crossing Tier 1 deploy spawns', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
  });

  it('spawns scripted dock grunts plus one dormant permafrost_warden on ice_cairn', () => {
    const { layout } = deployFrostCrossing(state);
    const cairn = layout.landmarks.find((lm) => lm.type === 'ice_cairn');
    const boss = bossEnemy(state);
    const dockGrunts = state.enemies.filter(
      (e) => e.type === 'grunt' && e.scriptedWave?.roomKey === 'room:0',
    );

    expect(cairn).toBeDefined();
    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.run.encounter.bossEnemyId).toBe(boss.id);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(boss.type).toBe('permafrost_warden');
    expect(boss.x).toBe(cairn.x);
    expect(boss.z).toBe(cairn.z);
    expect(dockGrunts).toHaveLength(2);
    expect(state.enemies).toHaveLength(3);
    expect(state.run.scriptedEncounter).toBeDefined();
  });
});

describe('frost_crossing Tier 1 stage-boss encounter flow', () => {
  let state;
  let iceRoom;

  beforeEach(() => {
    state = createGameState();
    ({ iceRoom } = deployFrostCrossing(state));
  });

  it('activates the encounter after scripted clears when the player nears the cairn', () => {
    clearAllScriptedHostiles(state, iceRoom);
    expect(state.enemies).toHaveLength(1);
    activateEncounterForTest(state);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(state.run.encounter.locked).toBe(true);
  });

  it('completes the run with victory after the boss is defeated while active', () => {
    clearAllScriptedHostiles(state, iceRoom);
    activateEncounterForTest(state);
    bossEnemy(state).hp = 0;
    removeDeadEnemies();
    expect(isEncounterCleared(state.run)).toBe(true);
    expect(state.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);

    cleanupAfterDamage();
    checkRunTerminalState();
    expect(state.run.status).toBe('victory');
  });
});

describe('frost_crossing Tier 1 stage-boss objective counter regression', () => {
  let state;
  let iceRoom;

  beforeEach(() => {
    state = createGameState();
    ({ iceRoom } = deployFrostCrossing(state));
  });

  it('does not increment stage_boss defeatedEnemies when a scripted dock grunt is killed', () => {
    const grunt = killSingleScriptedEnemy(state, 'room:0', 0);
    expect(grunt.type).toBe('grunt');
    expectStageBossCounterUnchanged(state);
  });

  it('does not increment stage_boss defeatedEnemies when a scripted ice-band Glacial Thrower is killed', () => {
    killScriptedWave(state, 'room:0', 0);
    enterRoom(state, iceRoom);
    const thrower = killSingleScriptedEnemy(state, 'band:ice', 0);
    expect(thrower.type).toBe('glacial_thrower');
    expectStageBossCounterUnchanged(state);
  });
});
