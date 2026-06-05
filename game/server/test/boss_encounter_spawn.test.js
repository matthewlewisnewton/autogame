import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initRunEncounter,
  isEncounterLocked,
  isStageBossEnemy,
  resolveStageBossSpawnPosition,
  startStageBossEncounter,
  STAGE_BOSS_SPAWN_RNG_OFFSET,
} from '../bossEncounter.js';
import { generateLayout, mulberry32 } from '../dungeon.js';
import { getLayoutProfileForQuest } from '../quests.js';
import {
  gameState,
  resetGameState,
  createRunState,
  spawnEnemy,
  spawnEnemies,
  updateSurviveSpawns,
  startDungeonRun,
  ENEMY_DEFS,
  buildObjectiveSpawnCtx,
} from '../index.js';
import {
  DIFFICULTY_MINIBOSS_HP_PER_PLAYER,
  difficultyScaleFactor,
} from '../config.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS, getQuest } = require('../quests.js');
const { spawnCombatEnemies } = require('../progression.js');

const TEST_QUEST_ID = '__boss_encounter_spawn_test__';
const SEED = 4242;

const STAGE_BOSS_CONFIG = {
  bossType: 'miniboss',
  trigger: 'deploy',
  roomRole: 'combat',
};

function setPartySize(count) {
  Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
  for (let i = 1; i <= count; i++) {
    gameState.players[`p${i}`] = {
      x: i,
      y: 0.5,
      z: 0,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
    };
  }
}

function deployEncounterQuest(seed = SEED) {
  gameState.selectedQuestId = TEST_QUEST_ID;
  gameState.selectedQuestTier = 1;
  gameState.layoutSeed = seed;
  gameState.layout = generateLayout(
    seed,
    getLayoutProfileForQuest(TEST_QUEST_ID, 1),
  );
  gameState.enemies = [];
  gameState.loot = [];
  gameState.gamePhase = 'playing';
  spawnEnemies();
}

