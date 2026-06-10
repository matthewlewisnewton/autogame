import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  ENCOUNTER_PHASES,
  ENCOUNTER_TRIGGER_RADIUS,
  tryActivateEncounter,
  isEncounterCleared,
  isEncounterLocked,
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

const require = createRequire(import.meta.url);
const {
  QUEST_DEFS,
  BOSS_LEVEL_FIXTURE_DEF,
  getQuest,
  getLayoutProfileForQuest,
} = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');

const FIXTURE_QUEST_ID = BOSS_LEVEL_FIXTURE_DEF.id;
const SEED = 38502;

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

function deployBossLevelRun(state, { tier = 2, seed = SEED, partySize = 1, playerPosition } = {}) {
  setPartySize(state, partySize, playerPosition ?? { x: -20, z: 0 });
  state.selectedQuestId = FIXTURE_QUEST_ID;
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

beforeAll(() => {
  QUEST_DEFS[FIXTURE_QUEST_ID] = BOSS_LEVEL_FIXTURE_DEF;
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('boss-level deploy spawn pipeline', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
  });

  it('produces stage_boss objective, dormant encounter, and a single wired boss', () => {
    deployBossLevelRun(state, { tier: 2 });
    const quest = getQuest(FIXTURE_QUEST_ID, 2);
    const dais = state.layout.landmarks.find((lm) => lm.type === 'arena_dais');
    const boss = bossEnemy(state);

    expect(quest.levelKind).toBe('boss_level');
    expect(quest.layoutProfile).toBe('boss-arena');
    expect(getLayoutProfileForQuest(FIXTURE_QUEST_ID, 2)).toBe('boss-arena');
    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.run.encounter).toMatchObject({
      phase: ENCOUNTER_PHASES.DORMANT,
      locked: false,
    });
    expect(state.enemies).toHaveLength(1);
    expect(boss.type).toBe('miniboss');
    expect(boss.id).toBe(state.run.encounter.bossEnemyId);
    expect(boss.x).toBe(dais.x);
    expect(boss.z).toBe(dais.z);
  });

  it('spawns exactly 1 + addCount live enemies with no bulk or scripted extras', () => {
    deployBossLevelRun(state, { tier: 1 });
    const addCount = getQuest(FIXTURE_QUEST_ID, 1).encounter.addCount;
    expect(addCount).toBe(2);
    expect(state.enemies).toHaveLength(1 + addCount);
    expect(state.enemies.filter((e) => e.type === 'miniboss')).toHaveLength(1);
  });

  it('ignores scriptedEncounters and quest-script run_start waves on boss-level tiers', () => {
    const tierDef = QUEST_DEFS[FIXTURE_QUEST_ID].tiers[2];
    const savedScript = tierDef.script;
    const savedScripted = tierDef.scriptedEncounters;
    tierDef.script = {
      waves: [
        {
          id: 'wave_run_start',
          trigger: 'run_start',
          spawns: [
            { type: 'grunt', x: 1, z: 1 },
            { type: 'grunt', x: 2, z: 2 },
            { type: 'skirmisher', x: 3, z: 3 },
          ],
        },
      ],
    };
    tierDef.scriptedEncounters = {
      rooms: [
        {
          roomIndex: 0,
          waves: [{ spawns: [{ type: 'grunt', count: 5 }] }],
        },
      ],
    };

    deployBossLevelRun(state, { tier: 2 });

    tierDef.script = savedScript;
    tierDef.scriptedEncounters = savedScripted;

    expect(state.run.scriptedEncounter).toBeUndefined();
    expect(state.enemies).toHaveLength(1);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
  });

  it('activates the encounter when a player enters the trigger radius', () => {
    deployBossLevelRun(state, { tier: 2 });
    const anchor = state.run.encounter.spawnAnchor;
    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;

    expect(tryActivateEncounter(state)).toBe(true);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(isEncounterLocked(state.run)).toBe(true);
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0].id).toBe(state.run.encounter.bossEnemyId);
  });

  it('completes the objective when the active boss is defeated', () => {
    deployBossLevelRun(state, { tier: 2 });
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

describe('non-boss-level stage_boss regression', () => {
  it('arena_trials Tier 2 still spawns adds alongside the dormant boss', () => {
    const state = createGameState();
    const questId = 'arena_trials';
    const tier = 2;
    const layout = generateLayout(SEED, getLayoutProfileForQuest(questId, tier));
    const addCount = getQuest(questId, tier).encounter.addCount;

    setPartySize(state, 1);
    state.selectedQuestId = questId;
    state.selectedQuestTier = tier;
    state.layout = layout;
    state.layoutSeed = SEED;
    state.enemies = [];
    state.loot = [];
    state.gamePhase = 'playing';
    setGameState(state);
    setSimulationGameState(state);
    spawnEnemies();
    startDungeonRun();

    expect(getQuest(questId, tier).levelKind).toBeUndefined();
    expect(state.run.objective.type).toBe('stage_boss');
    expect(state.enemies).toHaveLength(1 + addCount);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
  });
});
