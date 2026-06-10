import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import {
  setGameState,
  spawnEnemy,
  startDungeonRun,
  cleanupAfterDamage,
  stateSnapshot,
  createRunState,
} from '../progression.js';
const require = createRequire(import.meta.url);
const { ENEMY_DEFS, setGameState: setSimulationGameState } = require('../simulation.js');
const {
  QUEST_DEFS,
  getQuestScript,
} = require('../quests.js');
const { normalizeNamedRareVariant } = require('../namedRareVariants.js');

const FIXTURE_QUEST_ID = 'named_rare_variant_fixture';
const NAMED_RARE_VARIANT = {
  name: 'Test Yellow Fake',
  hpMult: 2,
  damageMult: 1.5,
  tint: '#ffdd00',
  scaleMult: 1.2,
  drop: { cardId: 'flame_blade' },
};

const FIXTURE_SPAWN = {
  type: 'grunt',
  x: 1,
  z: 2,
  variant: NAMED_RARE_VARIANT,
};

function resetState() {
  const state = createGameState();
  state.selectedQuestId = FIXTURE_QUEST_ID;
  state.selectedQuestTier = 1;
  state.layout = generateLayout(9090, 'crowded');
  state.layoutSeed = 9090;
  state.enemies = [];
  state.loot = [];
  state.gamePhase = 'playing';
  state.players = {
    p1: {
      x: 0,
      y: 0.5,
      z: 0,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
      runCardDropIds: [],
      pendingSummons: new Set(),
    },
  };
  setGameState(state);
  setSimulationGameState(state);
  return state;
}

function spawnFixtureNamedRare(overrides = {}) {
  return spawnEnemy(1, 2, 'grunt', undefined, {
    tier: 1,
    rng: () => 0,
    namedRareVariant: { ...NAMED_RARE_VARIANT, ...overrides },
  });
}

beforeAll(() => {
  QUEST_DEFS[FIXTURE_QUEST_ID] = {
    id: FIXTURE_QUEST_ID,
    enemyPool: [{ type: 'grunt', weight: 1 }],
    tiers: {
      1: {
        name: 'Named Rare Fixture',
        description: 'Fixture quest for named-rare plumbing',
        objectiveType: 'defeat_enemies',
        enemyCount: 1,
        rewardCurrency: 1,
        layoutProfile: 'crowded',
        script: {
          waves: [
            {
              id: 'wave_named_rare',
              trigger: 'run_start',
              spawns: [FIXTURE_SPAWN],
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

describe('normalizeQuestScriptSpawn / normalizeNamedRareVariant', () => {
  it('preserves a valid inline variant on scripted spawns', () => {
    const script = getQuestScript({
      script: {
        waves: [{ id: 'wave_named_rare', trigger: 'run_start', spawns: [FIXTURE_SPAWN] }],
      },
    });
    expect(script.waves[0].spawns[0]).toMatchObject({
      type: 'grunt',
      x: 1,
      z: 2,
      variant: {
        name: 'Test Yellow Fake',
        hpMult: 2,
        damageMult: 1.5,
        tint: '#ffdd00',
        scaleMult: 1.2,
        drop: { cardId: 'flame_blade' },
      },
    });
  });

  it('drops invalid variant configs', () => {
    expect(normalizeNamedRareVariant(null)).toBeNull();
    expect(normalizeNamedRareVariant({ name: '', drop: { cardId: 'iron_sword' } })).toBeNull();
    expect(normalizeNamedRareVariant({ name: 'No Drop' })).toBeNull();
    expect(normalizeNamedRareVariant({ name: 'Bad Drop', drop: { currency: 0 } })).toBeNull();
  });
});

describe('spawnEnemy named-rare plumbing', () => {
  beforeEach(() => {
    resetState();
    createRunState();
  });

  it('scales grunt combat stats and exposes namedRare while skipping affix rolls', () => {
    const state = resetState();
    state.run = { questTier: 2, namedRareDropsClaimed: [] };
    setGameState(state);

    const enemy = spawnFixtureNamedRare();
    const base = ENEMY_DEFS.grunt;

    expect(enemy.variant).toBeNull();
    expect(enemy.hp).toBe(Math.round(base.hp * 2));
    expect(enemy.maxHp).toBe(Math.round(base.hp * 2));
    expect(enemy.attackDamage).toBe(Math.round(base.attackDamage * 1.5));
    expect(enemy.chaseSpeed).toBe(base.chaseSpeed);
    expect(enemy.namedRare).toEqual({
      id: 'test-yellow-fake',
      name: 'Test Yellow Fake',
      tint: '#ffdd00',
      scaleMult: 1.2,
      drop: { cardId: 'flame_blade' },
    });

    const snapEnemy = stateSnapshot().enemies.find((entry) => entry.id === enemy.id);
    expect(snapEnemy.namedRare).toEqual(enemy.namedRare);
    expect(snapEnemy.variant).toBeNull();
  });

  it('still rolls affix variants when no inline named-rare config is provided', () => {
    const state = resetState();
    state.run = { questTier: 2, namedRareDropsClaimed: [] };
    setGameState(state);

    const enemy = spawnEnemy(0, 0, 'grunt', undefined, { tier: 1, rng: () => 0 });
    expect(enemy.variant).not.toBeNull();
    expect(enemy.namedRare).toBeUndefined();
  });

  it('grants the unique card drop once per run and not on subsequent kills', () => {
    const state = resetState();
    state.run = createRunState();
    setGameState(state);

    const first = spawnFixtureNamedRare();
    first.lastDamagedBy = 'p1';
    first.hp = 0;
    cleanupAfterDamage();

    expect(state.run.namedRareDropsClaimed).toEqual(['test-yellow-fake']);
    expect(state.players.p1.runCardDropIds).toContain('flame_blade');

    const dropsAfterFirst = state.players.p1.runCardDropIds.filter((id) => id === 'flame_blade').length;

    const second = spawnFixtureNamedRare();
    second.lastDamagedBy = 'p1';
    second.hp = 0;
    cleanupAfterDamage();

    const dropsAfterSecond = state.players.p1.runCardDropIds.filter((id) => id === 'flame_blade').length;
    expect(dropsAfterSecond).toBe(dropsAfterFirst);
    expect(state.run.namedRareDropsClaimed).toEqual(['test-yellow-fake']);
  });
});

describe('quest script wave spawn wiring', () => {
  it('spawns scripted named rares through spawnWaveEntries at run start', () => {
    const state = resetState();
    startDungeonRun();

    expect(state.run.waveScript.waves).toHaveLength(1);
    expect(state.enemies).toHaveLength(1);

    const enemy = state.enemies[0];
    expect(enemy.type).toBe('grunt');
    expect(enemy.variant).toBeNull();
    expect(enemy.namedRare?.id).toBe('test-yellow-fake');
    expect(enemy.hp).toBe(Math.round(ENEMY_DEFS.grunt.hp * 2));
  });
});
