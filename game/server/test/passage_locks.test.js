import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import {
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  tryEnterTelepipe,
  gameState,
  resetGameState,
  setGameState,
} from '../index.js';
import {
  applyPlayerMovement,
  buildMovementContext,
  buildWallColliders,
  checkWallCollision,
  ENTITY_RADIUS,
  getWallColliders,
  isEntityPositionBlocked,
  moveEntityToward,
  rebuildWallColliders,
  setGameState as setSimulationGameState,
} from '../simulation.js';
import { findPassageIndexFromRoom } from '../scriptedEncounters.js';

const require = createRequire(import.meta.url);
const {
  QUEST_DEFS,
  SCRIPTED_ENCOUNTER_FIXTURE_DEF,
  getLayoutProfileForQuest,
} = require('../quests.js');

const FIXTURE_QUEST_ID = 'scripted_encounter_fixture';
const SEED = 4242;

function buildPassageLockFixtureDef(layout) {
  const startRoomIndex = layout.rooms.findIndex((room) => room.role === 'start');
  const roomIndex = startRoomIndex >= 0 ? startRoomIndex : 0;
  const passageIndex = findPassageIndexFromRoom(layout, roomIndex);
  const baseTier = SCRIPTED_ENCOUNTER_FIXTURE_DEF.tiers[1];

  return {
    ...SCRIPTED_ENCOUNTER_FIXTURE_DEF,
    tiers: {
      1: {
        ...baseTier,
        scriptedEncounters: {
          ...baseTier.scriptedEncounters,
          passageLocks: passageIndex >= 0
            ? [{ afterWave: { roomIndex, waveIndex: 0 }, passageIndex }]
            : [],
        },
      },
    },
  };
}

function registerPassageLockFixture(layout) {
  QUEST_DEFS[FIXTURE_QUEST_ID] = buildPassageLockFixtureDef(layout);
}

