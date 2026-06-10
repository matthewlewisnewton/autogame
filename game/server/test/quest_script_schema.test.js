import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getObjectiveDef } from '../objectives.js';

const require = createRequire(import.meta.url);
const {
  QUEST_DEFS,
  getQuest,
  getQuestScript,
  countScriptedEnemies,
} = require('../quests.js');

const FIXTURE_QUEST_ID = 'quest_script_fixture';

function scriptedQuest(overrides = {}) {
  return {
    id: FIXTURE_QUEST_ID,
    tier: 1,
    name: 'Scripted Fixture',
    description: 'Fixture scripted defeat_enemies quest',
    objectiveType: 'defeat_enemies',
    enemyCount: 99,
    rewardCurrency: 1,
    layoutProfile: 'crowded',
    script: {
      waves: [
        {
          id: 'wave_a',
          trigger: 'run_start',
          spawns: [
            { type: 'grunt', x: 1, z: 2 },
            { type: 'skirmisher', x: 3, z: 4 },
          ],
        },
        {
          id: 'wave_b',
          trigger: { waveCleared: 'wave_a' },
          room: { landmark: 'vault_dais' },
          spawns: [
            { type: 'grunt', x: 5, z: 6 },
          ],
        },
      ],
      ...overrides.script,
    },
    ...overrides,
  };
}

beforeAll(() => {
  QUEST_DEFS[FIXTURE_QUEST_ID] = {
    id: FIXTURE_QUEST_ID,
    enemyPool: [{ type: 'grunt', weight: 1 }],
    tiers: {
      1: {
        name: 'Scripted Fixture',
        description: 'Fixture scripted defeat_enemies quest',
        objectiveType: 'defeat_enemies',
        enemyCount: 99,
        rewardCurrency: 1,
        layoutProfile: 'crowded',
        script: {
          waves: [
            {
              id: 'wave_a',
              trigger: 'run_start',
              spawns: [
                { type: 'grunt', x: 1, z: 2 },
                { type: 'skirmisher', x: 3, z: 4 },
              ],
            },
            {
              id: 'wave_b',
              trigger: { waveCleared: 'wave_a' },
              room: { landmark: 'vault_dais' },
              spawns: [
                { type: 'grunt', x: 5, z: 6 },
              ],
            },
          ],
        },
      },
    },
  };
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('getQuestScript', () => {
  it('returns normalized waves when script.waves is present on a tier', () => {
    const quest = getQuest(FIXTURE_QUEST_ID, 1);
    const script = getQuestScript(quest);
    expect(script).not.toBeNull();
    expect(script.waves).toHaveLength(2);
    expect(script.waves[0]).toMatchObject({
      id: 'wave_a',
      trigger: 'run_start',
      spawns: [
        { type: 'grunt', x: 1, z: 2 },
        { type: 'skirmisher', x: 3, z: 4 },
      ],
    });
    expect(script.waves[1]).toMatchObject({
      id: 'wave_b',
      trigger: { waveCleared: 'wave_a' },
      room: { landmark: 'vault_dais' },
      spawns: [{ type: 'grunt', x: 5, z: 6 }],
    });
  });

  it('returns null when script or waves are absent', () => {
    expect(getQuestScript(getQuest('arena_trials', 1))).toBeNull();
    expect(getQuestScript(null)).toBeNull();
    expect(getQuestScript({ name: 'No script' })).toBeNull();
    expect(getQuestScript({ script: {} })).toBeNull();
    expect(getQuestScript({ script: { waves: [] } })).toBeNull();
  });
});

describe('countScriptedEnemies', () => {
  it('sums spawns.length across all waves', () => {
    const script = getQuestScript(scriptedQuest());
    expect(countScriptedEnemies(script)).toBe(3);
  });

  it('returns 0 for null or empty script', () => {
    expect(countScriptedEnemies(null)).toBe(0);
    expect(countScriptedEnemies({ waves: [] })).toBe(0);
  });
});

describe('defeat_enemies scripted bypass', () => {
  const def = getObjectiveDef('defeat_enemies');

  it('skips bulk combat spawn when the tier has script.waves', () => {
    expect(def.skipBulkCombatSpawn(scriptedQuest())).toBe(true);
  });

  it('does not skip bulk combat spawn for unscripted production quests', () => {
    expect(def.skipBulkCombatSpawn(getQuest('arena_trials', 1))).toBe(false);
    expect(def.skipBulkCombatSpawn(getQuest('canyon_descent', 1))).toBe(false);
  });

  it('skips bulk combat spawn for scripted production quest tiers', () => {
    expect(def.skipBulkCombatSpawn(getQuest('frost_crossing', 1))).toBe(true);
    expect(def.skipBulkCombatSpawn(getQuest('training_caverns', 1))).toBe(true);
    expect(def.skipBulkCombatSpawn(getQuest('ember_descent', 1))).toBe(true);
  });

  it('createObjective uses scripted spawn count and ignores enemyCount', () => {
    const objective = def.createObjective(scriptedQuest(), { enemyCount: 99 });
    expect(objective.totalEnemies).toBe(3);
  });

  it('createObjective still uses enemyCount for unscripted tiers', () => {
    const quest = getQuest('arena_trials', 1);
    const objective = def.createObjective(quest, { enemyCount: quest.enemyCount });
    expect(objective.totalEnemies).toBe(quest.enemyCount);
    expect(objective.totalEnemies).toBe(6);
  });
});