describe('startStageBossEncounter', () => {
  beforeEach(() => {
    resetGameState();
    QUEST_DEFS[TEST_QUEST_ID] = {
      id: TEST_QUEST_ID,
      enemyPool: [{ type: 'grunt', weight: 1 }],
      tiers: {
        1: {
          name: 'Boss Spawn Test',
          description: 'Stage-boss spawn wiring.',
          objectiveType: 'defeat_enemies',
          enemyCount: 4,
          rewardCurrency: 10,
          layoutProfile: 'open-plaza',
          stageBossEncounter: STAGE_BOSS_CONFIG,
        },
      },
    };
    gameState.selectedQuestId = TEST_QUEST_ID;
    gameState.selectedQuestTier = 1;
    setPartySize(1);
  });

  afterEach(() => {
    delete QUEST_DEFS[TEST_QUEST_ID];
    gameState.selectedQuestId = 'training_caverns';
    gameState.selectedQuestTier = 1;
  });

  it('spawns exactly one stage boss and records bossEnemyId', () => {
    deployEncounterQuest();
    expect(gameState.enemies.length).toBe(0);

    gameState.run = createRunState();
    const boss = startStageBossEncounter(gameState, buildObjectiveSpawnCtx());

    expect(gameState.run.encounter.status).toBe('active');
    expect(isEncounterLocked(gameState.run)).toBe(true);
    expect(gameState.enemies.length).toBe(1);
    expect(boss.type).toBe('miniboss');
    expect(boss.isStageBoss).toBe(true);
    expect(gameState.run.encounter.bossEnemyId).toBe(boss.id);
    expect(isStageBossEnemy(boss, gameState.run)).toBe(true);
  });

  it('clears ambient enemies before spawning the stage boss', () => {
    spawnEnemy(1, 1, 'grunt');
    spawnEnemy(2, 2, 'skirmisher');
    expect(gameState.enemies.length).toBe(2);

    gameState.run = createRunState();
    startStageBossEncounter(gameState, buildObjectiveSpawnCtx());

    expect(gameState.enemies.length).toBe(1);
    expect(gameState.enemies[0].isStageBoss).toBe(true);
  });

  it('scales miniboss HP at spawn for 5+ active players', () => {
    setPartySize(8);
    gameState.run = createRunState();
    const boss = startStageBossEncounter(gameState, buildObjectiveSpawnCtx());
    const baseHp = ENEMY_DEFS.miniboss.hp;
    const expected = Math.round(
      baseHp * difficultyScaleFactor(8, DIFFICULTY_MINIBOSS_HP_PER_PLAYER),
    );

    expect(boss.hp).toBe(expected);
    expect(boss.maxHp).toBe(expected);
    expect(boss.hp).toBeGreaterThan(baseHp);
  });

  it('uses baseline miniboss HP for 1–4 players', () => {
    for (const count of [1, 4]) {
      resetGameState();
      setPartySize(count);
      gameState.selectedQuestId = TEST_QUEST_ID;
      gameState.selectedQuestTier = 1;
      gameState.layoutSeed = SEED;
      gameState.layout = generateLayout(
        SEED,
        getLayoutProfileForQuest(TEST_QUEST_ID, 1),
      );
      gameState.run = createRunState();
      const boss = startStageBossEncounter(gameState, buildObjectiveSpawnCtx());
      expect(boss.hp).toBe(ENEMY_DEFS.miniboss.hp);
      expect(boss.maxHp).toBe(ENEMY_DEFS.miniboss.hp);
    }
  });

  it('blocks ambient spawns while the encounter is locked', () => {
    deployEncounterQuest();
    gameState.run = createRunState();
    startStageBossEncounter(gameState, buildObjectiveSpawnCtx());

    const quest = getQuest(TEST_QUEST_ID, 1);
    const rng = mulberry32(SEED + 1000);
    spawnCombatEnemies(gameState.layout, rng, quest);
    expect(gameState.enemies.length).toBe(1);

    spawnEnemy(3, 3, 'grunt');
    expect(gameState.enemies.length).toBe(1);

    let now = 1_000_000;
    for (let i = 0; i < 20; i++) {
      updateSurviveSpawns(now);
      now += 60_000;
    }
    expect(gameState.enemies.length).toBe(1);
  });

  it('skips bulk combat spawn on deploy for stage-boss quests', () => {
    deployEncounterQuest();
    expect(gameState.enemies.length).toBe(0);
  });

  it('places the boss deterministically on open-plaza layouts', () => {
    gameState.layoutSeed = SEED;
    gameState.layout = generateLayout(
      SEED,
      getLayoutProfileForQuest(TEST_QUEST_ID, 1),
    );
    const rng = mulberry32(SEED + STAGE_BOSS_SPAWN_RNG_OFFSET);
    const first = resolveStageBossSpawnPosition(gameState.layout, STAGE_BOSS_CONFIG, rng);
    const rng2 = mulberry32(SEED + STAGE_BOSS_SPAWN_RNG_OFFSET);
    const second = resolveStageBossSpawnPosition(gameState.layout, STAGE_BOSS_CONFIG, rng2);
    expect(second).toEqual(first);
  });

  it('uses the first room matching roomRole on multi-room layouts', () => {
    const layout = generateLayout(99, getLayoutProfileForQuest('training_caverns', 1));
    const combatRooms = layout.rooms.filter((r) => r.role === 'combat');
    expect(combatRooms.length).toBeGreaterThan(0);

    const rng = mulberry32(99 + STAGE_BOSS_SPAWN_RNG_OFFSET);
    const pos = resolveStageBossSpawnPosition(layout, STAGE_BOSS_CONFIG, rng);
    const room = combatRooms[0];
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    expect(pos.x).toBeGreaterThanOrEqual(room.x - halfW);
    expect(pos.x).toBeLessThanOrEqual(room.x + halfW);
    expect(pos.z).toBeGreaterThanOrEqual(room.z - halfD);
    expect(pos.z).toBeLessThanOrEqual(room.z + halfD);
  });
});

describe('survive spawns respect encounter lock', () => {
  beforeEach(() => {
    resetGameState();
    QUEST_DEFS[TEST_QUEST_ID] = {
      id: TEST_QUEST_ID,
      enemyPool: [{ type: 'grunt', weight: 1 }],
      tiers: {
        1: {
          name: 'Boss Survive Test',
          description: 'Survive + stage boss.',
          objectiveType: 'survive',
          totalSpawns: 5,
          rewardCurrency: 10,
          layoutProfile: 'open-plaza',
          stageBossEncounter: STAGE_BOSS_CONFIG,
        },
      },
    };
    gameState.selectedQuestId = TEST_QUEST_ID;
    gameState.selectedQuestTier = 1;
    gameState.layoutSeed = SEED;
    gameState.layout = generateLayout(
      SEED,
      getLayoutProfileForQuest(TEST_QUEST_ID, 1),
    );
    gameState.gamePhase = 'playing';
    gameState.enemies = [];
    startDungeonRun();
    initRunEncounter(gameState.run, { stageBossEncounter: STAGE_BOSS_CONFIG });
    startStageBossEncounter(gameState, buildObjectiveSpawnCtx());
  });

  afterEach(() => {
    delete QUEST_DEFS[TEST_QUEST_ID];
    gameState.selectedQuestId = 'training_caverns';
    gameState.selectedQuestTier = 1;
  });

  it('does not release survive-wave enemies while locked', () => {
    let now = 1_000_000;
    for (let i = 0; i < 20; i++) {
      updateSurviveSpawns(now);
      now += 60_000;
    }
    expect(gameState.enemies.length).toBe(1);
    expect(gameState.enemies[0].isStageBoss).toBe(true);
  });
});
