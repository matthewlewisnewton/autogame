import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  gameState,
  resetGameState,
  spawnEnemies,
  startDungeonRun,
  cleanupAfterDamage,
  removeDeadEnemies,
  captureRunCheckpoint,
  restoreRunCheckpoint,
  grantRunRewards,
  io as serverIo,
} from '../index.js';
import { generateLayout } from '../dungeon.js';
import { getLayoutProfileForQuest } from '../quests.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS } = require('../quests.js');
const users = require('../users.js');

const TEST_QUEST_ID = '__boss_encounter_defeat_test__';
const UNLOCK_QUEST_ID = '__boss_encounter_unlock_target__';
const SEED = 6161;
const TIER_2 = 2;

const STAGE_BOSS_CONFIG = {
  bossType: 'miniboss',
  trigger: 'deploy',
  roomRole: 'combat',
  rewardCurrencyBonus: 7,
  unlockOnClear: { questId: UNLOCK_QUEST_ID, tier: TIER_2 },
};

function setPartySize(count) {
  Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
  for (let i = 1; i <= count; i++) {
    gameState.players[`p${i}`] = {
      x: 0,
      y: 0.5,
      z: 0,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
      currency: 0,
      accountId: `acct-${i}`,
    };
  }
}

function deployEncounterRun() {
  gameState.selectedQuestId = TEST_QUEST_ID;
  gameState.selectedQuestTier = 1;
  gameState.layoutSeed = SEED;
  gameState.layout = generateLayout(
    SEED,
    getLayoutProfileForQuest(TEST_QUEST_ID, 1),
  );
  gameState.enemies = [];
  gameState.loot = [];
  gameState.gamePhase = 'playing';
  spawnEnemies();
  startDungeonRun();
}

function getStageBoss() {
  const bossId = gameState.run.encounter.bossEnemyId;
  return gameState.enemies.find((e) => e.id === bossId);
}

