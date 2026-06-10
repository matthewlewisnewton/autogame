import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  updateScriptedEncounters,
  cleanupAfterDamage,
  stateSnapshot,
  isRunObjectiveComplete,
  removeDeadEnemies,
  checkRunTerminalState,
} from '../progression.js';
import {
  ENCOUNTER_TRIGGER_RADIUS,
  tryActivateEncounter,
  isEncounterCleared,
} from '../encounters.js';
const require = createRequire(import.meta.url);
const {
  getQuest,
  getQuestScript,
  getLayoutProfileForQuest,
  getLayoutGenerationOptions,
  countScriptedEnemiesInQuest,
} = require('../quests.js');
const { ENEMY_DEFS, setGameState: setSimulationGameState } = require('../simulation.js');
const { getObjectiveDef } = require('../objectives.js');
const { getEncounterConfig } = require('../quests.js');
const {
  countAuthoredScriptedEnemies,
  findPassageIndicesFromRoom,
} = require('../scriptedEncounters.js');

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

function enterRoom(state, room) {
  state.players.p1.x = room.x;
  state.players.p1.z = room.z;
  updateScriptedEncounters();
}

describe('frost_crossing tier 1 scripted named rare — Rimecast the Slow', () => {
  it('uses scriptedEncounters with stage_boss objective and dormant cairn warden', () => {
    const quest = getQuest(QUEST_ID, TIER);
    const stageBossDef = getObjectiveDef('stage_boss');

    expect(getQuestScript(quest)).toBeNull();
    expect(quest.objectiveType).toBe('stage_boss');
    expect(getEncounterConfig(quest)).toMatchObject({
      bossType: 'permafrost_warden',
      landmark: 'ice_cairn',
      addCount: 0,
    });
    expect(countAuthoredScriptedEnemies(quest)).toBe(6);
    expect(countScriptedEnemiesInQuest(quest)).toBe(6);
    expect(stageBossDef.skipBulkCombatSpawn(quest)).toBe(true);
    expect(quest.scriptedEncounters.passageLocks).toHaveLength(1);

    const state = createGameState();
    const { layout } = deployFrostCrossing(state);
    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.run.objective.totalEnemies).toBe(1);
    expect(state.enemies).toHaveLength(3);
    expect(state.enemies.some((enemy) => enemy.type === 'permafrost_warden')).toBe(true);
    expect(state.run.encounter.bossEnemyId).toBeTruthy();
    expect(state.run.scriptedEncounter).toBeDefined();
    expect(state.run.waveScript).toBeUndefined();

    const dockPassages = findPassageIndicesFromRoom(layout, 0);
    expect(dockPassages.length).toBeGreaterThanOrEqual(1);
    expect(state.run.passageLocks).toHaveLength(dockPassages.length);
    expect(state.run.passageLocks.every((lock) => lock.locked)).toBe(true);
  });

  it('authors Rimecast the Slow on the final ice-band wave', () => {
    const quest = getQuest(QUEST_ID, TIER);
    const iceRoom = quest.scriptedEncounters.rooms.find((room) => room.band === 'ice');
    const throwerOffsets = iceRoom.waves[0].spawns.filter((spawn) => spawn.type === 'glacial_thrower');
    expect(throwerOffsets.length).toBeGreaterThanOrEqual(2);
    expect(throwerOffsets.every((spawn) => spawn.offset)).toBe(true);

    const namedSpawn = iceRoom.waves[1].spawns.find((spawn) => spawn.namedRare);
    expect(namedSpawn).toMatchObject({
      type: 'glacial_thrower',
      count: 1,
      namedRare: {
        id: 'frost_rimecast',
        displayName: 'Rimecast the Slow',
        variantId: 'frenzied',
        enemyType: 'glacial_thrower',
      },
    });
  });

  it('walks dock clear → lock opens → ice entry → Rimecast wave', () => {
    const state = createGameState();
    const { layout, iceRoom } = deployFrostCrossing(state);

    expect(state.enemies.some((enemy) => enemy.displayName === 'Rimecast the Slow')).toBe(false);
    expect(state.enemies.some((enemy) => enemy.type === 'glacial_thrower')).toBe(false);

    killScriptedWave(state, 'room:0', 0);
    expect(state.run.passageLocks.every((lock) => !lock.locked)).toBe(true);

    enterRoom(state, iceRoom);
    const throwers = state.enemies.filter((enemy) => enemy.type === 'glacial_thrower');
    expect(throwers.length).toBeGreaterThanOrEqual(2);
    expect(throwers.some((enemy) => enemy.displayName === 'Rimecast the Slow')).toBe(false);

    const dockPositions = new Set(
      state.enemies
        .filter((enemy) => enemy.scriptedWave?.roomKey === 'room:0')
        .map((enemy) => `${enemy.x},${enemy.z}`),
    );
    for (const thrower of throwers) {
      expect(dockPositions.has(`${thrower.x},${thrower.z}`)).toBe(false);
      const distFromIceCenter = Math.hypot(thrower.x - iceRoom.x, thrower.z - iceRoom.z);
      expect(distFromIceCenter).toBeGreaterThan(2);
    }

    killScriptedWave(state, 'band:ice', 0);
    expect(state.enemies.some((enemy) => enemy.displayName === 'Rimecast the Slow')).toBe(true);

    const rimecast = state.enemies.find((enemy) => enemy.displayName === 'Rimecast the Slow');
    expect(rimecast.type).toBe('glacial_thrower');
    expect(rimecast.namedRareId).toBe('frost_rimecast');
    expect(rimecast.variant).toBe('frenzied');

    const snapEnemy = stateSnapshot().enemies.find((entry) => entry.id === rimecast.id);
    expect(snapEnemy.displayName).toBe('Rimecast the Slow');
    expect(snapEnemy.namedRareId).toBe('frost_rimecast');
    expect(snapEnemy.type).toBe('glacial_thrower');
    expect(snapEnemy.variant).toBe('frenzied');
  });

  it('completes the stage_boss objective only after the Permafrost Warden is defeated', () => {
    const state = createGameState();
    const { iceRoom } = deployFrostCrossing(state);

    killScriptedWave(state, 'room:0', 0);
    enterRoom(state, iceRoom);
    killScriptedWave(state, 'band:ice', 0);
    killScriptedWave(state, 'band:ice', 1);

    for (const enemy of [...state.enemies]) {
      if (enemy.id !== state.run.encounter.bossEnemyId) enemy.hp = 0;
    }
    removeDeadEnemies();
    expect(isRunObjectiveComplete(state.run.objective)).toBe(false);

    const boss = state.enemies.find((enemy) => enemy.id === state.run.encounter.bossEnemyId);
    const anchor = state.run.encounter.spawnAnchor;
    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;
    tryActivateEncounter(state);
    boss.hp = 0;
    removeDeadEnemies();
    expect(isEncounterCleared(state.run)).toBe(true);
    cleanupAfterDamage();
    checkRunTerminalState();

    expect(state.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);
    expect(state.run.status).toBe('victory');
  });

  it('does not author Rimecast the Slow on other quests', () => {
    for (const questId of ['training_caverns', 'ember_descent']) {
      const quest = getQuest(questId, 1);
      const serialized = JSON.stringify(quest.scriptedEncounters ?? {})
        + JSON.stringify(getQuestScript(quest) ?? {});
      expect(serialized).not.toContain('Rimecast the Slow');
      expect(serialized).not.toContain('frost_rimecast');
    }
  });
});
