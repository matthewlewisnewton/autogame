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

const QUEST_ID = 'ember_descent';
const TIER = 1;
const SEED = questLayoutSeed(QUEST_ID, TIER);

function fireCavernLayout(seed = SEED) {
  return generateLayout(
    seed,
    getLayoutProfileForQuest(QUEST_ID, TIER),
    getLayoutGenerationOptions(QUEST_ID, TIER),
  );
}

function deployEmberDescent(state) {
  const layout = fireCavernLayout();
  const startRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];
  const basinRoom = layout.rooms.find((room) => room.band === 'basin');

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
  return { layout, startRoom, basinRoom };
}

describe('ember_descent tier 1 scripted named rare — Cinderghast', () => {
  it('defines script.waves, bypasses bulk spawn, and sets defeat_enemies total to spawn count', () => {
    const quest = getQuest(QUEST_ID, TIER);
    const script = getQuestScript(quest);
    const def = getObjectiveDef('defeat_enemies');

    expect(script).not.toBeNull();
    expect(script.waves).toHaveLength(2);
    expect(countScriptedEnemies(script)).toBe(6);
    expect(def.skipBulkCombatSpawn(quest)).toBe(true);

    const state = createGameState();
    deployEmberDescent(state);
    expect(state.run.objective.totalEnemies).toBe(6);
    expect(state.enemies).toHaveLength(5);
  });

  it('spawns Cinderghast in the inner basin with namedRare fields and airborne behavior in snapshots', () => {
    const state = createGameState();
    const { basinRoom } = deployEmberDescent(state);
    const script = getQuestScript(getQuest(QUEST_ID, TIER));
    const cinderghastSpawn = script.waves[1].spawns[0];

    expect(cinderghastSpawn).toMatchObject({
      type: 'ember_wraith',
      variant: {
        name: 'Cinderghast',
        hpMult: 1.5,
        damageMult: 1.25,
        tint: '#f97316',
        scaleMult: 1.1,
        drop: { cardId: 'dragons_breath' },
      },
    });
    expect(script.waves[1].room).toEqual({ x: basinRoom.x, z: basinRoom.z });
    expect(state.enemies.some((enemy) => enemy.namedRare?.name === 'Cinderghast')).toBe(false);

    state.players.p1.x = basinRoom.x;
    state.players.p1.z = basinRoom.z;
    updateQuestScriptTriggers();

    const cinderghast = state.enemies.find((enemy) => enemy.namedRare?.name === 'Cinderghast');
    expect(cinderghast).toBeTruthy();
    expect(cinderghast.type).toBe('ember_wraith');
    expect(cinderghast.variant).toBeNull();
    expect(cinderghast.flying).toBe(true);
    expect(cinderghast.altitude).toBe(ENEMY_DEFS.ember_wraith.altitude);

    const base = ENEMY_DEFS.ember_wraith;
    expect(cinderghast.hp).toBe(Math.round(base.hp * 1.5));
    expect(cinderghast.attackDamage).toBe(Math.round(base.attackDamage * 1.25));

    const snapEnemy = stateSnapshot().enemies.find((entry) => entry.id === cinderghast.id);
    expect(snapEnemy.namedRare).toEqual({
      id: 'cinderghast',
      name: 'Cinderghast',
      tint: '#f97316',
      scaleMult: 1.1,
      drop: { cardId: 'dragons_breath' },
    });
    expect(snapEnemy.type).toBe('ember_wraith');
    expect(snapEnemy.flying).toBe(true);
    expect(snapEnemy.altitude).toBe(base.altitude);

    const startPositions = new Set(
      script.waves[0].spawns.map((spawn) => `${spawn.x},${spawn.z}`),
    );
    expect(startPositions.has(`${cinderghast.x},${cinderghast.z}`)).toBe(false);
  });

  it('grants dragons_breath on first Cinderghast kill only once per run', () => {
    const state = createGameState();
    const { basinRoom } = deployEmberDescent(state);

    state.players.p1.x = basinRoom.x;
    state.players.p1.z = basinRoom.z;
    updateQuestScriptTriggers();

    const cinderghast = state.enemies.find((enemy) => enemy.namedRare?.name === 'Cinderghast');
    cinderghast.lastDamagedBy = 'p1';
    cinderghast.hp = 0;
    cleanupAfterDamage();

    expect(state.run.namedRareDropsClaimed).toEqual(['cinderghast']);
    expect(state.players.p1.runCardDropIds).toContain('dragons_breath');

    const dropsAfterFirst = state.players.p1.runCardDropIds.filter((id) => id === 'dragons_breath').length;

    const script = getQuestScript(getQuest(QUEST_ID, TIER));
    const spawn = script.waves[1].spawns[0];
    const respawn = spawnEnemy(spawn.x, spawn.z, spawn.type, undefined, {
      namedRareVariant: spawn.variant,
    });
    respawn.lastDamagedBy = 'p1';
    respawn.hp = 0;
    cleanupAfterDamage();

    const dropsAfterSecond = state.players.p1.runCardDropIds.filter((id) => id === 'dragons_breath').length;
    expect(dropsAfterSecond).toBe(dropsAfterFirst);
    expect(state.run.namedRareDropsClaimed).toEqual(['cinderghast']);
  });

  it('completes the scripted defeat_enemies objective after all waves are cleared', () => {
    const state = createGameState();
    const { basinRoom } = deployEmberDescent(state);

    for (const enemy of [...state.enemies]) {
      enemy.hp = 0;
    }
    cleanupAfterDamage();

    state.players.p1.x = basinRoom.x;
    state.players.p1.z = basinRoom.z;
    updateQuestScriptTriggers();

    for (const enemy of [...state.enemies]) {
      enemy.hp = 0;
    }
    cleanupAfterDamage();

    expect(state.run.objective.defeatedEnemies).toBe(6);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);
  });

  it('does not author Cinderghast on other quests', () => {
    for (const questId of ['training_caverns', 'frost_crossing']) {
      const script = getQuestScript(getQuest(questId, 1));
      const serialized = JSON.stringify(script ?? {});
      expect(serialized).not.toContain('Cinderghast');
      expect(serialized).not.toContain('cinderghast');
    }
  });
});
