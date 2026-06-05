import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getEncounterConfig,
  getStageBossEncounterConfig,
  initRunEncounter,
  isEncounterLocked,
  setEncounterActive,
  setEncounterCleared,
  isStageBossEnemy,
} from '../bossEncounter.js';
import { getQuest } from '../quests.js';
import { gameState, createRunState, resetGameState } from '../index.js';

// Mutate the same CJS catalog object progression reads via require('./quests').
const require = createRequire(import.meta.url);
const { QUEST_DEFS } = require('../quests.js');

const TEST_QUEST_ID = '__boss_encounter_test__';

const VALID_CONFIG = {
  bossType: 'miniboss',
  trigger: 'deploy',
  roomRole: 'combat',
  rewardCurrencyBonus: 5,
  unlockOnClear: { questId: 'arena_trials', tier: 2 },
};

describe('getEncounterConfig', () => {
  it('returns null for quests without stageBossEncounter', () => {
    expect(getEncounterConfig(getQuest('training_caverns'))).toBeNull();
    expect(getEncounterConfig(getQuest('arena_trials', 1))).toBeNull();
    expect(getEncounterConfig(null)).toBeNull();
  });

  it('resolves arena_trials Tier 2 stage-boss config', () => {
    expect(getEncounterConfig(getQuest('arena_trials', 2))).toEqual({
      bossType: 'miniboss',
      trigger: 'deploy',
      rewardCurrencyBonus: 5,
    });
  });

  it('resolves a valid stageBossEncounter from a quest tier def', () => {
    const quest = {
      id: 'test_quest',
      stageBossEncounter: VALID_CONFIG,
    };
    expect(getStageBossEncounterConfig(quest)).toEqual(VALID_CONFIG);
  });

  it('rejects malformed configs missing bossType or trigger', () => {
    expect(getEncounterConfig({ stageBossEncounter: { trigger: 'deploy' } })).toBeNull();
    expect(getEncounterConfig({ stageBossEncounter: { bossType: 'miniboss' } })).toBeNull();
    expect(getEncounterConfig({ stageBossEncounter: { bossType: '', trigger: 'deploy' } })).toBeNull();
  });

  it('rejects invalid optional fields', () => {
    expect(
      getEncounterConfig({
        stageBossEncounter: { bossType: 'miniboss', trigger: 'deploy', rewardCurrencyBonus: -1 },
      })
    ).toBeNull();
    expect(
      getEncounterConfig({
        stageBossEncounter: {
          bossType: 'miniboss',
          trigger: 'deploy',
          unlockOnClear: { questId: 'arena_trials', tier: 0 },
        },
      })
    ).toBeNull();
  });

  it('accepts minimal bossType + trigger only', () => {
    expect(
      getEncounterConfig({
        stageBossEncounter: { bossType: 'miniboss', trigger: 'room_enter' },
      })
    ).toEqual({ bossType: 'miniboss', trigger: 'room_enter' });
  });
});

describe('initRunEncounter and createRunState', () => {
  beforeEach(() => {
    resetGameState();
    QUEST_DEFS[TEST_QUEST_ID] = {
      id: TEST_QUEST_ID,
      enemyPool: [{ type: 'grunt', weight: 1 }],
      tiers: {
        1: {
          name: 'Encounter Test Tier',
          description: 'Test-only tier for stage-boss init.',
          objectiveType: 'defeat_enemies',
          enemyCount: 1,
          rewardCurrency: 10,
          layoutProfile: 'open-plaza',
          stageBossEncounter: VALID_CONFIG,
        },
      },
    };
    gameState.selectedQuestId = TEST_QUEST_ID;
    gameState.selectedQuestTier = 1;
  });

  afterEach(() => {
    delete QUEST_DEFS[TEST_QUEST_ID];
    gameState.selectedQuestId = 'training_caverns';
    gameState.selectedQuestTier = 1;
  });

  it('initializes run.encounter on createRunState when config is present', () => {
    const run = createRunState();

    expect(run.encounter).toEqual({
      status: 'pending',
      bossType: 'miniboss',
      bossEnemyId: null,
      trigger: 'deploy',
      roomRole: 'combat',
      rewardCurrencyBonus: 5,
      unlockOnClear: { questId: 'arena_trials', tier: 2 },
    });
  });

  it('leaves run.encounter undefined for quests without stageBossEncounter', () => {
    gameState.selectedQuestId = 'training_caverns';
    gameState.selectedQuestTier = 1;

    const run = createRunState();
    expect(run.encounter).toBeUndefined();
  });

  it('initRunEncounter is a no-op when config is absent', () => {
    const run = { id: 'run-1' };
    initRunEncounter(run, getQuest('training_caverns'));
    expect(run.encounter).toBeUndefined();
  });
});

describe('encounter state transitions', () => {
  /** @type {object} */
  let run;

  beforeEach(() => {
    run = { id: 'run-1' };
    initRunEncounter(run, { stageBossEncounter: { bossType: 'miniboss', trigger: 'deploy' } });
  });

  it('starts pending and unlocked', () => {
    expect(run.encounter.status).toBe('pending');
    expect(isEncounterLocked(run)).toBe(false);
  });

  it('transitions pending → active → cleared', () => {
    setEncounterActive(run);
    expect(run.encounter.status).toBe('active');
    expect(isEncounterLocked(run)).toBe(true);

    setEncounterCleared(run);
    expect(run.encounter.status).toBe('cleared');
    expect(isEncounterLocked(run)).toBe(false);
  });

  it('rejects invalid transitions', () => {
    expect(() => setEncounterCleared(run)).toThrow(/pending/);
    setEncounterActive(run);
    expect(() => setEncounterActive(run)).toThrow(/active/);
    setEncounterCleared(run);
    expect(() => setEncounterActive(run)).toThrow(/cleared/);
  });
});

describe('isStageBossEnemy', () => {
  it('matches the spawned boss enemy id on the run', () => {
    const run = { id: 'run-1' };
    initRunEncounter(run, { stageBossEncounter: { bossType: 'miniboss', trigger: 'deploy' } });
    run.encounter.bossEnemyId = 'boss-42';

    expect(isStageBossEnemy({ id: 'boss-42' }, run)).toBe(true);
    expect(isStageBossEnemy({ id: 'other' }, run)).toBe(false);
    expect(isStageBossEnemy({ id: 'boss-42' }, { encounter: { bossEnemyId: null } })).toBe(false);
    expect(isStageBossEnemy(null, run)).toBe(false);
  });
});
