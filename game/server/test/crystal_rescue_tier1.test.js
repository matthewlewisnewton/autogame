import { describe, it, expect, beforeEach } from 'vitest';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import {
  getQuest,
  countScriptedEnemiesInQuest,
  countFinalAmbushEnemies,
  getLayoutGenerationOptions,
  getLayoutProfileForQuest,
} from '../quests.js';
import {
  gameState,
  resetGameState,
  setGameState,
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  checkRunTerminalState,
  isRunObjectiveComplete,
  recordCrystalCollected,
  tickCollectItemsExtraction,
  updateScriptedEncounters,
} from '../index.js';
import { setGameState as setSimulationGameState } from '../simulation.js';

const QUEST_ID = 'crystal_rescue';
const TIER = 1;

function deployCrystalRescueRun(state, seed = questLayoutSeed(QUEST_ID, TIER)) {
  state.selectedQuestId = QUEST_ID;
  state.selectedQuestTier = TIER;
  const profile = getLayoutProfileForQuest(QUEST_ID, TIER);
  const options = getLayoutGenerationOptions(QUEST_ID, TIER);
  state.layout = generateLayout(seed, profile, options);
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.minions = [];
  const starterCard = {
    id: 'iron_sword',
    name: 'Rust-Forged Saber',
    type: 'weapon',
    charges: 5,
    remainingCharges: 5,
    grind: 0,
  };
  state.players = {
    p1: {
      x: 0,
      z: 0,
      y: 0.5,
      hp: 100,
      dead: false,
      extracted: false,
      deck: [starterCard],
      hand: [starterCard],
    },
  };
  state.gamePhase = 'playing';
  setGameState(state);
  setSimulationGameState(state);
  spawnEnemies();
  startDungeonRun();
  return state;
}

describe('crystal_rescue Tier 1 catalog', () => {
  it('keeps collect_items with guard waves, final ambush, and extraction destination', () => {
    const quest = getQuest(QUEST_ID, TIER);
    expect(quest.objectiveType).toBe('collect_items');
    expect(quest.itemCount).toBe(3);
    expect(quest.finalAmbush?.spawns?.length).toBeGreaterThan(0);
    expect(quest.extractionDestination).toEqual({ roomRole: 'start' });
    expect(countScriptedEnemiesInQuest(quest)).toBe(6);
    expect(countFinalAmbushEnemies(quest)).toBe(3);
  });
});

describe('crystal_rescue Tier 1 collect-ambush-extract arc', () => {
  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
  });

  it('does not complete on the third prism alone', () => {
    deployCrystalRescueRun(gameState);
    const quest = getQuest(QUEST_ID, TIER);
    for (let i = 0; i < quest.itemCount; i += 1) {
      recordCrystalCollected(1);
    }
    expect(gameState.run.finalAmbush?.spawned).toBe(true);
    expect(isRunObjectiveComplete(gameState.run.objective)).toBe(false);
    checkRunTerminalState();
    expect(gameState.run.status).toBe('playing');
  });

  it('walks collect → ambush spawn → ambush clear → dock arrival → victory', () => {
    deployCrystalRescueRun(gameState);
    const quest = getQuest(QUEST_ID, TIER);
    const ambushCount = countFinalAmbushEnemies(quest);

    for (const room of gameState.layout.rooms) {
      gameState.players.p1.x = room.x;
      gameState.players.p1.z = room.z;
      updateScriptedEncounters();
      for (const enemy of [...gameState.enemies]) {
        enemy.hp = 0;
      }
      removeDeadEnemies();
    }

    const combatRoom = gameState.layout.rooms.find((room) => room.role === 'combat')
      || gameState.layout.rooms[2];
    gameState.players.p1.x = combatRoom.x;
    gameState.players.p1.z = combatRoom.z;

    for (let i = 0; i < quest.itemCount; i += 1) {
      recordCrystalCollected(1);
    }

    expect(gameState.run.finalAmbush.spawned).toBe(true);
    expect(gameState.enemies.filter((enemy) => enemy.finalAmbush).length).toBe(ambushCount);
    expect(gameState.run.objective.extractionPhase).toBe(false);

    for (const enemy of gameState.enemies.filter((e) => e.finalAmbush)) {
      enemy.hp = 0;
    }
    removeDeadEnemies();

    expect(gameState.run.finalAmbush.cleared).toBe(true);
    expect(gameState.run.objective.extractionPhase).toBe(true);
    expect(isRunObjectiveComplete(gameState.run.objective)).toBe(false);

    const startRoom = gameState.layout.rooms.find((room) => room.role === 'start');
    gameState.players.p1.x = startRoom.x;
    gameState.players.p1.z = startRoom.z;
    tickCollectItemsExtraction(gameState);

    expect(gameState.run.objective.extractionReached).toBe(true);
    expect(isRunObjectiveComplete(gameState.run.objective)).toBe(true);
    checkRunTerminalState();
    expect(gameState.run.status).toBe('victory');
  });
});
