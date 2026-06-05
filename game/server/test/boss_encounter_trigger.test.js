import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isEncounterLocked,
  isStageBossEnemy,
  playerInRoomWithRole,
  tryStartStageBossEncounter,
} from '../bossEncounter.js';
import { generateLayout } from '../dungeon.js';
import { getLayoutProfileForQuest } from '../quests.js';
import {
  gameState,
  resetGameState,
  spawnEnemies,
  startDungeonRun,
  tickStageBossEncounter,
  buildObjectiveSpawnCtx,
  isPlayerActive,
} from '../index.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS } = require('../quests.js');

const TEST_QUEST_ID = '__boss_encounter_trigger_test__';
const SEED = 5151;

const DEPLOY_CONFIG = {
  bossType: 'miniboss',
  trigger: 'deploy',
  roomRole: 'combat',
};

const ENTER_ROOM_CONFIG = {
  bossType: 'miniboss',
  trigger: 'enter_room',
  roomRole: 'treasure',
};

const TWO_ROOM_LAYOUT = {
  rooms: [
    { x: 0, z: 0, width: 20, depth: 20, role: 'start', walls: [], encounterTier: 0 },
    { x: 40, z: 0, width: 20, depth: 20, role: 'treasure', walls: [], encounterTier: 0 },
  ],
  passages: [],
  walls: [],
};

function setPartySize(count, pos = { x: 0, z: 0 }) {
  Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
  for (let i = 1; i <= count; i++) {
    gameState.players[`p${i}`] = {
      x: pos.x,
      y: 0.5,
      z: pos.z,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
    };
  }
}

function deployEncounterQuest(config, layout = null) {
  gameState.selectedQuestId = TEST_QUEST_ID;
  gameState.selectedQuestTier = 1;
  gameState.layoutSeed = SEED;
  gameState.layout = layout ?? generateLayout(
    SEED,
    getLayoutProfileForQuest(TEST_QUEST_ID, 1),
  );
  gameState.enemies = [];
  gameState.loot = [];
  gameState.gamePhase = 'playing';
  spawnEnemies();
  startDungeonRun();
}

describe('playerInRoomWithRole', () => {
  it('detects containment inside a room with the matching role', () => {
    expect(playerInRoomWithRole(TWO_ROOM_LAYOUT, 0, 0, 'start')).toBe(true);
    expect(playerInRoomWithRole(TWO_ROOM_LAYOUT, 40, 0, 'treasure')).toBe(true);
    expect(playerInRoomWithRole(TWO_ROOM_LAYOUT, 0, 0, 'treasure')).toBe(false);
    expect(playerInRoomWithRole(TWO_ROOM_LAYOUT, 40, 0, 'start')).toBe(false);
  });
});

describe('deploy trigger (open-plaza)', () => {
  beforeEach(() => {
    resetGameState();
    QUEST_DEFS[TEST_QUEST_ID] = {
      id: TEST_QUEST_ID,
      enemyPool: [{ type: 'grunt', weight: 1 }],
      tiers: {
        1: {
          name: 'Deploy Trigger Test',
          description: 'Stage boss on deploy.',
          objectiveType: 'defeat_enemies',
          enemyCount: 6,
          rewardCurrency: 10,
          layoutProfile: 'open-plaza',
          stageBossEncounter: DEPLOY_CONFIG,
        },
      },
    };
    setPartySize(1);
  });

  afterEach(() => {
    delete QUEST_DEFS[TEST_QUEST_ID];
    gameState.selectedQuestId = 'training_caverns';
    gameState.selectedQuestTier = 1;
  });

  it('activates on startDungeonRun with no bulk mob pack', () => {
    deployEncounterQuest(DEPLOY_CONFIG);

    expect(gameState.run.encounter.status).toBe('active');
    expect(isEncounterLocked(gameState.run)).toBe(true);
    expect(gameState.enemies.length).toBe(1);
    expect(gameState.enemies[0].type).toBe('miniboss');
    expect(gameState.enemies[0].isStageBoss).toBe(true);
    expect(isStageBossEnemy(gameState.enemies[0], gameState.run)).toBe(true);
  });

  it('promotes pending → active only once', () => {
    deployEncounterQuest(DEPLOY_CONFIG);
    const bossId = gameState.run.encounter.bossEnemyId;

    const again = tryStartStageBossEncounter(gameState, {
      spawnCtx: buildObjectiveSpawnCtx(),
      isPlayerActive,
    });
    expect(again).toBe(false);
    expect(gameState.enemies.length).toBe(1);
    expect(gameState.run.encounter.bossEnemyId).toBe(bossId);
  });

  it('does not re-activate on subsequent ticks', () => {
    deployEncounterQuest(DEPLOY_CONFIG);
    const bossId = gameState.run.encounter.bossEnemyId;

    expect(tickStageBossEncounter()).toBe(false);
    expect(gameState.run.encounter.bossEnemyId).toBe(bossId);
    expect(gameState.enemies.length).toBe(1);
  });
});

