import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  setGameState,
  spawnEnemy,
  spawnEnemies,
  startDungeonRun,
  updateQuestScriptTriggers,
  cleanupAfterDamage,
  stateSnapshot,
  isRunObjectiveComplete,
} from '../progression.js';
const require = createRequire(import.meta.url);
const {
  getQuest,
  getQuestScript,
  getLayoutProfileForQuest,
  getLayoutGenerationOptions,
  countScriptedEnemies,
} = require('../quests.js');
const { ENEMY_DEFS, setGameState: setSimulationGameState } = require('../simulation.js');
const { getObjectiveDef } = require('../objectives.js');

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

function deepestCombatRoom(layout) {
  return layout.rooms
    .filter((room) => room.role === 'combat')
    .sort((a, b) => a.x - b.x || a.z - b.z)
    .pop();
}

function deployTrainingCaverns(state) {
  const layout = trainingCavernsLayout();
  const startRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];
  const vaultRoom = deepestCombatRoom(layout);

  state.selectedQuestId = QUEST_ID;
  state.selectedQuestTier = TIER;
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

describe('training_caverns tier 1 scripted named rare — Vault Marauder', () => {
  it('defines script.waves, bypasses bulk spawn, and sets defeat_enemies total to spawn count', () => {
    const quest = getQuest(QUEST_ID, TIER);
    const script = getQuestScript(quest);
    const def = getObjectiveDef('defeat_enemies');

    expect(script).not.toBeNull();
    expect(script.waves).toHaveLength(2);
    expect(countScriptedEnemies(script)).toBe(6);
    expect(def.skipBulkCombatSpawn(quest)).toBe(true);

    const state = createGameState();
    deployTrainingCaverns(state);
    expect(state.run.objective.totalEnemies).toBe(6);
    expect(state.enemies).toHaveLength(2);
    expect(state.run.waveScript).toBeDefined();
    expect(state.run.scriptedEncounter).toBeDefined();
  });

  it('spawns Vault Marauder in the deepest vault room with namedRare fields in snapshots', () => {
    const state = createGameState();
    const { vaultRoom } = deployTrainingCaverns(state);
    const script = getQuestScript(getQuest(QUEST_ID, TIER));
    const marauderSpawn = script.waves[1].spawns[0];

    expect(marauderSpawn).toMatchObject({
      type: 'grunt',
      variant: {
        name: 'Vault Marauder',
        hpMult: 1.5,
        damageMult: 1.25,
        tint: '#c9a227',
        scaleMult: 1.12,
        drop: { cardId: 'dungeon_drake' },
      },
    });
    expect(script.waves[1].room).toEqual({ x: vaultRoom.x, z: vaultRoom.z });
    expect(state.enemies.some((enemy) => enemy.namedRare?.name === 'Vault Marauder')).toBe(false);

    state.players.p1.x = vaultRoom.x;
    state.players.p1.z = vaultRoom.z;
    updateQuestScriptTriggers();

    const marauder = state.enemies.find((enemy) => enemy.namedRare?.name === 'Vault Marauder');
    expect(marauder).toBeTruthy();
    expect(marauder.type).toBe('grunt');
    expect(marauder.variant).toBeNull();

    const base = ENEMY_DEFS.grunt;
    expect(marauder.hp).toBe(Math.round(base.hp * 1.5));
    expect(marauder.attackDamage).toBe(Math.round(base.attackDamage * 1.25));

    const snapEnemy = stateSnapshot().enemies.find((entry) => entry.id === marauder.id);
    expect(snapEnemy.namedRare).toEqual({
      id: 'vault-marauder',
      name: 'Vault Marauder',
      tint: '#c9a227',
      scaleMult: 1.12,
      drop: { cardId: 'dungeon_drake' },
    });
    expect(snapEnemy.type).toBe('grunt');

    const startPositions = new Set(
      script.waves[0].spawns.map((spawn) => `${spawn.x},${spawn.z}`),
    );
    expect(startPositions.has(`${marauder.x},${marauder.z}`)).toBe(false);
  });

  it('grants dungeon_drake on first Vault Marauder kill only once per run', () => {
    const state = createGameState();
    const { vaultRoom } = deployTrainingCaverns(state);

    state.players.p1.x = vaultRoom.x;
    state.players.p1.z = vaultRoom.z;
    updateQuestScriptTriggers();

    const marauder = state.enemies.find((enemy) => enemy.namedRare?.name === 'Vault Marauder');
    marauder.lastDamagedBy = 'p1';
    marauder.hp = 0;
    cleanupAfterDamage();

    expect(state.run.namedRareDropsClaimed).toEqual(['vault-marauder']);
    expect(state.players.p1.runCardDropIds).toContain('dungeon_drake');

    const dropsAfterFirst = state.players.p1.runCardDropIds.filter((id) => id === 'dungeon_drake').length;

    const script = getQuestScript(getQuest(QUEST_ID, TIER));
    const spawn = script.waves[1].spawns[0];
    const respawn = spawnEnemy(spawn.x, spawn.z, spawn.type, undefined, {
      namedRareVariant: spawn.variant,
    });
    respawn.lastDamagedBy = 'p1';
    respawn.hp = 0;
    cleanupAfterDamage();

    const dropsAfterSecond = state.players.p1.runCardDropIds.filter((id) => id === 'dungeon_drake').length;
    expect(dropsAfterSecond).toBe(dropsAfterFirst);
    expect(state.run.namedRareDropsClaimed).toEqual(['vault-marauder']);
  });

  it('completes the scripted defeat_enemies objective after all waves are cleared', () => {
    const state = createGameState();
    const { vaultRoom } = deployTrainingCaverns(state);

    for (const enemy of [...state.enemies]) {
      enemy.hp = 0;
    }
    cleanupAfterDamage();

    state.players.p1.x = vaultRoom.x;
    state.players.p1.z = vaultRoom.z;
    updateQuestScriptTriggers();

    for (const enemy of [...state.enemies]) {
      enemy.hp = 0;
    }
    cleanupAfterDamage();

    expect(state.run.objective.defeatedEnemies).toBe(6);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);
  });

  it('does not author Vault Marauder on frost_crossing or ember_descent', () => {
    for (const questId of ['frost_crossing', 'ember_descent']) {
      const script = getQuestScript(getQuest(questId, 1));
      const serialized = JSON.stringify(script ?? {});
      expect(serialized).not.toContain('Vault Marauder');
      expect(serialized).not.toContain('vault-marauder');
    }
  });
});
