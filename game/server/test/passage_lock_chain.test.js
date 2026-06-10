import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import {
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  updateScriptedEncounters,
  tryEnterTelepipe,
  gameState,
  resetGameState,
  setGameState,
} from '../index.js';
import {
  buildWallColliders,
  checkWallCollision,
  getWallColliders,
  rebuildWallColliders,
  setGameState as setSimulationGameState,
} from '../simulation.js';
import { findPassageIndexFromRoom } from '../scriptedEncounters.js';

const require = createRequire(import.meta.url);
const {
  getLayoutProfileForQuest,
  getQuest,
} = require('../quests.js');
const { countAuthoredScriptedEnemies } = require('../scriptedEncounters.js');
const { restoreCardCheckpoint } = require('../progression.js');

const QUEST_ID = 'training_caverns';
// Seed 1 yields room 0 → room 1 → room 2 along resolved passage indices.
const SEED = 1;

function deployTrainingCavernsPassageLockChain(seed = SEED) {
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
      hand: [{
        id: 'iron_sword',
        charges: 10,
        remainingCharges: 4,
      }],
    },
  };
  setGameState(gameState);
  setSimulationGameState(gameState);
  spawnEnemies();
  startDungeonRun();
  rebuildWallColliders();
  return { layout, gameState };
}

function passageTargetRoom(layout, passageIndex) {
  const passage = layout.passages[passageIndex];
  return layout.rooms.find((room) => room.x === passage.x2 && room.z === passage.z2);
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

function killScriptedWave(roomIndex, waveIndex) {
  const roomKey = `room:${roomIndex}`;
  for (const enemy of [...gameState.enemies]) {
    if (
      enemy.scriptedWave?.roomKey === roomKey
      && enemy.scriptedWave?.waveIndex === waveIndex
    ) {
      enemy.hp = 0;
    }
  }
  removeDeadEnemies();
  rebuildWallColliders();
}

function enterRoom(player, room) {
  player.x = room.x;
  player.z = room.z;
  updateScriptedEncounters();
  rebuildWallColliders();
}

describe('chained passage lock progression', () => {
  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
  });

  it('walks A → B → end room with two wave-gated passages', () => {
    const { layout } = deployTrainingCavernsPassageLockChain();
    const passageIndex0 = findPassageIndexFromRoom(layout, 0);
    const passageIndex1 = findPassageIndexFromRoom(layout, 1);
    expect(passageIndex0).toBeGreaterThanOrEqual(0);
    expect(passageIndex1).toBeGreaterThanOrEqual(0);

    const roomB = passageTargetRoom(layout, passageIndex0);
    const endRoom = passageTargetRoom(layout, passageIndex1);
    expect(roomB).toBe(layout.rooms[1]);
    expect(endRoom).toBe(layout.rooms[2]);

    expect(gameState.run.passageLocks).toEqual([
      {
        passageIndex: passageIndex0,
        afterWave: { roomIndex: 0, waveIndex: 0 },
        locked: true,
      },
      {
        passageIndex: passageIndex1,
        afterWave: { roomIndex: 1, waveIndex: 0 },
        locked: true,
      },
    ]);
    expect(getWallColliders().length).toBeGreaterThan(buildWallColliders(layout, []).length);

    const startRoom = layout.rooms[0];
    const towardRoomB = stepToward(startRoom.x, startRoom.z, roomB.x, roomB.z, 9);
    expect(checkWallCollision(towardRoomB.x, towardRoomB.z, getWallColliders())).toBe(true);

    killScriptedWave(0, 0);

    expect(gameState.run.passageLocks[0].locked).toBe(false);
    expect(gameState.run.passageLocks[1].locked).toBe(true);
    expect(checkWallCollision(towardRoomB.x, towardRoomB.z, getWallColliders())).toBe(false);

    const player = gameState.players.p1;
    enterRoom(player, roomB);
    expect(gameState.run.scriptedEncounter.rooms['room:1'].waveIndex).toBe(0);
    expect(gameState.enemies.some((enemy) => enemy.scriptedWave?.roomKey === 'room:1')).toBe(true);

    const towardEndRoom = stepToward(roomB.x, roomB.z, endRoom.x, endRoom.z, 9);
    expect(checkWallCollision(towardEndRoom.x, towardEndRoom.z, getWallColliders())).toBe(true);

    killScriptedWave(1, 0);

    expect(gameState.run.passageLocks[0].locked).toBe(false);
    expect(gameState.run.passageLocks[1].locked).toBe(false);
    expect(checkWallCollision(towardEndRoom.x, towardEndRoom.z, getWallColliders())).toBe(false);

    enterRoom(player, endRoom);
    expect(gameState.run.scriptedEncounter.rooms['room:2'].started).toBe(true);
    expect(gameState.enemies.some((enemy) => enemy.scriptedWave?.roomKey === 'room:2')).toBe(true);
    expect(gameState.enemies.some((enemy) => enemy.displayName === 'Vault Stalker')).toBe(true);
  });

  it('telepipe suspend/resume preserves authored totalEnemies and live activeEnemyCount mid-wave', () => {
    const { layout } = deployTrainingCavernsPassageLockChain();
    const quest = getQuest(QUEST_ID, 1);
    const authoredTotal = countAuthoredScriptedEnemies(quest);
    const startRoom = layout.rooms[0];
    const player = gameState.players.p1;

    expect(gameState.run.objective.totalEnemies).toBe(authoredTotal);
    expect(gameState.run.objective.activeEnemyCount).toBe(2);
    expect(gameState.enemies.filter((enemy) => !enemy.spawnedBy)).toHaveLength(2);

    const [firstGrunt] = gameState.enemies.filter((enemy) => enemy.type === 'grunt');
    firstGrunt.hp = 0;
    removeDeadEnemies();

    expect(gameState.run.objective.totalEnemies).toBe(authoredTotal);
    expect(gameState.run.objective.activeEnemyCount).toBe(1);
    expect(gameState.enemies.filter((enemy) => !enemy.spawnedBy)).toHaveLength(1);

    const preSuspendEnemyIds = gameState.enemies.map((enemy) => enemy.id);
    const preSuspendActiveCount = gameState.run.objective.activeEnemyCount;

    player.x = startRoom.x;
    player.z = startRoom.z;
    player.hand = [{
      id: 'telepipe',
      name: 'Telepipe',
      type: 'spell',
      charges: 1,
      remainingCharges: 1,
    }];
    gameState.telepipe = {
      x: startRoom.x,
      z: startRoom.z,
      placedBy: 'p1',
      placedAt: Date.now(),
    };

    const suspendResult = tryEnterTelepipe('p1');
    expect(suspendResult.ok).toBe(true);
    expect(gameState.suspendedCheckpoint.run.objective.totalEnemies).toBe(authoredTotal);
    expect(gameState.suspendedCheckpoint.run.objective.activeEnemyCount).toBe(preSuspendActiveCount);

    restoreCardCheckpoint();

    expect(gameState.run.objective.totalEnemies).toBe(authoredTotal);
    expect(gameState.run.objective.activeEnemyCount).toBe(preSuspendActiveCount);
    expect(gameState.enemies.map((enemy) => enemy.id)).toEqual(preSuspendEnemyIds);
    expect(gameState.enemies.filter((enemy) => !enemy.spawnedBy)).toHaveLength(preSuspendActiveCount);
  });
});
