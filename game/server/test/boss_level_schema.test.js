import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateLayout } from '../dungeon.js';

const require = createRequire(import.meta.url);
const {
  QUEST_DEFS,
  BOSS_LEVEL_FIXTURE_DEF,
  getQuest,
  isBossLevelQuest,
  getLayoutProfileForQuest,
} = require('../quests.js');

const FIXTURE_QUEST_ID = BOSS_LEVEL_FIXTURE_DEF.id;
const SEED = 38501;

function fixtureQuest(tier = 1) {
  const tierDef = BOSS_LEVEL_FIXTURE_DEF.tiers[tier];
  return {
    id: FIXTURE_QUEST_ID,
    questId: FIXTURE_QUEST_ID,
    tier,
    ...tierDef,
  };
}

function assertValidBossLevelTierDef(tierDef) {
  expect(tierDef.objectiveType).toBe('stage_boss');
  expect(tierDef.encounter).toBeTruthy();
  expect(typeof tierDef.encounter).toBe('object');
  expect(tierDef.levelKind).toBe('boss_level');
}

beforeAll(() => {
  QUEST_DEFS[FIXTURE_QUEST_ID] = BOSS_LEVEL_FIXTURE_DEF;
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('isBossLevelQuest', () => {
  it('returns true only when levelKind is boss_level', () => {
    expect(isBossLevelQuest(fixtureQuest(1))).toBe(true);
    expect(isBossLevelQuest({ levelKind: 'boss_level' })).toBe(true);
    expect(isBossLevelQuest({ levelKind: 'other' })).toBe(false);
    expect(isBossLevelQuest({ objectiveType: 'stage_boss' })).toBe(false);
    expect(isBossLevelQuest(null)).toBe(false);
    expect(isBossLevelQuest(undefined)).toBe(false);
  });
});

describe('getQuest levelKind surfacing', () => {
  it('includes levelKind on the resolved quest object', () => {
    const quest = getQuest(FIXTURE_QUEST_ID, 1);
    expect(quest.levelKind).toBe('boss_level');
    expect(quest.objectiveType).toBe('stage_boss');
    expect(quest.encounter?.landmark).toBe('arena_dais');
  });
});

describe('getLayoutProfileForQuest boss-level defaults', () => {
  it('defaults to boss-arena when levelKind is boss_level and no layoutProfile is set', () => {
    expect(getLayoutProfileForQuest(FIXTURE_QUEST_ID, 1)).toBe('boss-arena');
  });

  it('honours an explicit layoutProfile on boss-level tiers', () => {
    expect(getLayoutProfileForQuest(FIXTURE_QUEST_ID, 2)).toBe('boss-arena');
    expect(getQuest(FIXTURE_QUEST_ID, 2).layoutProfile).toBe('boss-arena');
  });

  it('does not treat ordinary stage_boss tiers as boss-level layouts', () => {
    expect(getLayoutProfileForQuest('arena_trials', 2)).toBe('open-plaza');
    expect(isBossLevelQuest(getQuest('arena_trials', 2))).toBe(false);
  });
});

describe("generateLayout(seed, 'boss-arena')", () => {
  it('returns a single-room arena with centre arena_dais and sparse cover', () => {
    const layout = generateLayout(SEED, 'boss-arena');
    const plaza = generateLayout(SEED, 'open-plaza');

    expect(layout.profile).toBe('boss-arena');
    expect(layout.rooms.length).toBe(1);
    expect(layout.passages.length).toBe(0);
    expect(layout.rooms[0].walls.length).toBe(4);
    expect(layout.landmarks).toEqual([{ x: 0, z: 0, type: 'arena_dais' }]);
    expect(layout.cover.length).toBeGreaterThan(0);
    expect(layout.cover.length).toBeLessThan(plaza.cover.length);
    expect(layout.rooms[0].width * layout.rooms[0].depth).toBeLessThan(
      plaza.rooms[0].width * plaza.rooms[0].depth,
    );
  });

  it('is deterministic for a fixed seed', () => {
    const a = generateLayout(SEED, 'boss-arena');
    const b = generateLayout(SEED, 'boss-arena');
    expect(a).toEqual(b);
  });
});

describe('boss-level tier validation', () => {
  it('fixture tier def pairs boss_level with stage_boss and encounter', () => {
    assertValidBossLevelTierDef(BOSS_LEVEL_FIXTURE_DEF.tiers[1]);
    assertValidBossLevelTierDef(BOSS_LEVEL_FIXTURE_DEF.tiers[2]);
  });

  it('every registered boss-level quest tier has required companion fields', () => {
    for (const [questId, questDef] of Object.entries(QUEST_DEFS)) {
      for (const [tierKey, tierDef] of Object.entries(questDef.tiers || {})) {
        if (tierDef.levelKind !== 'boss_level') continue;
        expect(
          tierDef.objectiveType,
          `${questId} tier ${tierKey} boss_level must use objectiveType stage_boss`,
        ).toBe('stage_boss');
        expect(
          tierDef.encounter,
          `${questId} tier ${tierKey} boss_level must declare an encounter block`,
        ).toBeTruthy();
      }
    }
  });
});
