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
} from '../progression.js';
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
const { countAuthoredScriptedEnemies } = require('../scriptedEncounters.js');

const QUEST_ID = 'training_caverns';
const TIER = 1;
const SEED = questLayoutSeed(QUEST_ID, TIER);

function trainingCavernsLayout(seed = SEED) {
  return generateLayout(
    seed,
    getLayoutProfileForQuest(QUEST_ID, TIER),
    getLayoutGenerationOptions(QUEST_ID, TIER),
  );
}

function deployTrainingCaverns(state, seed = SEED) {
  const layout = trainingCavernsLayout(seed);
  const startRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];
  const vaultRoom = layout.rooms[2] ?? layout.rooms[layout.rooms.length - 1];

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
  return { layout, startRoom, vaultRoom };
}

function killScriptedWave(state, roomIndex, waveIndex) {
  const roomKey = `room:${roomIndex}`;
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

describe('training_caverns tier 1 scripted named rare — Vault Stalker', () => {
  it('uses scriptedEncounters only, bypasses bulk spawn, and sets defeat_enemies total', () => {
    const quest = getQuest(QUEST_ID, TIER);
    const def = getObjectiveDef('defeat_enemies');

    expect(getQuestScript(quest)).toBeNull();
    expect(countAuthoredScriptedEnemies(quest)).toBe(6);
    expect(countScriptedEnemiesInQuest(quest)).toBe(6);
    expect(def.skipBulkCombatSpawn(quest)).toBe(true);

    const state = createGameState();
    deployTrainingCaverns(state);
    expect(state.run.objective.totalEnemies).toBe(6);
    expect(state.enemies).toHaveLength(2);
    expect(state.run.scriptedEncounter).toBeDefined();
    expect(state.run.waveScript).toBeUndefined();
  });

  it('authors Vault Stalker in the final vault room', () => {
    const quest = getQuest(QUEST_ID, TIER);
    const vaultRoom = quest.scriptedEncounters.rooms.find((room) => room.roomIndex === 2);
    const namedSpawn = vaultRoom.waves[0].spawns.find((spawn) => spawn.namedRare);

    expect(namedSpawn).toMatchObject({
      type: 'grunt',
      count: 1,
      namedRare: {
        id: 'annex_vault_stalker',
        displayName: 'Vault Stalker',
        variantId: 'warded',
      },
    });
  });

  it('spawns Vault Stalker when the player enters the vault wing', () => {
    const state = createGameState();
    const { layout, vaultRoom } = deployTrainingCaverns(state);

    expect(state.enemies.some((enemy) => enemy.displayName === 'Vault Stalker')).toBe(false);

    killScriptedWave(state, 0, 0);
    enterRoom(state, layout.rooms[1]);
    killScriptedWave(state, 1, 0);
    enterRoom(state, vaultRoom);

    const stalker = state.enemies.find((enemy) => enemy.displayName === 'Vault Stalker');
    expect(stalker).toBeTruthy();
    expect(stalker.type).toBe('grunt');
    expect(stalker.namedRareId).toBe('annex_vault_stalker');
    expect(stalker.variant).toBe('warded');
    expect(stalker.shieldHp).toBeGreaterThan(0);

    const snapEnemy = stateSnapshot().enemies.find((entry) => entry.id === stalker.id);
    expect(snapEnemy.displayName).toBe('Vault Stalker');
    expect(snapEnemy.namedRareId).toBe('annex_vault_stalker');
    expect(snapEnemy.variant).toBe('warded');

    const startPositions = new Set(
      state.enemies
        .filter((enemy) => enemy.scriptedWave?.roomKey === 'room:0')
        .map((enemy) => `${enemy.x},${enemy.z}`),
    );
    expect(startPositions.has(`${stalker.x},${stalker.z}`)).toBe(false);
  });

  it('completes the scripted defeat_enemies objective after all rooms are cleared', () => {
    const state = createGameState();
    const { layout, vaultRoom } = deployTrainingCaverns(state);

    killScriptedWave(state, 0, 0);
    enterRoom(state, layout.rooms[1]);
    killScriptedWave(state, 1, 0);
    enterRoom(state, vaultRoom);

    for (const enemy of [...state.enemies]) {
      enemy.hp = 0;
    }
    cleanupAfterDamage();

    expect(state.run.objective.defeatedEnemies).toBe(6);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);
  });

  it('does not author Vault Stalker on frost_crossing or ember_descent', () => {
    for (const questId of ['frost_crossing', 'ember_descent']) {
      const quest = getQuest(questId, 1);
      const serialized = JSON.stringify(quest.scriptedEncounters ?? {});
      expect(serialized).not.toContain('Vault Stalker');
      expect(serialized).not.toContain('annex_vault_stalker');
    }
  });
});
