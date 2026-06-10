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

function deployFrostCrossing(state) {
  const layout = iceCavernLayout();
  const startRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];
  const iceRoom = layout.rooms.find((room) => room.band === 'ice');

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
  return { layout, startRoom, iceRoom };
}

function waveState(state, waveId) {
  return state.run.waveScript.waves.find((wave) => wave.id === waveId);
}

function enemiesForWave(state, waveId) {
  const ids = new Set(waveState(state, waveId).spawnedEnemyIds);
  return state.enemies.filter((enemy) => ids.has(enemy.id));
}

describe('frost_crossing tier 1 scripted named rare — Frostmaw', () => {
  it('defines script.waves, bypasses bulk spawn, and sets defeat_enemies total to spawn count', () => {
    const quest = getQuest(QUEST_ID, TIER);
    const script = getQuestScript(quest);
    const def = getObjectiveDef('defeat_enemies');

    expect(script).not.toBeNull();
    expect(script.waves).toHaveLength(2);
    expect(countScriptedEnemies(script)).toBe(6);
    expect(def.skipBulkCombatSpawn(quest)).toBe(true);

    const state = createGameState();
    deployFrostCrossing(state);
    expect(state.run.objective.totalEnemies).toBe(6);
    expect(state.enemies).toHaveLength(5);
  });

  it('spawns Frostmaw on the ice field with namedRare fields in snapshots', () => {
    const state = createGameState();
    const { iceRoom } = deployFrostCrossing(state);
    const script = getQuestScript(getQuest(QUEST_ID, TIER));
    const frostmawSpawn = script.waves[1].spawns[0];

    expect(frostmawSpawn).toMatchObject({
      type: 'glacial_thrower',
      variant: {
        name: 'Frostmaw',
        hpMult: 1.6,
        damageMult: 1.3,
        tint: '#7dd3fc',
        scaleMult: 1.15,
        drop: { cardId: 'permafrost_lance' },
      },
    });
    expect(state.enemies.some((enemy) => enemy.namedRare?.name === 'Frostmaw')).toBe(false);

    state.players.p1.x = iceRoom.x;
    state.players.p1.z = iceRoom.z;
    updateQuestScriptTriggers();

    const frostmaw = state.enemies.find((enemy) => enemy.namedRare?.name === 'Frostmaw');
    expect(frostmaw).toBeTruthy();
    expect(frostmaw.type).toBe('glacial_thrower');
    expect(frostmaw.variant).toBeNull();

    const base = ENEMY_DEFS.glacial_thrower;
    expect(frostmaw.hp).toBe(Math.round(base.hp * 1.6));
    expect(frostmaw.attackDamage).toBe(Math.round(base.attackDamage * 1.3));

    const snapEnemy = stateSnapshot().enemies.find((entry) => entry.id === frostmaw.id);
    expect(snapEnemy.namedRare).toEqual({
      id: 'frostmaw',
      name: 'Frostmaw',
      tint: '#7dd3fc',
      scaleMult: 1.15,
      drop: { cardId: 'permafrost_lance' },
    });
    expect(snapEnemy.type).toBe('glacial_thrower');

    const startPositions = new Set(
      script.waves[0].spawns.map((spawn) => `${spawn.x},${spawn.z}`),
    );
    expect(startPositions.has(`${frostmaw.x},${frostmaw.z}`)).toBe(false);
  });

  it('grants permafrost_lance on first Frostmaw kill only once per run', () => {
    const state = createGameState();
    const { iceRoom } = deployFrostCrossing(state);

    state.players.p1.x = iceRoom.x;
    state.players.p1.z = iceRoom.z;
    updateQuestScriptTriggers();

    const frostmaw = state.enemies.find((enemy) => enemy.namedRare?.name === 'Frostmaw');
    frostmaw.lastDamagedBy = 'p1';
    frostmaw.hp = 0;
    cleanupAfterDamage();

    expect(state.run.namedRareDropsClaimed).toEqual(['frostmaw']);
    expect(state.players.p1.runCardDropIds).toContain('permafrost_lance');

    const dropsAfterFirst = state.players.p1.runCardDropIds.filter((id) => id === 'permafrost_lance').length;

    const script = getQuestScript(getQuest(QUEST_ID, TIER));
    const spawn = script.waves[1].spawns[0];
    const respawn = spawnEnemy(spawn.x, spawn.z, spawn.type, undefined, {
      namedRareVariant: spawn.variant,
    });
    respawn.lastDamagedBy = 'p1';
    respawn.hp = 0;
    cleanupAfterDamage();

    const dropsAfterSecond = state.players.p1.runCardDropIds.filter((id) => id === 'permafrost_lance').length;
    expect(dropsAfterSecond).toBe(dropsAfterFirst);
    expect(state.run.namedRareDropsClaimed).toEqual(['frostmaw']);
  });

  it('completes the scripted defeat_enemies objective after all waves are cleared', () => {
    const state = createGameState();
    const { iceRoom } = deployFrostCrossing(state);

    for (const enemy of [...state.enemies]) {
      enemy.hp = 0;
    }
    cleanupAfterDamage();

    state.players.p1.x = iceRoom.x;
    state.players.p1.z = iceRoom.z;
    updateQuestScriptTriggers();

    for (const enemy of [...state.enemies]) {
      enemy.hp = 0;
    }
    cleanupAfterDamage();

    expect(state.run.objective.defeatedEnemies).toBe(6);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);
  });

  it('does not author Frostmaw on other quests', () => {
    for (const questId of ['training_caverns', 'ember_descent']) {
      const script = getQuestScript(getQuest(questId, 1));
      const serialized = JSON.stringify(script ?? {});
      expect(serialized).not.toContain('Frostmaw');
      expect(serialized).not.toContain('frostmaw');
    }
  });
});
