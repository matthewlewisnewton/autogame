import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  ENCOUNTER_PHASES,
  tryActivateEncounter,
  isEncounterCleared,
} from '../encounters.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  isRunObjectiveComplete,
} from '../progression.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS, formatObjectiveSummary } = require('../quests.js');
const { setGameState: setSimulationGameState } = require('../simulation.js');

const SEED = 4242;
const ADD_COUNT = 4;

function fireCavernRigidLayout(seed = SEED) {
  return generateLayout(seed, 'fire-cavern', { layoutMode: 'rigid' });
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
      accountId: `acct-${i}`,
    };
  }
}

function deployEmberStageBossRun(state, { seed = SEED } = {}) {
  setPartySize(state, 1);
  state.selectedQuestId = 'ember_descent';
  state.selectedQuestTier = 2;
  state.layout = fireCavernRigidLayout(seed);
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
  const boss = state.enemies.find((e) => e.id === bossId);
  for (const enemy of state.enemies) {
    if (enemy.id !== bossId) enemy.hp = 0;
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  // Move a player onto the boss so it sits inside the trigger radius.
  const player = Object.values(state.players)[0];
  player.x = boss.x;
  player.z = boss.z;
  tryActivateEncounter(state);
}

describe('ember_descent Tier II stage_boss config', () => {
  const tier2 = QUEST_DEFS.ember_descent.tiers[2];

  it('defines a fire-cavern rigid stage_boss encounter for the magma colossus', () => {
    expect(tier2).toBeDefined();
    expect(tier2.objectiveType).toBe('stage_boss');
    expect(tier2.layoutProfile).toBe('fire-cavern');
    expect(tier2.layoutMode).toBe('rigid');
    expect(tier2.unlockRequires).toEqual({ questId: 'ember_descent', tier: 1 });
    expect(tier2.encounter.bossType).toBe('magma_colossus');
    expect(tier2.encounter.addCount).toBe(ADD_COUNT);
  });

  it('has fire-themed briefing and run_start / objective_complete dialogue triggers', () => {
    expect(tier2.client.briefing.length).toBeGreaterThan(0);
    expect(tier2.client.briefing.toLowerCase()).toContain('magma colossus');
    const triggers = tier2.dialogue.map((d) => d.trigger);
    expect(triggers).toContain('run_start');
    expect(triggers).toContain('objective_complete');
    const runStart = tier2.dialogue.find((d) => d.trigger === 'run_start');
    expect(runStart.text.toLowerCase()).toContain('magma colossus');
  });

  it('resolves the magma colossus objective label with the support count', () => {
    const label = formatObjectiveSummary({
      ...tier2,
      questId: 'ember_descent',
      id: 'ember_descent',
    });
    expect(label).toBe(`Defeat the magma colossus and ${ADD_COUNT} supports`);
  });
});

describe('ember_descent Tier II stage_boss spawn + defeat', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
    deployEmberStageBossRun(state);
  });

  it('spawns exactly one magma_colossus boss plus addCount adds and no bulk pack', () => {
    const bosses = state.enemies.filter((e) => e.type === 'magma_colossus');
    const adds = state.enemies.filter((e) => e.type !== 'magma_colossus');

    expect(bosses).toHaveLength(1);
    expect(adds).toHaveLength(ADD_COUNT);
    expect(state.enemies).toHaveLength(1 + ADD_COUNT);
  });

  it('wires bossEnemyId and starts the encounter dormant on run open', () => {
    const boss = bossEnemy(state);
    expect(boss.type).toBe('magma_colossus');
    expect(state.run.encounter.bossEnemyId).toBe(boss.id);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state._pendingEncounterBossId).toBeUndefined();
  });

  it('defeating the active boss clears the encounter and completes the objective', () => {
    activateEncounterForTest(state);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);

    bossEnemy(state).hp = 0;
    removeDeadEnemies();

    expect(isEncounterCleared(state.run)).toBe(true);
    expect(state.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);
  });
});
