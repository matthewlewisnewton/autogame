import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { generateLayout } from '../dungeon.js';
import {
  spawnEnemy,
  spawnEnemies,
  startDungeonRun,
  removeDeadEnemies,
  gameState,
  resetGameState,
  setGameState,
} from '../index.js';
import { setGameState as setSimulationGameState } from '../simulation.js';
import { applyForcedVariant } from '../enemyVariants.js';

const require = createRequire(import.meta.url);
const {
  QUEST_DEFS,
  getLayoutProfileForQuest,
} = require('../quests.js');

const NAMED_RARE_FIXTURE_ID = 'named_rare_fixture';

const NAMED_RARE_FIXTURE_DEF = {
  id: NAMED_RARE_FIXTURE_ID,
  enemyPool: [{ type: 'grunt', weight: 1 }],
  tiers: {
    1: {
      name: 'Named Rare Fixture',
      description: 'Test-only named rare spawn wiring.',
      objectiveType: 'defeat_enemies',
      enemyCount: 2,
      rewardCurrency: 1,
      layoutProfile: 'crowded',
      scriptedEncounters: {
        rooms: [
          {
            roomIndex: 0,
            waves: [
              {
                spawns: [
                  { type: 'grunt', count: 1 },
                  {
                    type: 'grunt',
                    count: 1,
                    namedRare: {
                      id: 'fixture_vault_stalker',
                      displayName: 'Vault Stalker',
                      variantId: 'volatile',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
};

function resetState() {
  resetGameState();
  setSimulationGameState(gameState);
}

function deployNamedRareFixture(seed = 5150) {
  gameState.selectedQuestId = NAMED_RARE_FIXTURE_ID;
  gameState.selectedQuestTier = 1;
  gameState.layout = generateLayout(seed, getLayoutProfileForQuest(NAMED_RARE_FIXTURE_ID, 1));
  gameState.layoutSeed = seed;
  gameState.enemies = [];
  gameState.loot = [];
  gameState.gamePhase = 'playing';
  gameState.players = {
    p1: {
      id: 'p1',
      x: gameState.layout.rooms[0].x,
      y: 0.5,
      z: gameState.layout.rooms[0].z,
      rotation: 0,
      hp: 100,
      dead: false,
      extracted: false,
      ready: true,
      connected: true,
      hand: [{
        id: 'iron_sword',
        charges: 10,
        remainingCharges: 4,
      }],
    },
  };
  setGameState(gameState);
  setSimulationGameState(gameState);
  spawnEnemies();
  startDungeonRun();
  return gameState;
}

beforeEach(() => {
  QUEST_DEFS[NAMED_RARE_FIXTURE_ID] = NAMED_RARE_FIXTURE_DEF;
  resetState();
});

afterAll(() => {
  delete QUEST_DEFS[NAMED_RARE_FIXTURE_ID];
});

describe('applyForcedVariant()', () => {
  it('tags warded and applies shield stats', () => {
    const enemy = { type: 'grunt', hp: 100, maxHp: 100 };
    applyForcedVariant(enemy, 'warded');
    expect(enemy.variant).toBe('warded');
    expect(enemy.shieldHp).toBeGreaterThan(0);
    expect(enemy.maxShieldHp).toBe(enemy.shieldHp);
  });

  it('leaves variant null for unknown ids', () => {
    const enemy = { type: 'grunt', hp: 100, maxHp: 100 };
    applyForcedVariant(enemy, 'not_a_variant');
    expect(enemy.variant).toBeNull();
  });
});

describe('spawnEnemy() named-rare opts', () => {
  beforeEach(() => resetState());

  it('honors displayName, namedRareId, forceVariant, and skipVariantRoll', () => {
    const enemy = spawnEnemy(0, 0, 'grunt', undefined, {
      displayName: 'Vault Stalker',
      namedRareId: 'vault_stalker',
      forceVariant: 'warded',
      skipVariantRoll: true,
      tier: 1,
      rng: () => 0,
    });

    expect(enemy.displayName).toBe('Vault Stalker');
    expect(enemy.namedRareId).toBe('vault_stalker');
    expect(enemy.variant).toBe('warded');
    expect(enemy.shieldHp).toBeGreaterThan(0);
    expect(enemy).not.toHaveProperty('name');
  });

  it('allows enemyType override without changing spawn type arg semantics', () => {
    const enemy = spawnEnemy(0, 0, 'grunt', undefined, {
      enemyType: 'skirmisher',
      displayName: 'Fast Stalker',
      skipVariantRoll: true,
    });
    expect(enemy.type).toBe('skirmisher');
    expect(enemy.displayName).toBe('Fast Stalker');
    expect(enemy.chaseSpeed).toBeGreaterThan(2.5);
  });

  it('still rolls variants when skipVariantRoll is not set', () => {
    gameState.run = { questTier: 2 };
    const enemy = spawnEnemy(0, 0, 'grunt', undefined, {
      tier: 1,
      rng: () => 0,
    });
    expect(enemy.variant).toBe('test');
  });
});

describe('scripted wave namedRare spawns', () => {
  it('spawns named rare with displayName and forced variant', () => {
    deployNamedRareFixture();
    const named = gameState.enemies.find((enemy) => enemy.displayName === 'Vault Stalker');
    const plain = gameState.enemies.find((enemy) => !enemy.displayName);
    expect(named).toBeDefined();
    expect(named.namedRareId).toBe('fixture_vault_stalker');
    expect(named.variant).toBe('volatile');
    expect(plain).toBeDefined();
    expect(plain.variant).toBeNull();
  });

  it('counts named rare kills toward scripted defeat objectives', () => {
    deployNamedRareFixture();
    for (const enemy of [...gameState.enemies]) {
      enemy.hp = 0;
    }
    removeDeadEnemies();
    expect(gameState.run.objective.defeatedEnemies).toBe(2);
    expect(gameState.run.scriptedEncounter.rooms['room:0'].cleared).toBe(true);
  });
});
