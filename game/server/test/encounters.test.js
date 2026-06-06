import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ENCOUNTER_PHASES,
  createEncounterState,
  setEncounterBoss,
  activateEncounter,
  lockEncounter,
  clearEncounter,
  isEncounterLocked,
  getEncounterBossId,
  isEncounterCleared,
} from '../encounters.js';
import { createGameState } from '../game-state.js';
import {
  createRunState,
  setGameState,
  stateSnapshot,
} from '../progression.js';
const { QUEST_DEFS } = require('../quests.js');

describe('encounters module', () => {
  it('createEncounterState returns dormant encounter with spawn anchor', () => {
    const encounter = createEncounterState({ spawnAnchor: { x: 12, z: -4 } });
    expect(encounter).toEqual({
      phase: 'dormant',
      bossEnemyId: null,
      locked: false,
      spawnAnchor: { x: 12, z: -4 },
    });
  });

  it('createEncounterState defaults spawnAnchor to null', () => {
    expect(createEncounterState().spawnAnchor).toBeNull();
  });

  it('allows dormant → active → cleared transitions', () => {
    const run = { encounter: createEncounterState() };
    setEncounterBoss(run, 'boss-1');
    expect(getEncounterBossId(run)).toBe('boss-1');

    activateEncounter(run);
    expect(run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);

    lockEncounter(run);
    expect(isEncounterLocked(run)).toBe(true);

    clearEncounter(run);
    expect(run.encounter.phase).toBe(ENCOUNTER_PHASES.CLEARED);
    expect(isEncounterCleared(run)).toBe(true);
  });

  it('rejects cleared → active', () => {
    const run = { encounter: createEncounterState() };
    activateEncounter(run);
    clearEncounter(run);
    expect(() => activateEncounter(run)).toThrow(/Invalid encounter phase transition/);
  });

  it('rejects dormant → cleared', () => {
    const run = { encounter: createEncounterState() };
    expect(() => clearEncounter(run)).toThrow(/Invalid encounter phase transition/);
  });

  it('no-ops mutators and returns safe defaults when encounter is missing', () => {
    const run = {};
    expect(() => {
      setEncounterBoss(run, 'boss-1');
      activateEncounter(run);
      lockEncounter(run);
      clearEncounter(run);
    }).not.toThrow();
    expect(isEncounterLocked(run)).toBe(false);
    expect(getEncounterBossId(run)).toBeNull();
    expect(isEncounterCleared(run)).toBe(false);
  });

  it('deep-cloned run preserves encounter fields round-trip', () => {
    const run = {
      id: 'run-enc',
      status: 'playing',
      encounter: createEncounterState({ spawnAnchor: { x: 3, z: 7 } }),
    };
    setEncounterBoss(run, 'miniboss-9');
    activateEncounter(run);
    lockEncounter(run);

    const clone = JSON.parse(JSON.stringify(run));
    expect(clone.encounter).toEqual(run.encounter);
  });
});

describe('createRunState encounter wiring', () => {
  let state;
  const tierDef = QUEST_DEFS.training_caverns.tiers[2];
  let savedEncounter;

  beforeEach(() => {
    state = createGameState();
    state.enemies = [];
    setGameState(state);
    savedEncounter = tierDef.encounter;
  });

  afterEach(() => {
    if (savedEncounter === undefined) {
      delete tierDef.encounter;
    } else {
      tierDef.encounter = savedEncounter;
    }
  });

  it('leaves encounter undefined when quest has no encounter metadata', () => {
    const run = createRunState();
    expect(run.encounter).toBeUndefined();
  });

  it('initializes encounter when quest declares encounter metadata', () => {
    tierDef.encounter = {
      bossType: 'miniboss',
      spawnAnchor: { x: 20, z: -15 },
    };
    state.selectedQuestId = 'training_caverns';
    state.selectedQuestTier = 2;

    const run = createRunState();
    expect(run.encounter).toEqual({
      phase: 'dormant',
      bossEnemyId: null,
      locked: false,
      spawnAnchor: { x: 20, z: -15 },
    });
  });
});

describe('stateSnapshot encounter visibility', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
    state.gamePhase = 'playing';
    state.layoutSeed = 1;
    state.layout = { rooms: [{ x: 0, z: 0, width: 10, depth: 10 }] };
    state.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
    setGameState(state);
  });

  it('includes run.encounter phase and lock in snapshots', () => {
    state.run = createRunState();
    state.run.encounter = createEncounterState({ spawnAnchor: { x: 1, z: 2 } });
    activateEncounter(state.run);
    lockEncounter(state.run);

    const snapshot = stateSnapshot();
    expect(snapshot.run.encounter).toEqual({
      phase: 'active',
      bossEnemyId: null,
      locked: true,
      spawnAnchor: { x: 1, z: 2 },
    });
  });
});

describe('suspended checkpoint encounter preservation', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
    state.gamePhase = 'playing';
    state.layoutSeed = 42;
    state.layout = { rooms: [{ x: 0, z: 0, width: 10, depth: 10 }] };
    state.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
    state.walkableAABBs = [];
    state.players.p1 = {
      id: 'p1',
      x: 0,
      y: 0.5,
      z: 0,
      hp: 100,
      hand: [],
      deck: [],
      pendingSummons: new Set(),
    };
    state.run = {
      id: 'run-1',
      status: 'playing',
      questId: 'training_caverns',
      questTier: 1,
      questName: 'Test',
      objective: { type: 'defeat_enemies', defeatedEnemies: 0, totalEnemies: 1 },
      encounter: createEncounterState({ spawnAnchor: { x: 5, z: 5 } }),
    };
    setEncounterBoss(state.run, 'boss-42');
    activateEncounter(state.run);
    lockEncounter(state.run);
    state.enemies = [];
    state.minions = [];
    state.loot = [];
    state.areaEffects = [];
    setGameState(state);
  });

  it('stateSnapshot includes encounter on active run', () => {
    const snapshot = stateSnapshot();
    expect(snapshot.run.encounter).toEqual(state.run.encounter);
  });
});
