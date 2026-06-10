import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  ENCOUNTER_PHASES,
  ENCOUNTER_TRIGGER_RADIUS,
  canDamageEnemy,
  isDormantEncounterBoss,
  tryActivateEncounter,
  isEncounterCleared,
} from '../encounters.js';
const require = createRequire(import.meta.url);
const {
  setGameState,
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  cleanupAfterDamage,
  checkRunTerminalState,
  isRunObjectiveComplete,
} = require('../progression.js');
const {
  setGameState: setSimulationGameState,
  damageEnemy,
  collectRadialHits,
  applyBurning,
  updateBurning,
  updateEnchantments,
  updateMinions,
} = require('../simulation.js');

const SEED = 38506;
const QUEST_ID = 'vault_onslaught';
const TIER = 1;

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

function deployVaultOnslaught(state, { seed = SEED, partySize = 1 } = {}) {
  setPartySize(state, partySize);
  state.selectedQuestId = QUEST_ID;
  state.selectedQuestTier = TIER;
  state.layout = bossArenaLayout(seed);
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.minions = [];
  state.enchantments = [];
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

describe('canDamageEnemy / isDormantEncounterBoss', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
    deployVaultOnslaught(state);
  });

  it('returns false for the wired encounter boss while dormant', () => {
    const boss = bossEnemy(state);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(isDormantEncounterBoss(state, boss)).toBe(true);
    expect(canDamageEnemy(state, boss)).toBe(false);
  });

  it('returns true for support enemies and the boss after activation', () => {
    const boss = bossEnemy(state);
    const support = state.enemies.find((e) => e.id !== boss.id);
    expect(canDamageEnemy(state, support)).toBe(true);

    activateEncounterForTest(state);
    expect(isDormantEncounterBoss(state, boss)).toBe(false);
    expect(canDamageEnemy(state, boss)).toBe(true);
  });
});

describe('dormant encounter boss damage immunity', () => {
  let state;
  let boss;
  let bossHpStart;

  beforeEach(() => {
    state = createGameState();
    deployVaultOnslaught(state);
    boss = bossEnemy(state);
    bossHpStart = boss.hp;
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
    expect(state.enemies.length).toBeGreaterThan(1);
  });

  it('blocks direct damageEnemy calls', () => {
    const { killed } = damageEnemy(boss, 9999);
    expect(killed).toBe(false);
    expect(boss.hp).toBe(bossHpStart);
  });

  it('blocks radial AoE damage', () => {
    collectRadialHits(boss.x, boss.y, boss.z, 20, 9999);
    expect(boss.hp).toBe(bossHpStart);
  });

  it('blocks burn tick damage', () => {
    vi.useFakeTimers();
    const start = 2_000_000;
    vi.setSystemTime(start);
    try {
      applyBurning(boss, 10_000);
      updateBurning();
      vi.setSystemTime(start + 500);
      updateBurning();
      vi.setSystemTime(start + 1500);
      updateBurning();
      expect(boss.hp).toBe(bossHpStart);
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks spike trap damage', () => {
    state.enchantments = [{
      id: 'trap-1',
      effect: 'spike_trap',
      x: boss.x,
      y: boss.y ?? 0.5,
      z: boss.z,
      radius: 3,
      damage: 50,
      armed: true,
      expiresAt: Date.now() + 60_000,
      ownerId: 'p1',
    }];
    updateEnchantments();
    expect(boss.hp).toBe(bossHpStart);
  });

  it('blocks minion melee damage', () => {
    state.minions.push({
      id: 'm1',
      ownerId: 'p1',
      type: 'test_minion',
      x: boss.x,
      z: boss.z,
      hp: 50,
      ttl: 30,
    });
    updateMinions();
    expect(boss.hp).toBe(bossHpStart);
  });

  it('leaves boss HP unchanged after combined combat while supports remain', () => {
    damageEnemy(boss, 500);
    collectRadialHits(boss.x, boss.y, boss.z, 30, 500);
    applyBurning(boss, 5000);
    vi.useFakeTimers();
    const start = 3_000_000;
    vi.setSystemTime(start);
    try {
      updateBurning();
      vi.setSystemTime(start + 2000);
      updateBurning();
    } finally {
      vi.useRealTimers();
    }
    state.minions.push({
      id: 'm1',
      ownerId: 'p1',
      x: boss.x,
      z: boss.z,
      hp: 50,
      ttl: 30,
    });
    updateMinions();
    expect(boss.hp).toBe(bossHpStart);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
  });
});

describe('active encounter boss damage', () => {
  let state;
  let boss;

  beforeEach(() => {
    state = createGameState();
    deployVaultOnslaught(state);
    boss = bossEnemy(state);
    activateEncounterForTest(state);
    expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
  });

  it('applies damage and defeat after activation', () => {
    const hpBefore = boss.hp;
    const { killed } = damageEnemy(boss, hpBefore);
    expect(killed).toBe(true);
    expect(boss.hp).toBe(0);
  });

  it('completes stage_boss objective when the active boss is defeated', () => {
    boss.hp = 0;
    removeDeadEnemies();

    expect(isEncounterCleared(state.run)).toBe(true);
    expect(state.run.objective.bossDefeated).toBe(true);
    expect(isRunObjectiveComplete(state.run.objective)).toBe(true);

    cleanupAfterDamage();
    checkRunTerminalState();
    expect(state.run.status).toBe('victory');
  });
});