describe('stage boss defeat hook', () => {
  let tmpFile;

  beforeEach(() => {
    resetGameState();
    tmpFile = path.join(
      os.tmpdir(),
      `boss-encounter-defeat-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    users.setTestFilePath(tmpFile);
    users.clearUsers();
    users.createUser('boss_tester', 'testpass');
    const accountId = users.findUserByUsername('boss_tester').accountId;

    QUEST_DEFS[TEST_QUEST_ID] = {
      id: TEST_QUEST_ID,
      enemyPool: [{ type: 'grunt', weight: 1 }],
      tiers: {
        1: {
          name: 'Boss Defeat Test',
          description: 'Stage-boss clear and rewards.',
          objectiveType: 'defeat_enemies',
          enemyCount: 6,
          rewardCurrency: 10,
          layoutProfile: 'open-plaza',
          stageBossEncounter: STAGE_BOSS_CONFIG,
        },
      },
    };
    QUEST_DEFS[UNLOCK_QUEST_ID] = {
      id: UNLOCK_QUEST_ID,
      enemyPool: [{ type: 'grunt', weight: 1 }],
      tiers: {
        1: {
          name: 'Unlock Target Tier 1',
          description: 'Tier 1 placeholder.',
          objectiveType: 'defeat_enemies',
          enemyCount: 1,
          rewardCurrency: 5,
          layoutProfile: 'open-plaza',
        },
        2: {
          name: 'Unlock Target Tier 2',
          description: 'Tier 2 placeholder.',
          objectiveType: 'defeat_enemies',
          enemyCount: 1,
          rewardCurrency: 8,
          layoutProfile: 'open-plaza',
        },
      },
    };

    setPartySize(1);
    gameState.players.p1.accountId = accountId;
  });

  afterEach(() => {
    delete QUEST_DEFS[TEST_QUEST_ID];
    delete QUEST_DEFS[UNLOCK_QUEST_ID];
    gameState.selectedQuestId = 'training_caverns';
    gameState.selectedQuestTier = 1;
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    try {
      fs.unlinkSync(tmpFile + '.tmp');
    } catch {}
  });

  it('clears the encounter, applies bonus reward, unlocks tier, and reaches victory', () => {
    deployEncounterRun();

    expect(gameState.run.encounter.status).toBe('active');
    expect(gameState.run.objective.totalEnemies).toBe(1);
    expect(gameState.run.rewardCurrency).toBe(10);
    expect(users.isQuestTierUnlocked(gameState.players.p1.accountId, UNLOCK_QUEST_ID, TIER_2)).toBe(false);

    const boss = getStageBoss();
    expect(boss).toBeTruthy();
    boss.hp = 0;

    const emitCalls = [];
    const originalEmit = serverIo.emit;
    serverIo.emit = (event, data) => emitCalls.push({ event, data });

    cleanupAfterDamage();

    serverIo.emit = originalEmit;

    expect(gameState.run.encounter.status).toBe('cleared');
    expect(gameState.run.rewardCurrency).toBe(17);
    expect(gameState.run.objective.defeatedEnemies).toBe(1);
    expect(gameState.run.status).toBe('victory');
    expect(users.isQuestTierUnlocked(gameState.players.p1.accountId, UNLOCK_QUEST_ID, TIER_2)).toBe(true);

    const victoryEmits = emitCalls.filter((c) => c.event === 'runComplete');
    expect(victoryEmits.length).toBe(1);
    expect(victoryEmits[0].data.status).toBe('victory');
    expect(victoryEmits[0].data.rewards.currency).toBe(17);

    grantRunRewards('p1', { status: 'victory' });
    expect(gameState.players.p1.runRewards.currency).toBe(17);
  });

  it('does not clear the encounter when a non-stage grunt dies', () => {
    deployEncounterRun();

    // Ambient spawns are blocked while the encounter is locked; inject a stray grunt.
    gameState.enemies.push({
      id: 'stray-grunt',
      x: 3,
      z: 3,
      type: 'grunt',
      hp: 0,
      maxHp: 50,
      state: 'idle',
      wanderTarget: { x: 3, z: 3 },
    });

    removeDeadEnemies();

    expect(gameState.run.encounter.status).toBe('active');
    expect(gameState.run.rewardCurrency).toBe(10);
    expect(gameState.run.objective.defeatedEnemies).toBe(1);
    expect(gameState.run.status).toBe('playing');
    expect(users.isQuestTierUnlocked(gameState.players.p1.accountId, UNLOCK_QUEST_ID, TIER_2)).toBe(false);
  });

  it('leaves unlock behavior unchanged when unlockOnClear is absent', () => {
    gameState.selectedQuestId = TEST_QUEST_ID;
    QUEST_DEFS[TEST_QUEST_ID].tiers[1].stageBossEncounter = {
      bossType: 'miniboss',
      trigger: 'deploy',
      roomRole: 'combat',
      rewardCurrencyBonus: 3,
    };

    deployEncounterRun();
    const boss = getStageBoss();
    boss.hp = 0;
    cleanupAfterDamage();

    expect(gameState.run.encounter.status).toBe('cleared');
    expect(gameState.run.rewardCurrency).toBe(13);
    expect(users.isQuestTierUnlocked(gameState.players.p1.accountId, UNLOCK_QUEST_ID, TIER_2)).toBe(false);
  });

  it('preserves run.encounter and bossEnemyId across checkpoint suspend/restore', () => {
    deployEncounterRun();
    const bossId = gameState.run.encounter.bossEnemyId;

    gameState.suspendedCheckpoint = captureRunCheckpoint();
    gameState.run.status = 'suspended';
    gameState.enemies = [];
    gameState.run.encounter = undefined;

    restoreRunCheckpoint();

    expect(gameState.run.encounter).toMatchObject({
      status: 'active',
      bossEnemyId: bossId,
      bossType: 'miniboss',
      rewardCurrencyBonus: 7,
      unlockOnClear: { questId: UNLOCK_QUEST_ID, tier: TIER_2 },
    });
    expect(gameState.enemies.some((e) => e.id === bossId)).toBe(true);
  });
});
