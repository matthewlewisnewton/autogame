import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateLayout } from '../dungeon.js';
import {
  spawnEnemies,
  startDungeonRun,
  updateEnemies,
  removeDeadEnemies,
  gameState,
  resetGameState,
  setGameState,
  resolveProjectileAim,
  ENEMY_ATTACK_RANGE,
  ATTACK_RANGE,
} from '../index.js';
import {
  rebuildWallColliders,
  setGameState as setSimulationGameState,
} from '../simulation.js';
import { handleUseCard, setCallbacks as setCardEffectCallbacks } from '../cardEffects.js';
import { TICK_RATE } from '../config.js';

const require = createRequire(import.meta.url);
const { getLayoutProfileForQuest } = require('../quests.js');

const QUEST_ID = 'training_caverns';
const SEED = 1;
const GRACE_MS = 3000;
const TICK_MS = 1000 / TICK_RATE;
const PLAYER_ID = 'p1';
const WEAPON_SLOT = 0;
const WEAPON_RANGE = ATTACK_RANGE - 0.6;
const MAX_COMBAT_TICKS = 6000;

function mockIo() {
  return {
    to: () => ({
      emit: () => {},
    }),
  };
}

function wireCardEffectCallbacks() {
  setCardEffectCallbacks({
    io: mockIo(),
    emitCardError: () => {},
    findSacrificeTarget: () => null,
    resolveAttackRotation: (player, data) => (
      Number.isFinite(data?.rotation) ? data.rotation : (player.rotation || 0)
    ),
    resolveProjectileAim,
  });
}

function starterHand() {
  return [
    {
      id: 'iron_sword',
      name: 'Rust-Forged Saber',
      type: 'weapon',
      charges: 5,
      remainingCharges: 5,
      grind: 0,
    },
    null,
    null,
    null,
  ];
}

function deployInitiateVaultTier1(seed = SEED) {
  const layout = generateLayout(seed, getLayoutProfileForQuest(QUEST_ID, 1));

  gameState.selectedQuestId = QUEST_ID;
  gameState.selectedQuestTier = 1;
  gameState.layout = layout;
  gameState.layoutSeed = seed;
  gameState.enemies = [];
  gameState.loot = [];
  gameState.minions = [];
  gameState.gamePhase = 'playing';
  gameState._lobbyId = 'room0-starter-fight-test';
  gameState.players = {
    [PLAYER_ID]: {
      id: PLAYER_ID,
      x: layout.rooms[0].x,
      y: 0.5,
      z: layout.rooms[0].z,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
      ready: true,
      connected: true,
      hand: starterHand(),
      slotCooldowns: [null, null, null, null],
      pendingSummons: new Set(),
      magicStones: 0,
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

function livingRoom0Grunts() {
  return room0Wave0Grunts().filter((enemy) => enemy.hp > 0);
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

function distXZ(ax, az, bx, bz) {
  return Math.hypot(bx - ax, bz - az);
}

function nearestLivingGrunt(player) {
  const grunts = livingRoom0Grunts();
  if (grunts.length === 0) return null;
  let nearest = grunts[0];
  let nearestDist = distXZ(player.x, player.z, nearest.x, nearest.z);
  for (let i = 1; i < grunts.length; i++) {
    const grunt = grunts[i];
    const dist = distXZ(player.x, player.z, grunt.x, grunt.z);
    if (dist < nearestDist) {
      nearest = grunt;
      nearestDist = dist;
    }
  }
  return nearest;
}

function runEnemyTicks(tickCount) {
  for (let i = 0; i < tickCount; i++) {
    vi.setSystemTime(Date.now() + TICK_MS);
    updateEnemies();
  }
}

function weaponOnCooldown(player, now) {
  const until = player.slotCooldowns?.[WEAPON_SLOT];
  return Number.isFinite(until) && now < until;
}

async function swingIronSword(socket, lobby, target) {
  await handleUseCard(socket, gameState, lobby, {
    cardId: 'iron_sword',
    slotIndex: WEAPON_SLOT,
    lockTargetId: target.id,
  });
}

describe('training_caverns tier 1 room-0 starter weapon fight', () => {
  const socket = { playerId: PLAYER_ID, emit: () => {} };
  const lobby = { id: 'room0-starter-fight-test', state: gameState };

  beforeEach(() => {
    resetGameState();
    setSimulationGameState(gameState);
    wireCardEffectCallbacks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears room-0 wave 0 with iron_sword while surviving and unlocks passage lock 0', async () => {
    deployInitiateVaultTier1();
    const grunts = room0Wave0Grunts();
    expect(grunts).toHaveLength(2);
    expect(grunts.every((enemy) => enemy.aggroGraceUntil > Date.now())).toBe(true);

    const player = gameState.players[PLAYER_ID];
    const sword = player.hand[WEAPON_SLOT];
    expect(sword).toMatchObject({
      id: 'iron_sword',
      type: 'weapon',
      charges: 5,
      remainingCharges: 5,
    });

    runEnemyTicks(GRACE_MS / TICK_MS);
    expect(player.hp).toBe(100);

    vi.setSystemTime(Date.now() + 1);

    for (let tick = 0; tick < MAX_COMBAT_TICKS; tick++) {
      vi.setSystemTime(Date.now() + TICK_MS);
      const now = Date.now();
      const target = nearestLivingGrunt(player);
      if (!target) break;
      if (player.dead || player.hp <= 0) break;

      const dist = distXZ(player.x, player.z, target.x, target.z);
      const enemyWindingUp = target.attackState === 'windup'
        || target.attackState === 'recovering';

      if (dist <= ENEMY_ATTACK_RANGE + 0.25 && enemyWindingUp) {
        const away = stepToward(player.x, player.z, target.x, target.z, -0.45);
        player.x = away.x;
        player.z = away.z;
      } else if (dist > WEAPON_RANGE) {
        const next = stepToward(player.x, player.z, target.x, target.z, 0.55);
        player.x = next.x;
        player.z = next.z;
      } else if (!weaponOnCooldown(player, now)) {
        const aim = resolveProjectileAim(player, { lockTargetId: target.id }, gameState);
        player.rotation = aim.rotation;
        await swingIronSword(socket, lobby, target);
      }

      updateEnemies();
    }

    removeDeadEnemies();

    expect(player.dead).toBe(false);
    expect(player.hp).toBeGreaterThan(0);
    expect(livingRoom0Grunts()).toHaveLength(0);
    expect(gameState.run.objective.defeatedEnemies).toBeGreaterThanOrEqual(2);
    expect(gameState.run.passageLocks[0].locked).toBe(false);
  });
});
