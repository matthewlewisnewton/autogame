import { describe, it, expect } from 'vitest';
import { CARD_DEFS } from '../index.js';
import { SHOP_CARD_POOL } from '../config.js';

describe('permafrost_lance', () => {
  it('has the expected card definition properties', () => {
    const def = CARD_DEFS.permafrost_lance;
    expect(def).toBeDefined();
    expect(def.type).toBe('spell');
    expect(def.magicStoneCost).toBe(30);
    expect(def.damage).toBe(8);
    expect(def.radius).toBe(6);
    expect(def.freezeDurationMs).toBe(2000);
    expect(def.effect).toBe('frost_nova');
  });

  it('is included in the shop card pool', () => {
    expect(SHOP_CARD_POOL).toContain('permafrost_lance');
  });
});
