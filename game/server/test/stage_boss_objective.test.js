import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { getObjectiveDef, isValidObjectiveType } from '../objectives.js';
import { activateEncounter, clearEncounter } from '../encounters.js';
import { createGameState } from '../game-state.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  spawnEnemy,
  isRunObjectiveComplete,
} from '../progression.js';
// Progression and simulation load shared modules via require(); tests must too.
const require = createRequire(import.meta.url);
const { QUEST_DEFS } = require('../quests.js');
const { ENEMY_DEFS, setGameState: setSimulationGameState } = require('../simulation.js');
import {
  DIFFICULTY_MINIBOSS_HP_PER_PLAYER,
  difficultyScaleFactor,
} from '../config.js';

const SEED = 4242;
const FIXTURE_QUEST_ID = 'stage_boss_fixture_quest';

function openPlazaLayout(seed = SEED) {
  return generateLayout(seed, 'open-plaza');
}

function stageBossQuest(overrides = {}) {
  return {
    id: FIXTURE_QUEST_ID,
    tier: 1,
    name: 'Stage Boss Fixture',
    description: 'Fixture stage boss quest',
    objectiveType: 'stage_boss',
    rewardCurrency: 1,
    layoutProfile: 'open-plaza',
    encounter: {
      bossType: 'miniboss',
      landmark: 'arena_dais',
      addCount: 3,
      ...overrides.encounter,
    },
    ...overrides,
  };
}

