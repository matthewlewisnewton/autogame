import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  ENCOUNTER_PHASES,
  ENCOUNTER_TRIGGER_RADIUS,
  createEncounterState,
  tryActivateEncounter,
  isEncounterLocked,
} from '../encounters.js';
import {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  updateSurviveSpawns,
  updateEncounterTriggers,
  spawnEnemy,
} from '../progression.js';

const require = createRequire(import.meta.url);
const { QUEST_DEFS } = require('../quests.js');
const {
  updateEnemies,
  ENEMY_DEFS,
  setGameState: setSimulationGameState,
  collectRadialHits,
  applyBurning,
  updateBurning,
} = require('../simulation.js');

const SEED = 5151;
const FIXTURE_QUEST_ID = 'stage_boss_trigger_fixture';

function openPlazaLayout(seed = SEED) {
  return generateLayout(seed, 'open-plaza');
}

function setPartySize(state, count, position = { x: 0, z: 0 }) {
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
    };
  }
}

function deployStageBossRun(state, { seed = SEED, partySize = 1, playerPosition } = {}) {
  setPartySize(state, partySize, playerPosition ?? { x: -40, z: 0 });
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
  return state;
}

function bossEnemy(state) {
  return state.enemies.find((e) => e.id === state.run.encounter.bossEnemyId);
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
        name: 'Stage Boss Trigger Fixture',
        description: 'Fixture for encounter trigger tests',
        objectiveType: 'stage_boss',
        rewardCurrency: 1,
        layoutProfile: 'open-plaza',
        encounter: {
          bossType: 'miniboss',
          landmark: 'arena_dais',
          addCount: 2,
        },
      },
    },
  };
});

afterAll(() => {
  delete QUEST_DEFS[FIXTURE_QUEST_ID];
});

describe('tryActivateEncounter', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
    deployStageBossRun(state);
  });

  it('does nothing while adds remain and the player is outside the trigger radius', () => {
    expect(tryActivateEncounter(state)).toBe(false);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.enemies.length).toBeGreaterThan(1);
  });

  it('activates and locks when every non-boss enemy is defeated and the player enters the trigger radius', () => {
    const bossId = state.run.encounter.bossEnemyId;
    for (const enemy of state.enemies) {
      if (enemy.id !== bossId) enemy.hp = 0;
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0);

    const anchor = state.run.encounter.spawnAnchor;
    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;

    expect(tryActivateEncounter(state)).toBe(true);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(isEncounterLocked(state.run)).toBe(true);
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0].id).toBe(bossId);
  });

  it('stays dormant when adds are cleared but the player is outside the trigger radius', () => {
    const bossId = state.run.encounter.bossEnemyId;
    for (const enemy of state.enemies) {
      if (enemy.id !== bossId) enemy.hp = 0;
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0);
    state.players.p1.x = -40;
    state.players.p1.z = 0;

    expect(tryActivateEncounter(state)).toBe(false);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
  });

  it('activates and locks when a non-extracted player enters the trigger radius after adds are cleared', () => {
    const bossId = state.run.encounter.bossEnemyId;
    for (const enemy of state.enemies) {
      if (enemy.id !== bossId) enemy.hp = 0;
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0);

    const anchor = state.run.encounter.spawnAnchor;
    expect(anchor).toBeTruthy();

    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;

    expect(tryActivateEncounter(state)).toBe(true);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(isEncounterLocked(state.run)).toBe(true);
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0].id).toBe(state.run.encounter.bossEnemyId);
  });

  it('ignores extracted players for proximity activation', () => {
    const anchor = state.run.encounter.spawnAnchor;
    state.players.p1.extracted = true;
    state.players.p1.x = anchor.x;
    state.players.p1.z = anchor.z;

    expect(tryActivateEncounter(state)).toBe(false);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
  });
});

describe('dormant boss AI and spawner suppression', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
    deployStageBossRun(state);
  });

  it('keeps the dormant stage boss idle while adds behave normally', () => {
    const boss = bossEnemy(state);
    const add = state.enemies.find((e) => e.id !== boss.id);
    const bossStartX = boss.x;

    state.players.p1.x = add.x + 1;
    state.players.p1.z = add.z;

    updateEnemies();

    expect(boss.x).toBeCloseTo(bossStartX, 5);
    expect(boss.state).toBe('idle');
    expect(add.state).not.toBe('idle');
  });

  it('lets the active boss chase after encounter activation', () => {
    const boss = bossEnemy(state);
    const bossId = state.run.encounter.bossEnemyId;
    for (const enemy of state.enemies) {
      if (enemy.id !== bossId) enemy.hp = 0;
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0);
    const anchor = state.run.encounter.spawnAnchor;
    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;
    tryActivateEncounter(state);

    const startX = boss.x;
    state.players.p1.x = boss.x + 6;
    state.players.p1.z = boss.z;

    updateEnemies();

    expect(boss.state).toBe('chasing');
    expect(boss.x).toBeGreaterThan(startX);
  });

  it('suppresses spawner output while the encounter is locked', () => {
    const bossId = state.run.encounter.bossEnemyId;
    state.enemies = state.enemies.filter((e) => e.id === bossId);
    const spawner = spawnEnemy(4, 0, 'spawner');
    spawner.lastSpawnTime = Date.now() - ENEMY_DEFS.spawner.spawnIntervalMs - 500;

    state.run.encounter.phase = ENCOUNTER_PHASES.ACTIVE;
    state.run.encounter.locked = true;

    updateEnemies();

    expect(state.enemies.some((e) => e.spawnedBy === spawner.id)).toBe(false);
  });

  it('updateSurviveSpawns no-ops while locked', () => {
    state.selectedQuestId = 'endless_siege';
    state.selectedQuestTier = 1;
    state.run.objective = {
      type: 'survive',
      totalSpawns: 5,
      minibossCount: 0,
      spawnedEnemies: 0,
      defeatedEnemies: 0,
      totalEnemies: 5,
      enemyPool: [{ type: 'grunt', weight: 1 }],
      lastSpawnAt: 0,
    };
    state.run.encounter.phase = ENCOUNTER_PHASES.ACTIVE;
    state.run.encounter.locked = true;

    const before = state.enemies.length;
    updateSurviveSpawns(Date.now() + 60_000);
    expect(state.enemies.length).toBe(before);
  });

  it('updateEncounterTriggers activates on the game-loop hook', () => {
    const bossId = state.run.encounter.bossEnemyId;
    for (const enemy of state.enemies) {
      if (enemy.id !== bossId) enemy.hp = 0;
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0);

    const anchor = state.run.encounter.spawnAnchor;
    state.players.p1.x = anchor.x + ENCOUNTER_TRIGGER_RADIUS - 1;
    state.players.p1.z = anchor.z;

    updateEncounterTriggers();

    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
    expect(isEncounterLocked(state.run)).toBe(true);
  });

  it('AoE and burn cannot kill the dormant boss while adds remain', () => {
    const boss = bossEnemy(state);
    const hpStart = boss.hp;
    expect(state.enemies.length).toBeGreaterThan(1);

    collectRadialHits(boss.x, boss.y, boss.z, 25, 9999);
    expect(boss.hp).toBe(hpStart);

    applyBurning(boss, 10_000);
    const now = Date.now();
    boss.lastBurnTickAt = now - 500;
    updateBurning();
    boss.lastBurnTickAt = now;
    updateBurning();
    expect(boss.hp).toBe(hpStart);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
  });
});