function deployPassageLockFixture(seed = SEED) {
  const layout = generateLayout(seed, getLayoutProfileForQuest(FIXTURE_QUEST_ID, 1));
  registerPassageLockFixture(layout);

  gameState.selectedQuestId = FIXTURE_QUEST_ID;
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

beforeAll(() => {
  const layout = generateLayout(SEED, getLayoutProfileForQuest(FIXTURE_QUEST_ID, 1));
  registerPassageLockFixture(layout);
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('passage lock runtime state', () => {
  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
  });

  it('marks start-room passage locks on deploy', () => {
    const { layout } = deployPassageLockFixture();
    const passageIndex = findPassageIndexFromRoom(layout, 0);
    expect(passageIndex).toBeGreaterThanOrEqual(0);
    expect(gameState.run.passageLocks).toEqual([
      {
        passageIndex,
        afterWave: { roomIndex: 0, waveIndex: 0 },
        locked: true,
      },
    ]);
    expect(getWallColliders().length).toBeGreaterThan(buildWallColliders(layout, []).length);
  });

  it('blocks movement through a locked passage until wave 0 clears', () => {
    const { layout } = deployPassageLockFixture();
    const passageIndex = findPassageIndexFromRoom(layout, 0);
    const targetRoom = passageTargetRoom(layout, passageIndex);
    const startRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];
    const player = gameState.players.p1;

    player.x = startRoom.x;
    player.z = startRoom.z;

    const towardExit = stepToward(startRoom.x, startRoom.z, targetRoom.x, targetRoom.z, 9);
    expect(checkWallCollision(towardExit.x, towardExit.z, getWallColliders())).toBe(true);

    for (const enemy of [...gameState.enemies]) {
      enemy.hp = 0;
    }
    removeDeadEnemies();

    expect(gameState.run.passageLocks[0].locked).toBe(false);
    expect(checkWallCollision(towardExit.x, towardExit.z, getWallColliders())).toBe(false);
  });

  it('does not respawn earlier waves when unlocking a passage', () => {
    deployPassageLockFixture();

    const defeatedBeforeUnlock = gameState.run.objective.defeatedEnemies;
    const enemyCountBeforeUnlock = gameState.enemies.length;

    for (const enemy of [...gameState.enemies]) {
      enemy.hp = 0;
    }
    removeDeadEnemies();
    rebuildWallColliders();

    expect(gameState.run.objective.defeatedEnemies).toBeGreaterThan(defeatedBeforeUnlock);
    expect(gameState.enemies.length).toBe(1);
    expect(gameState.enemies.length).toBeLessThanOrEqual(enemyCountBeforeUnlock);
    expect(gameState.enemies.every((enemy) => enemy.scriptedWave?.waveIndex === 1)).toBe(true);
  });

  it('rejects server movement through a locked passage', () => {
    const { layout } = deployPassageLockFixture();
    const targetRoom = passageTargetRoom(layout, findPassageIndexFromRoom(layout, 0));
    const player = gameState.players.p1;
    const startX = layout.rooms[0].x;
    const startZ = layout.rooms[0].z;

    player.x = startX;
    player.z = startZ;
    player.inputActive = true;
    player.inputDx = Math.sign(targetRoom.x - startX);
    player.inputDz = Math.sign(targetRoom.z - startZ);
    player.lastInputTime = Date.now();

    const movementContext = buildMovementContext(gameState);
    for (let i = 0; i < 40; i++) {
      applyPlayerMovement(gameState, movementContext);
    }

    const distBeforeClear = Math.hypot(player.x - targetRoom.x, player.z - targetRoom.z);
    expect(distBeforeClear).toBeGreaterThan(4);

    for (const enemy of [...gameState.enemies]) {
      enemy.hp = 0;
    }
    removeDeadEnemies();
    rebuildWallColliders();

    player.x = startX;
    player.z = startZ;
    const unlockedContext = buildMovementContext(gameState);
    for (let i = 0; i < 80; i++) {
      applyPlayerMovement(gameState, unlockedContext);
    }

    const distAfterClear = Math.hypot(player.x - targetRoom.x, player.z - targetRoom.z);
    expect(distAfterClear).toBeLessThan(distBeforeClear);
  });

  it('blocks enemy moveEntityToward through a locked passage until wave 0 clears', () => {
    const { layout } = deployPassageLockFixture();
    const passageIndex = findPassageIndexFromRoom(layout, 0);
    const targetRoom = passageTargetRoom(layout, passageIndex);
    const startRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];

    const enemy = {
      id: 'path-test-enemy',
      x: startRoom.x,
      z: startRoom.z,
      wanderTarget: { x: targetRoom.x, z: targetRoom.z },
    };

    const towardExit = stepToward(startRoom.x, startRoom.z, targetRoom.x, targetRoom.z, 9);
    expect(isEntityPositionBlocked(towardExit.x, towardExit.z, ENTITY_RADIUS)).toBe(true);

    let sawBlockedMove = false;
    for (let i = 0; i < 40; i++) {
      const step = moveEntityToward(enemy, enemy.wanderTarget, 0.5, {});
      if (step.blocked) sawBlockedMove = true;
    }
    expect(sawBlockedMove).toBe(true);
    const distWhileLocked = Math.hypot(enemy.x - targetRoom.x, enemy.z - targetRoom.z);
    expect(distWhileLocked).toBeGreaterThan(4);

    for (const waveEnemy of [...gameState.enemies]) {
      waveEnemy.hp = 0;
    }
    removeDeadEnemies();

    expect(gameState.run.passageLocks[0].locked).toBe(false);
    expect(checkWallCollision(towardExit.x, towardExit.z, getWallColliders())).toBe(false);

    enemy.x = startRoom.x;
    enemy.z = startRoom.z;
    for (let i = 0; i < 40; i++) {
      moveEntityToward(enemy, enemy.wanderTarget, 0.5, {});
    }
    const distAfterUnlock = Math.hypot(enemy.x - targetRoom.x, enemy.z - targetRoom.z);
    expect(distAfterUnlock).toBeLessThan(distWhileLocked);
    expect(distAfterUnlock).toBeLessThan(4);
  });

  it('leaves passageLocks absent on non-scripted open-plaza deploy', () => {
    const layout = generateLayout(SEED, getLayoutProfileForQuest('arena_trials', 1));
    gameState.selectedQuestId = 'arena_trials';
    gameState.selectedQuestTier = 1;
    gameState.layout = layout;
    gameState.layoutSeed = SEED;
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
        hand: [],
      },
    };
    setGameState(gameState);
    setSimulationGameState(gameState);
    startDungeonRun();
    rebuildWallColliders();

    expect(gameState.run.passageLocks ?? []).toEqual([]);
    const baseColliders = buildWallColliders(layout, []);
    expect(getWallColliders()).toEqual(baseColliders);
  });

  it('preserves locked passageLocks in checkpoint when extracting via telepipe', () => {
    const { layout } = deployPassageLockFixture();
    const startRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];
    const player = gameState.players.p1;
    gameState._lobbyId = 'test-lobby';

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

    const lockedSnapshot = JSON.parse(JSON.stringify(gameState.run.passageLocks));
    expect(lockedSnapshot[0].locked).toBe(true);

    const result = tryEnterTelepipe('p1');
    expect(result.ok).toBe(true);
    expect(gameState.gamePhase).toBe('lobby');
    expect(gameState.run).toBeUndefined();
    expect(gameState.suspendedCheckpoint).not.toBeNull();
    expect(gameState.suspendedCheckpoint.run.passageLocks).toEqual(lockedSnapshot);
    expect(gameState.suspendedCheckpoint.run.passageLocks[0].locked).toBe(true);
  });
});