function setPartySize(state, count) {
  Object.keys(state.players).forEach((k) => delete state.players[k]);
  for (let i = 1; i <= count; i++) {
    state.players[`p${i}`] = {
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

function deployStageBossRun(state, { seed = SEED, partySize = 1, encounterOverrides = {} } = {}) {
  const tierDef = QUEST_DEFS[FIXTURE_QUEST_ID].tiers[1];
  const savedEncounter = { ...tierDef.encounter };
  if (Object.keys(encounterOverrides).length > 0) {
    tierDef.encounter = { ...savedEncounter, ...encounterOverrides };
  }

  setPartySize(state, partySize);
  state.selectedQuestId = FIXTURE_QUEST_ID;
  state.selectedQuestTier = 1;
  state.layout = openPlazaLayout(seed);
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.gamePhase = 'playing';
  setGameState(state);
  setSimulationGameState(state);
  spawnEnemies();
  startDungeonRun();

  if (Object.keys(encounterOverrides).length > 0) {
    tierDef.encounter = savedEncounter;
  }

  return state;
}

beforeAll(() => {
  QUEST_DEFS[FIXTURE_QUEST_ID] = {
    id: FIXTURE_QUEST_ID,
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Stage Boss Fixture',
        description: 'Fixture stage boss quest',
        objectiveType: 'stage_boss',
        rewardCurrency: 1,
        layoutProfile: 'open-plaza',
        encounter: {
          bossType: 'miniboss',
          landmark: 'arena_dais',
          addCount: 3,
        },
      },
    },
  };
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('stage_boss objective registry', () => {
  it('is a valid objective type with bulk spawn skipped', () => {
    expect(isValidObjectiveType('stage_boss')).toBe(true);
    const def = getObjectiveDef('stage_boss');
    expect(def.skipBulkCombatSpawn()).toBe(true);
    expect(def.preferNearestEnemySpawns()).toBe(false);
  });

  it('createObjective tracks boss-focused progress fields', () => {
    const objective = getObjectiveDef('stage_boss').createObjective(stageBossQuest());
    expect(objective).toMatchObject({
      type: 'stage_boss',
      bossDefeated: false,
      addCount: 3,
    });
  });

  it('isComplete requires encounter cleared or bossDefeated flag', () => {
    const def = getObjectiveDef('stage_boss');
    const objective = def.createObjective(stageBossQuest());
    const run = { encounter: { phase: 'dormant' } };
    expect(def.isComplete(objective, run)).toBe(false);

    activateEncounter(run);
    expect(def.isComplete(objective, run)).toBe(false);

    clearEncounter(run);
    expect(def.isComplete(objective, run)).toBe(true);

    const clearedByFlag = def.createObjective(stageBossQuest());
    clearedByFlag.bossDefeated = true;
    expect(def.isComplete(clearedByFlag, { encounter: { phase: 'dormant' } })).toBe(true);
  });

  it('isRunObjectiveComplete does not treat add kills as victory', () => {
    const state = createGameState();
    deployStageBossRun(state);
    state.run.objective.defeatedEnemies = 99;
    expect(isRunObjectiveComplete(state.run.objective)).toBe(false);
  });
});

describe('stage_boss spawnQuestEntities', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
  });

  it('spawns one miniboss at arena_dais and wires bossEnemyId on run open', () => {
    deployStageBossRun(state);
    const dais = state.layout.landmarks.find((lm) => lm.type === 'arena_dais');

    const bosses = state.enemies.filter((e) => e.type === 'miniboss');
    expect(bosses).toHaveLength(1);
    expect(bosses[0].x).toBe(dais.x);
    expect(bosses[0].z).toBe(dais.z);
    expect(state.run.encounter.bossEnemyId).toBe(bosses[0].id);
    expect(state._pendingEncounterBossId).toBeUndefined();
  });

  it('spawns exactly addCount regular adds from the quest pool (no extra bulk pack)', () => {
    deployStageBossRun(state);
    const adds = state.enemies.filter((e) => e.type !== 'miniboss');
    expect(adds).toHaveLength(3);
    for (const add of adds) {
      expect(['grunt', 'skirmisher']).toContain(add.type);
    }
  });

  it('falls back to room center when the landmark is missing', () => {
    const layout = openPlazaLayout();
    layout.landmarks = [];
    state.selectedQuestId = FIXTURE_QUEST_ID;
    state.selectedQuestTier = 1;
    state.layout = layout;
    state.layoutSeed = SEED;
    state.enemies = [];
    state.gamePhase = 'playing';
    const tierDef = QUEST_DEFS[FIXTURE_QUEST_ID].tiers[1];
    const savedLandmark = tierDef.encounter.landmark;
    tierDef.encounter.landmark = 'missing_landmark';
    setPartySize(state, 1);
    setGameState(state);
    setSimulationGameState(state);
    spawnEnemies();
    startDungeonRun();
    tierDef.encounter.landmark = savedLandmark;

    const plaza = layout.rooms[0];
    const boss = state.enemies.find((e) => e.type === 'miniboss');
    expect(boss.x).toBe(plaza.x);
    expect(boss.z).toBe(plaza.z);
  });

  it('skips bulk defeat_enemies spawn for stage_boss quests', () => {
    deployStageBossRun(state);
    expect(state.enemies).toHaveLength(4);
  });

  it('scales miniboss HP for parties of 5+ at spawn', () => {
    const baseHp = ENEMY_DEFS.miniboss.hp;
    deployStageBossRun(state, { partySize: 8 });
    const boss = state.enemies.find((e) => e.type === 'miniboss');
    const expected = Math.round(
      baseHp * difficultyScaleFactor(8, DIFFICULTY_MINIBOSS_HP_PER_PLAYER),
    );
    expect(boss.hp).toBe(expected);
    expect(boss.maxHp).toBe(expected);
    expect(boss.hp).toBeGreaterThan(baseHp);
  });

  it('leaves adds at baseline HP regardless of party size', () => {
    deployStageBossRun(state, { partySize: 12 });
    const gruntHp = ENEMY_DEFS.grunt.hp;
    const adds = state.enemies.filter((e) => e.type !== 'miniboss');
    expect(adds.length).toBeGreaterThan(0);
    for (const add of adds) {
      expect(add.hp).toBe(ENEMY_DEFS[add.type].hp);
    }
    expect(adds.some((e) => e.type === 'grunt')).toBe(true);
    expect(adds.find((e) => e.type === 'grunt').hp).toBe(gruntHp);
  });
});

describe('stage_boss spawnQuestEntities direct harness', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
    setPartySize(state, 4);
    setGameState(state);
    setSimulationGameState(state);
  });

  it('spawnEnemy party scaling matches miniboss_hp_scaling for stage boss spawn path', () => {
    const layout = openPlazaLayout();
    const rng = () => 0.5;
    const quest = stageBossQuest({ encounter: { landmark: 'arena_dais', addCount: 0 } });
    state.run = {
      encounter: { phase: 'dormant', bossEnemyId: null, locked: false, spawnAnchor: null },
    };

    setPartySize(state, 6);
    const def = getObjectiveDef('stage_boss');
    def.spawnQuestEntities(layout, rng, quest, state, {
      spawnEnemy,
      pickEnemySpawnPosition: () => ({ x: 5, z: 5 }),
      roomTierAt: () => 0,
      randomWanderTarget: () => ({ x: 0, z: 0 }),
    });

    const boss = state.enemies.find((e) => e.type === 'miniboss');
    const expected = Math.round(
      ENEMY_DEFS.miniboss.hp * difficultyScaleFactor(6, DIFFICULTY_MINIBOSS_HP_PER_PLAYER),
    );
    expect(boss.hp).toBe(expected);
    expect(state.run.encounter.bossEnemyId).toBe(boss.id);
  });
});