describe('enter_room trigger (two-room layout)', () => {
  beforeEach(() => {
    resetGameState();
    QUEST_DEFS[TEST_QUEST_ID] = {
      id: TEST_QUEST_ID,
      enemyPool: [{ type: 'grunt', weight: 1 }],
      tiers: {
        1: {
          name: 'Room Entry Trigger Test',
          description: 'Stage boss on treasure room entry.',
          objectiveType: 'defeat_enemies',
          enemyCount: 4,
          rewardCurrency: 10,
          layoutProfile: 'default',
          stageBossEncounter: ENTER_ROOM_CONFIG,
        },
      },
    };
    setPartySize(1, { x: 0, z: 0 });
  });

  afterEach(() => {
    delete QUEST_DEFS[TEST_QUEST_ID];
    gameState.selectedQuestId = 'training_caverns';
    gameState.selectedQuestTier = 1;
  });

  it('stays pending until an active player enters the target room', () => {
    deployEncounterQuest(ENTER_ROOM_CONFIG, TWO_ROOM_LAYOUT);

    expect(gameState.run.encounter.status).toBe('pending');
    expect(gameState.enemies.length).toBe(0);

    const spawnCtx = buildObjectiveSpawnCtx();
    expect(tryStartStageBossEncounter(gameState, { spawnCtx, isPlayerActive })).toBe(false);

    gameState.players.p1.x = 40;
    gameState.players.p1.z = 0;

    expect(tryStartStageBossEncounter(gameState, { spawnCtx, isPlayerActive })).toBe(true);
    expect(gameState.run.encounter.status).toBe('active');
    expect(gameState.enemies.length).toBe(1);
    expect(gameState.enemies[0].isStageBoss).toBe(true);
  });

  it('ignores dead or extracted players for room entry', () => {
    deployEncounterQuest(ENTER_ROOM_CONFIG, TWO_ROOM_LAYOUT);
    gameState.players.p1.x = 40;
    gameState.players.p1.z = 0;
    gameState.players.p1.extracted = true;

    const spawnCtx = buildObjectiveSpawnCtx();
    expect(tryStartStageBossEncounter(gameState, { spawnCtx, isPlayerActive })).toBe(false);
    expect(gameState.run.encounter.status).toBe('pending');

    gameState.players.p1.extracted = false;
    gameState.players.p1.dead = true;
    expect(tryStartStageBossEncounter(gameState, { spawnCtx, isPlayerActive })).toBe(false);

    gameState.players.p1.dead = false;
    expect(tryStartStageBossEncounter(gameState, { spawnCtx, isPlayerActive })).toBe(true);
  });

  it('activates via tickStageBossEncounter after movement into the room', () => {
    deployEncounterQuest(ENTER_ROOM_CONFIG, TWO_ROOM_LAYOUT);
    gameState.players.p1.x = 40;
    gameState.players.p1.z = 0;

    expect(tickStageBossEncounter()).toBe(true);
    expect(gameState.run.encounter.status).toBe('active');
    expect(gameState.enemies.length).toBe(1);
  });
});
