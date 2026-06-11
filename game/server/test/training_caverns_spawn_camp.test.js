import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateLayout } from '../dungeon.js';
import {
  spawnEnemies,
  startDungeonRun,
  updateEnemies,
  gameState,
  resetGameState,
  setGameState,
} from '../index.js';
import {
  rebuildWallColliders,
  setGameState as setSimulationGameState,
} from '../simulation.js';
import { TICK_RATE } from '../config.js';

const require = createRequire(import.meta.url);
const { getLayoutProfileForQuest } = require('../quests.js');

const QUEST_ID = 'training_caverns';
const SEED = 1;
const GRACE_MS = 3000;
const TICK_MS = 1000 / TICK_RATE;

function deployInitiateVaultTier1(seed = SEED) {
  const layout = generateLayout(seed, getLayoutProfileForQuest(QUEST_ID, 1));

  gameState.selectedQuestId = QUEST_ID;
  gameState.selectedQuestTier = 1;
  gameState.layout = layout;
  gameState.layoutSeed = seed;
  gameState.enemies = [];
  gameState.loot = [];
  gameState.gamePhase = 'playing';
  gameState.players = {
    p1: {
      id: 'p1',
      x: layout.rooms[0].x,
      y: 0.5,
      z: layout.rooms[0].z,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
      ready: true,
      connected: true,
    },
  };
  setGameState(gameState);
  setSimulationGameState(gameState);
  spawnEnemies();
  startDungeonRun();
  rebuildWallColliders();
  return { layout };
}

function room0Wave0Grunts() {
  return gameState.enemies.filter(
    (enemy) => enemy.scriptedWave?.roomKey === 'room:0' && enemy.scriptedWave?.waveIndex === 0,
  );
}

function stepToward(fromX, fromZ, toX, toZ, distance = 0.5) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const len = Math.hypot(dx, dz) || 1;
  return {
    x: fromX + (dx / len) * distance,
    z: fromZ + (dz / len) * distance,
  };
}

function runEnemyTicks(tickCount) {
  for (let i = 0; i < tickCount; i++) {
    vi.setSystemTime(Date.now() + TICK_MS);
    updateEnemies();
  }
}

describe('training_caverns tier 1 entry aggro grace', () => {
  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the player at full HP during the grace window, then allows combat afterward', () => {
    deployInitiateVaultTier1();
    const grunts = room0Wave0Grunts();
    expect(grunts).toHaveLength(2);
    expect(grunts.every((enemy) => enemy.aggroGraceUntil > Date.now())).toBe(true);

    const player = gameState.players.p1;
    expect(player.hp).toBe(100);

    // 3 seconds at 20 ticks/sec while the player stands still.
    runEnemyTicks(GRACE_MS / TICK_MS);
    expect(player.hp).toBe(100);

    // Past grace: walk toward the entry grunts, then let combat resolve in range.
    vi.setSystemTime(Date.now() + 1);
    const targetX = grunts.reduce((sum, enemy) => sum + enemy.x, 0) / grunts.length;
    const targetZ = grunts.reduce((sum, enemy) => sum + enemy.z, 0) / grunts.length;

    for (let step = 0; step < 20; step++) {
      const next = stepToward(player.x, player.z, targetX, targetZ, 0.5);
      player.x = next.x;
      player.z = next.z;
    }

    let gruntEngaged = false;
    for (let i = 0; i < 400; i++) {
      vi.setSystemTime(Date.now() + TICK_MS);
      updateEnemies();
      if (grunts.some(
        (enemy) => enemy.state === 'chasing'
          || enemy.attackState === 'windup'
          || enemy.attackState === 'recovering',
      )) {
        gruntEngaged = true;
      }
      if (player.hp < 100) break;
    }

    expect(gruntEngaged).toBe(true);
    expect(player.hp).toBeLessThan(100);
  });
});
