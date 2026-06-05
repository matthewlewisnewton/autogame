import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OBJECTIVE_DEFS, getObjectiveDef, isValidObjectiveType } from '../objectives.js';
import { listQuests } from '../quests.js';

const FAKE_TYPE = 'test_fake_objective';

describe('OBJECTIVE_DEFS extensibility', () => {
  beforeEach(() => {
    OBJECTIVE_DEFS[FAKE_TYPE] = {
      objectiveType: FAKE_TYPE,
      skipBulkCombatSpawn() {
        return false;
      },
      preferNearestEnemySpawns() {
        return false;
      },
      createObjective(quest) {
        return {
          type: FAKE_TYPE,
          label: `${quest.name}: test`,
          target: 1,
          progress: 0,
        };
      },
      isComplete(objective) {
        return objective.progress >= objective.target;
      },
      clampProgress() {
        // no-op
      },
    };
  });

  afterEach(() => {
    delete OBJECTIVE_DEFS[FAKE_TYPE];
  });

  it('supports a new type via one OBJECTIVE_DEFS entry without createRunState branches', () => {
    expect(isValidObjectiveType(FAKE_TYPE)).toBe(true);
    const def = getObjectiveDef(FAKE_TYPE);
    expect(def).toBe(OBJECTIVE_DEFS[FAKE_TYPE]);

    const quest = { name: 'Fake Quest', description: 'Prove registry extensibility' };
    const objective = def.createObjective(quest, { enemyCount: 0 });
    expect(objective.type).toBe(FAKE_TYPE);
    expect(def.isComplete(objective)).toBe(false);

    objective.progress = 1;
    expect(def.isComplete(objective)).toBe(true);

    expect(def.skipBulkCombatSpawn()).toBe(false);
    expect(def.preferNearestEnemySpawns()).toBe(false);
    expect(() => def.clampProgress({ objective })).not.toThrow();
  });
});

describe('quest objective alignment', () => {
  it('every tier-1 quest objectiveType has a matching OBJECTIVE_DEFS key', () => {
    for (const quest of listQuests()) {
      expect(
        isValidObjectiveType(quest.objectiveType),
        `quest "${quest.id}" references unregistered objectiveType "${quest.objectiveType}"`
      ).toBe(true);
      expect(OBJECTIVE_DEFS[quest.objectiveType].objectiveType).toBe(quest.objectiveType);
    }
  });
});
