import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
} from '../progression.js';
import { getObjectiveDef } from '../objectives.js';
import { countAuthoredScriptedEnemies } from '../scriptedEncounters.js';
import { getDialogueBeacons } from '../questDialogue.js';

const require = createRequire(import.meta.url);
const CARD_DEFS = require('../../shared/cardDefs.json');
const {
  getQuest,
  getScriptedEncounterConfig,
  countScriptedEnemiesInQuest,
  countFinalAmbushEnemies,
  formatObjectiveSummary,
  getLayoutProfileForQuest,
  getLayoutGenerationOptions,
  QUEST_DEFS,
} = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');

const TIER1_QUESTS = ['training_caverns', 'crystal_rescue', 'frost_crossing'];
const TIER = 1;

function tier1Quest(questId) {
  return getQuest(questId, TIER);
}

function waveEnemyCount(wave) {
  if (!Array.isArray(wave?.spawns)) return 0;
  return wave.spawns.reduce((sum, spawn) => {
    const count = Number.isFinite(spawn?.count) ? spawn.count : 1;
    return sum + Math.max(1, Math.floor(count));
  }, 0);
}

function maxWaveEnemyCount(quest) {
  const config = getScriptedEncounterConfig(quest);
  if (!config) return 0;
  let max = 0;
  for (const room of config.rooms) {
    for (const wave of room.waves ?? []) {
      max = Math.max(max, waveEnemyCount(wave));
    }
  }
  const ambushSpawns = quest.finalAmbush?.spawns;
  if (Array.isArray(ambushSpawns)) {
    max = Math.max(max, waveEnemyCount({ spawns: ambushSpawns }));
  }
  return max;
}

function totalAuthoredPlusAmbush(quest) {
  return countAuthoredScriptedEnemies(quest) + countFinalAmbushEnemies(quest);
}

function firstWaveSpawns(quest) {
  const config = getScriptedEncounterConfig(quest);
  const startRoom = config.rooms.find((room) => Number.isInteger(room.roomIndex) && room.roomIndex === 0)
    ?? config.rooms[0];
  return startRoom.waves[0].spawns;
}

function expectedFirstWaveCount(quest) {
  return waveEnemyCount({ spawns: firstWaveSpawns(quest) });
}

function deployQuest(state, questId, seed = questLayoutSeed(questId, TIER)) {
  const quest = tier1Quest(questId);
  const layout = generateLayout(
    seed,
    getLayoutProfileForQuest(questId, TIER),
    getLayoutGenerationOptions(questId, TIER),
  );
  const startRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];

  state.selectedQuestId = questId;
  state.selectedQuestTier = TIER;
  state.layout = layout;
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.minions = [];
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
  return { layout, quest, seed };
}

