import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VARIANT_DEFS,
  LEECH_FRACTION,
  applyLeechHeal,
} from '../enemyVariants.js';
import { damagePlayer, setGameState } from '../simulation.js';
import { MAX_HP } from '../config.js';

describe('leeching variant registry', () => {
  it('defines leeching with leechFraction and bonusDrop', () => {
    expect(VARIANT_DEFS.leeching).toBeDefined();
    expect(VARIANT_DEFS.leeching.id).toBe('leeching');
    expect(typeof VARIANT_DEFS.leeching.name).toBe('string');
    expect(VARIANT_DEFS.leeching.apply).toBeNull();
    expect(VARIANT_DEFS.leeching.leechFraction).toBe(LEECH_FRACTION);
    expect(VARIANT_DEFS.leeching.bonusDrop).toEqual({ card: true, magicStone: 15 });
    expect(LEECH_FRACTION).toBe(0.25);
  });
});

describe('applyLeechHeal', () => {
  it('heals floor(leechFraction * damageDealt) for a living leeching attacker', () => {
    const enemies = [
      { id: 'e1', variant: 'leeching', hp: 40, maxHp: 100 },
    ];
    const healed = applyLeechHeal('e1', 40, enemies);
    expect(healed).toBe(Math.floor(LEECH_FRACTION * 40));
    expect(enemies[0].hp).toBe(40 + Math.floor(LEECH_FRACTION * 40));
  });

  it('caps heal at maxHp', () => {
    const enemies = [
      { id: 'e1', variant: 'leeching', hp: 98, maxHp: 100 },
    ];
    applyLeechHeal('e1', 40, enemies);
    expect(enemies[0].hp).toBe(100);
  });

  it('does nothing for non-leeching or missing attackers', () => {
    const plain = [{ id: 'e1', variant: null, hp: 50, maxHp: 100 }];
    expect(applyLeechHeal('e1', 40, plain)).toBe(0);
    expect(plain[0].hp).toBe(50);

    const testVariant = [{ id: 'e2', variant: 'test', hp: 50, maxHp: 100 }];
    expect(applyLeechHeal('e2', 40, testVariant)).toBe(0);
    expect(testVariant[0].hp).toBe(50);

    const dead = [{ id: 'e3', variant: 'leeching', hp: 0, maxHp: 100 }];
    expect(applyLeechHeal('e3', 40, dead)).toBe(0);
    expect(applyLeechHeal('missing', 40, dead)).toBe(0);
  });
});

describe('damagePlayer — leeching heal on player damage', () => {
  function makePlayer(id, overrides = {}) {
    return {
      id,
      x: 0,
      y: 0.5,
      z: 0,
      rotation: 0,
      hp: MAX_HP,
      dead: false,
      invulnerableUntil: 0,
      ...overrides,
    };
  }

  function setupState({ players = {}, enemies = [] } = {}) {
    const state = { players, enemies, minions: [] };
    setGameState(state, {});
    return state;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('heals the leeching attacker by floor(fraction * damage applied to HP)', () => {
    const enemy = {
      id: 'leech',
      variant: 'leeching',
      x: 3,
      z: 0,
      hp: 30,
      maxHp: 100,
      type: 'grunt',
    };
    const state = setupState({
      players: { p1: makePlayer('p1') },
      enemies: [enemy],
    });

    damagePlayer('p1', 40, { attackerEnemyId: 'leech' });

    const damageDealt = 40;
    expect(state.players.p1.hp).toBe(MAX_HP - damageDealt);
    expect(enemy.hp).toBe(30 + Math.floor(LEECH_FRACTION * damageDealt));
  });

  it('does not exceed attacker maxHp', () => {
    const enemy = {
      id: 'leech',
      variant: 'leeching',
      hp: 96,
      maxHp: 100,
      type: 'grunt',
    };
    setupState({
      players: { p1: makePlayer('p1') },
      enemies: [enemy],
    });

    damagePlayer('p1', 40, { attackerEnemyId: 'leech' });

    expect(enemy.hp).toBe(100);
  });

  it('does not heal when attacker is not leeching', () => {
    const enemy = { id: 'plain', variant: null, hp: 50, maxHp: 100, type: 'grunt' };
    setupState({
      players: { p1: makePlayer('p1') },
      enemies: [enemy],
    });

    damagePlayer('p1', 40, { attackerEnemyId: 'plain' });

    expect(enemy.hp).toBe(50);
  });

  it('does not heal when damage is fully prevented (invulnerability)', () => {
    const enemy = {
      id: 'leech',
      variant: 'leeching',
      hp: 50,
      maxHp: 100,
      type: 'grunt',
    };
    setupState({
      players: { p1: makePlayer('p1', { invulnerableUntil: Date.now() + 5000 }) },
      enemies: [enemy],
    });

    const result = damagePlayer('p1', 40, { attackerEnemyId: 'leech' });

    expect(result).toBeNull();
    expect(enemy.hp).toBe(50);
  });

  it('does not heal when one-hit shield absorbs the hit', () => {
    const enemy = {
      id: 'leech',
      variant: 'leeching',
      hp: 50,
      maxHp: 100,
      type: 'grunt',
    };
    setupState({
      players: { p1: makePlayer('p1', { shieldHitsRemaining: 1 }) },
      enemies: [enemy],
    });

    const result = damagePlayer('p1', 40, { attackerEnemyId: 'leech' });

    expect(result).toBeNull();
    expect(enemy.hp).toBe(50);
  });

  it('heals based on mitigated damage (block reduction), not raw amount', () => {
    const now = Date.now();
    const enemy = {
      id: 'leech',
      variant: 'leeching',
      x: 3,
      z: 0,
      hp: 20,
      maxHp: 100,
      type: 'grunt',
    };
    setupState({
      players: {
        p1: makePlayer('p1', {
          blockingUntil: now + 1000,
          blockingYaw: 0,
        }),
      },
      enemies: [enemy],
    });

    damagePlayer('p1', 100, { attackerEnemyId: 'leech' });

    const damageDealt = 30; // 70% block reduction on frontal hit
    expect(enemy.hp).toBe(20 + Math.floor(LEECH_FRACTION * damageDealt));
  });

  it('does not heal when ranged damage is blocked by barrier dome', () => {
    const future = Date.now() + 5000;
    const enemy = {
      id: 'leech',
      variant: 'leeching',
      x: 10,
      z: 0,
      hp: 50,
      maxHp: 100,
      type: 'grunt',
    };
    setupState({
      players: {
        p1: makePlayer('p1', {
          barrierDomeUntil: future,
          barrierDomeRadius: 3,
          barrierDomeX: 0,
          barrierDomeZ: 0,
        }),
      },
      enemies: [enemy],
    });

    const result = damagePlayer('p1', 30, { ranged: true, attackerEnemyId: 'leech' });

    expect(result).toBeNull();
    expect(enemy.hp).toBe(50);
  });

  it('does not heal without attackerEnemyId', () => {
    const enemy = {
      id: 'leech',
      variant: 'leeching',
      hp: 50,
      maxHp: 100,
      type: 'grunt',
    };
    setupState({
      players: { p1: makePlayer('p1') },
      enemies: [enemy],
    });

    damagePlayer('p1', 40);

    expect(enemy.hp).toBe(50);
  });
});
