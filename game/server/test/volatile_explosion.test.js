import { describe, it, expect, beforeEach } from 'vitest';
import {
  gameState,
  removeDeadEnemies,
  updateAreaEffects,
} from '../index.js';
import { VARIANT_DEFS } from '../enemyVariants.js';

function resetState() {
  gameState.players = {};
  gameState.enemies = [];
  gameState.minions = [];
  gameState.loot = [];
  gameState.areaEffects = [];
  gameState.enchantments = [];
  gameState.lobby = [];
  gameState.gamePhase = 'playing';
  gameState._pendingVolatileExplosions = [];
  // No run objective so recordEnemyDefeated is a no-op in this harness.
  gameState.run = null;
}

const VOLATILE = VARIANT_DEFS.volatile;

describe('volatile enemy on-death explosion', () => {
  beforeEach(resetState);

  it('registers a volatile variant with blast tuning', () => {
    expect(VOLATILE).toBeDefined();
    expect(VOLATILE.id).toBe('volatile');
    expect(typeof VOLATILE.name).toBe('string');
    expect(VOLATILE.radius).toBeGreaterThan(0);
    expect(VOLATILE.damage).toBeGreaterThan(0);
  });

  it('damages a nearby player but spares one beyond the radius', () => {
    gameState.players.near = { x: 1, z: 0, hp: 100, dead: false };
    gameState.players.far = { x: 0, z: VOLATILE.radius + 10, hp: 100, dead: false };
    gameState.enemies.push({
      id: 'e1',
      type: 'grunt',
      x: 0,
      z: 0,
      hp: 0,
      variant: 'volatile',
    });

    // Death removes the enemy and queues/spawns the detonation.
    const removed = removeDeadEnemies();
    expect(removed).toBe(1);
    expect(gameState.enemies).toHaveLength(0);
    expect(gameState.areaEffects.some((e) => e.type === 'volatile_explosion')).toBe(true);

    // The area-effect tick resolves the blast damage.
    updateAreaEffects();

    expect(gameState.players.near.hp).toBe(100 - VOLATILE.damage);
    expect(gameState.players.far.hp).toBe(100);
    // One-shot: the effect is consumed after a single tick.
    expect(gameState.areaEffects.some((e) => e.type === 'volatile_explosion')).toBe(false);
  });

  it('damages nearby minions and living enemies within the radius', () => {
    gameState.minions.push({ id: 'm1', x: 2, z: 0, hp: 50, maxHp: 50, ttl: 10, maxTtl: 10 });
    gameState.enemies.push({ id: 'bystander', type: 'grunt', x: 1, z: 1, hp: 40 });
    gameState.enemies.push({ id: 'dead', type: 'grunt', x: 0, z: 0, hp: 0, variant: 'volatile' });

    removeDeadEnemies();
    updateAreaEffects();

    expect(gameState.minions[0].hp).toBe(50 - VOLATILE.damage);
    const bystander = gameState.enemies.find((e) => e.id === 'bystander');
    expect(bystander.hp).toBe(40 - VOLATILE.damage);
  });

  it('records the detonation on the per-lobby pending queue', () => {
    gameState.enemies.push({ id: 'e1', type: 'grunt', x: 3, z: -4, hp: 0, variant: 'volatile' });

    removeDeadEnemies();

    expect(gameState._pendingVolatileExplosions).toHaveLength(1);
    const record = gameState._pendingVolatileExplosions[0];
    expect(record).toMatchObject({ x: 3, z: -4, radius: VOLATILE.radius });
  });

  it('does not explode or queue anything for a non-volatile enemy death', () => {
    gameState.players.p1 = { x: 0, z: 0, hp: 100, dead: false };
    gameState.enemies.push({ id: 'e1', type: 'grunt', x: 0, z: 0, hp: 0, variant: null });

    removeDeadEnemies();
    updateAreaEffects();

    expect(gameState.players.p1.hp).toBe(100);
    expect(gameState._pendingVolatileExplosions).toHaveLength(0);
    expect(gameState.areaEffects.some((e) => e.type === 'volatile_explosion')).toBe(false);
  });
});
