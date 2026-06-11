import { describe, it, expect, beforeEach } from 'vitest';
import { generateLayout, questLayoutSeed, mulberry32 } from '../dungeon.js';
import {
  getLayoutGenerationOptions,
  getLayoutProfileForQuest,
} from '../quests.js';
import {
  gameState,
  resetGameState,
  setGameState,
  spawnEnemies,
  spawnCrystals,
  stateSnapshot,
} from '../index.js';
import { setGameState as setSimulationGameState } from '../simulation.js';

const QUEST_ID = 'crystal_rescue';
const TIER = 1;

function layoutRoomSignature(layout) {
  return layout.rooms.map((room) => ({
    x: room.x,
    z: room.z,
    width: room.width,
    depth: room.depth,
  }));
}

function crystalPositions(state) {
  return state.loot
    .filter((loot) => loot.kind === 'crystal')
    .map((loot) => ({ x: loot.x, z: loot.z }));
}

function deployCrystalRescue(layoutSeed, runSpawnSeed) {
  const state = gameState;
  state.selectedQuestId = QUEST_ID;
  state.selectedQuestTier = TIER;
  const profile = getLayoutProfileForQuest(QUEST_ID, TIER);
  const options = getLayoutGenerationOptions(QUEST_ID, TIER);
  state.layout = generateLayout(layoutSeed, profile, options);
  state.layoutSeed = layoutSeed;
  state.runSpawnSeed = runSpawnSeed;
  state.enemies = [];
  state.loot = [];
  state.minions = [];
  state.players = {
    p1: {
      x: 0,
      z: 0,
      y: 0.5,
      hp: 100,
      dead: false,
      extracted: false,
      deck: [],
      hand: [],
    },
  };
  state.gamePhase = 'playing';
  setGameState(state);
  setSimulationGameState(state);
  spawnEnemies();
  return state;
}

describe('per-run objective spawn seed (crystal_rescue)', () => {
  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
  });

  it('keeps layout identical but varies crystal positions across runSpawnSeed values', () => {
    const layoutSeed = questLayoutSeed(QUEST_ID, TIER);
    deployCrystalRescue(layoutSeed, 111_111);
    const firstLayout = layoutRoomSignature(gameState.layout);
    const firstCrystals = crystalPositions(gameState);

    resetGameState();
    setSimulationGameState(gameState);
    deployCrystalRescue(layoutSeed, 222_222);
    const secondLayout = layoutRoomSignature(gameState.layout);
    const secondCrystals = crystalPositions(gameState);

    expect(secondLayout).toEqual(firstLayout);
    expect(firstCrystals.length).toBeGreaterThan(0);
    expect(secondCrystals.length).toBe(firstCrystals.length);
    expect(secondCrystals).not.toEqual(firstCrystals);
  });

  it('reproduces crystal positions for the same runSpawnSeed', () => {
    const layoutSeed = questLayoutSeed(QUEST_ID, TIER);
    const runSpawnSeed = 424_242;
    deployCrystalRescue(layoutSeed, runSpawnSeed);
    const firstCrystals = crystalPositions(gameState);

    resetGameState();
    setSimulationGameState(gameState);
    deployCrystalRescue(layoutSeed, runSpawnSeed);

    expect(crystalPositions(gameState)).toEqual(firstCrystals);
  });

  it('spawnCrystals with the same layout and runSpawnSeed is deterministic', () => {
    const layoutSeed = questLayoutSeed(QUEST_ID, TIER);
    const profile = getLayoutProfileForQuest(QUEST_ID, TIER);
    const options = getLayoutGenerationOptions(QUEST_ID, TIER);
    const layout = generateLayout(layoutSeed, profile, options);
    const runSpawnSeed = 987_654;

    gameState.loot = [];
    spawnCrystals(layout, mulberry32(runSpawnSeed), 3);
    const first = crystalPositions(gameState);

    gameState.loot = [];
    spawnCrystals(layout, mulberry32(runSpawnSeed), 3);
    const second = crystalPositions(gameState);

    expect(second).toEqual(first);
  });

  it('includes runSpawnSeed in stateSnapshot', () => {
    const layoutSeed = questLayoutSeed(QUEST_ID, TIER);
    const runSpawnSeed = 135_790;
    deployCrystalRescue(layoutSeed, runSpawnSeed);

    expect(stateSnapshot().runSpawnSeed).toBe(runSpawnSeed);
    expect(stateSnapshot().layoutSeed).toBe(layoutSeed);
  });
});