describe('tier-1 scripted arcs — cross-quest validation', () => {
  it.each(TIER1_QUESTS)('%s skips bulk combat spawn and exposes scripted encounter config', (questId) => {
    const quest = tier1Quest(questId);
    const def = getObjectiveDef(quest.objectiveType);

    expect(getScriptedEncounterConfig(quest)).not.toBeNull();
    expect(def.skipBulkCombatSpawn(quest)).toBe(true);
    expect(QUEST_DEFS[questId].enemyPool.length).toBeGreaterThan(0);
  });

  it.each(TIER1_QUESTS)('%s deploy spawns only authored wave-0 hostiles (no enemyPool bulk)', (questId) => {
    const state = createGameState();
    const { quest } = deployQuest(state, questId);
    const expectedCount = expectedFirstWaveCount(quest);
    const expectedTypes = firstWaveSpawns(quest).flatMap((spawn) => {
      const count = Number.isFinite(spawn.count) ? spawn.count : 1;
      return Array(Math.max(1, Math.floor(count))).fill(spawn.type);
    }).sort();

    if (questId === 'frost_crossing') {
      expect(state.enemies).toHaveLength(expectedCount + 1);
      expect(state.enemies.filter((enemy) => enemy.scriptedWave)).toHaveLength(expectedCount);
      expect(state.enemies.some((enemy) => enemy.type === 'permafrost_warden')).toBe(true);
      expect(
        state.enemies
          .filter((enemy) => enemy.scriptedWave)
          .map((enemy) => enemy.type)
          .sort(),
      ).toEqual(expectedTypes);
    } else {
      expect(state.enemies).toHaveLength(expectedCount);
      expect(state.enemies.every((enemy) => enemy.scriptedWave)).toBe(true);
      expect(state.enemies.map((enemy) => enemy.type).sort()).toEqual(expectedTypes);
    }
    expect(state.run.scriptedEncounter).toBeDefined();
  });

  it('keeps three distinct arc fingerprints (objectives, rewards, briefings, beacons)', () => {
    const variants = TIER1_QUESTS.map((questId) => {
      const quest = tier1Quest(questId);
      const beacons = getDialogueBeacons(quest);
      return {
        questId,
        objectiveSummary: formatObjectiveSummary(quest),
        rewardCardId: quest.rewardCardId,
        clientNpc: quest.clientNpc,
        briefing: quest.briefing,
        beaconIds: beacons.map((b) => b.beaconId).sort().join(','),
      };
    });

    expect(new Set(variants.map((v) => v.objectiveSummary)).size).toBe(3);
    expect(new Set(variants.map((v) => v.rewardCardId)).size).toBe(3);
    expect(new Set(variants.map((v) => v.clientNpc)).size).toBe(3);
    expect(new Set(variants.map((v) => v.briefing)).size).toBe(3);
    expect(new Set(variants.map((v) => v.beaconIds)).size).toBe(3);

    for (const variant of variants) {
      expect(CARD_DEFS[variant.rewardCardId]).toBeDefined();
    }
  });

  it('training_caverns tier 1 wires passage locks for the tutorial gate chain', () => {
    const quest = tier1Quest('training_caverns');
    const config = getScriptedEncounterConfig(quest);

    expect(config.passageLocks).toHaveLength(2);
    expect(countScriptedEnemiesInQuest(quest)).toBe(6);

    const state = createGameState();
    deployQuest(state, 'training_caverns');
    expect(state.run.passageLocks?.length).toBeGreaterThan(0);
    expect(state.run.passageLocks.every((lock) => lock.locked)).toBe(true);
    expect(state.run.objective.totalEnemies).toBe(6);
  });

  it('crystal_rescue tier 1 wires extraction phase and final ambush after guard waves', () => {
    const quest = tier1Quest('crystal_rescue');

    expect(quest.extractionDestination).toEqual({ roomRole: 'start' });
    expect(quest.finalAmbush?.spawns?.length).toBeGreaterThan(0);
    expect(countScriptedEnemiesInQuest(quest)).toBe(6);
    expect(countFinalAmbushEnemies(quest)).toBe(3);

    const state = createGameState();
    deployQuest(state, 'crystal_rescue');
    expect(state.run.objective.totalEnemies).toBe(6);
    expect(state.run.objective.requiresExtraction).toBe(true);
    expect(state.run.objective.extractionPhase).toBe(false);
    expect(state.run.finalAmbush).toBeUndefined();
  });

  it('frost_crossing tier 1 wires ice-band passage lock and ranged set-piece waves', () => {
    const quest = tier1Quest('frost_crossing');
    const config = getScriptedEncounterConfig(quest);
    const iceRoom = config.rooms.find((room) => room.band === 'ice');

    expect(config.passageLocks).toHaveLength(1);
    expect(iceRoom).toBeDefined();
    expect(iceRoom.waves).toHaveLength(2);

    const state = createGameState();
    deployQuest(state, 'frost_crossing');
    expect(state.run.passageLocks?.length).toBeGreaterThan(0);
    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.run.objective.totalEnemies).toBe(1);
    expect(state.enemies).toHaveLength(3);
    expect(state.enemies.some((enemy) => enemy.type === 'permafrost_warden')).toBe(true);
  });

  it.each(TIER1_QUESTS)('%s stays solo-clearable (≤12 hostiles, no wave >3)', (questId) => {
    const quest = tier1Quest(questId);
    expect(totalAuthoredPlusAmbush(quest)).toBeLessThanOrEqual(12);
    expect(maxWaveEnemyCount(quest)).toBeLessThanOrEqual(3);
  });
});
