import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  ENCOUNTER_PHASES,
  ENCOUNTER_TRIGGER_RADIUS,
  tryActivateEncounter,
  isEncounterCleared,
} from '../encounters.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  cleanupAfterDamage,
  checkRunTerminalState,
  isRunObjectiveComplete,
} from '../progression.js';
import {
  getQuest,
  getEncounterConfig,
  formatObjectiveSummary,
  getLayoutProfileForQuest,
  isBossLevelQuest,
} from '../quests.js';

const require = createRequire(import.meta.url);
const { setGameState: setSimulationGameState } = require('../simulation.js');

const SEED = 38504;

const BOSS_LEVEL_QUESTS = [
  {
    questId: 'crucible_duel',
    tier: 1,
    bossType: 'crucible_sovereign',
    addCount: 0,
    objectiveSummary: 'Defeat Crucible Sovereign',
  },
  {
    questId: 'vault_onslaught',
    tier: 1,
    bossType: 'annex_overseer',
    addCount: 2,
    objectiveSummary: 'Defeat Annex Overseer and 2 supports',
  },
];

function bossArenaLayout(seed = SEED) {
  return generateLayout(seed, 'boss-arena');
}

function setPartySize(state, count, position = { x: -20, z: 0 }) {
  Object.keys(state.players).forEach((k) => delete state.players[k]);
  for (let i = 1; i <= count; i++) {
    state.players[`p${i}`] = {
      x: position.x + i,
      y: 0.5,
      z: position.z,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
      accountId: `acct-${i}`,
    };
  }
}

function deployBossLevelRun(state, { questId, tier, seed = SEED, partySize = 1 } = {}) {
  setPartySize(state, partySize);
  state.selectedQuestId = questId;
  state.selectedQuestTier = tier;
  state.layout = bossArenaLayout(seed);
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.gamePhase = 'playing';
  setGameState(state);
  setSimulationGameState(state);
  spawnEnemies();
  startDungeonRun();
  return state;
}

function bossEnemy(state) {
  return state.enemies.find((e) => e.id === state.run.encounter.bossEnemyId);
}

function activateEncounterForTest(state) {
  const bossId = state.run.encounter.bossEnemyId;
  for (const enemy of state.enemies) {
    if (enemy.id !== bossId) enemy.hp = 0;
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  const anchor = state.run.encounter.spawnAnchor;
  if (anchor && state.players.p1) {
    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;
  }
  tryActivateEncounter(state);
}

function assertBossLevelSchema(questId, tier, bossType) {
  const quest = getQuest(questId, tier);
  expect(quest.levelKind).toBe('boss_level');
  expect(quest.layoutProfile).toBe('boss-arena');
  expect(quest.objectiveType).toBe('stage_boss');
  expect(isBossLevelQuest(quest)).toBe(true);
  expect(getLayoutProfileForQuest(questId, tier)).toBe('boss-arena');
  expect(getEncounterConfig(quest)).toMatchObject({
    bossType,
    landmark: 'arena_dais',
  });
}

describe.each(BOSS_LEVEL_QUESTS)('boss-level reuse ($questId)', ({
  questId,
  tier,
  bossType,
  addCount,
  objectiveSummary,
}) => {
  let state;

  beforeEach(() => {
    state = createGameState();
  });

  it('satisfies the boss-level schema contract', () => {
    assertBossLevelSchema(questId, tier, bossType);
    const quest = getQuest(questId, tier);
    expect(quest.encounter.addCount).toBe(addCount);
    expect(formatObjectiveSummary(quest)).toBe(objectiveSummary);
  });

  it(`spawns 1 + addCount (${addCount}) enemies with a dormant encounter`, () => {
    deployBossLevelRun(state, { questId, tier });
    const dais = state.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    const boss = bossEnemy(state);

    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.enemies).toHaveLength(1 + addCount);
    expect(boss.type).toBe(bossType);
    expect(boss.x).toBe(dais.x);
    expect(boss.z).toBe(dais.z);
  });

  it('activates the encounter when adds are cleared and a player enters the trigger radius', () => {
    deployBossLevelRun(state, { questId, tier });
    const bossId = state.run.encounter.bossEnemyId;
    if (addCount > 0) {
      for (const enemy of state.enemies) {
        if (enemy.id !== bossId) enemy.hp = 0;
      }
      state.enemies = state.enemies.filter((e) => e.hp > 0);
    }
    const anchor = state.run.encounter.spawnAnchor;
    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;

    expect(tryActivateEncounter(state)).toBe(true);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(state.run.encounter.locked).toBe(true);
  });

  it('completes with victory when the active boss is defeated', () => {
    deployBossLevelRun(state, { questId, tier });
    activateEncounterForTest(state);
    bossEnemy(state).hp = 0;
    removeDeadEnemies();

    expect(isEncounterCleared(state.run)).toBe(true);
    expect(state.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);

    cleanupAfterDamage();
    checkRunTerminalState();
    expect(state.run.status).toBe('victory');
  });
});

describe('boss-level quest distinctness', () => {
  it('uses different bossType values across live boss-level quests', () => {
    const bossTypes = BOSS_LEVEL_QUESTS.map(({ questId, tier }) => getQuest(questId, tier).encounter.bossType);
    expect(new Set(bossTypes).size).toBe(bossTypes.length);
    expect(bossTypes).toContain('crucible_sovereign');
    expect(bossTypes).toContain('annex_overseer');
  });
});
