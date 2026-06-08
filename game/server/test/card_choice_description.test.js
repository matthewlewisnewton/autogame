import { describe, it, expect } from 'vitest';
import {
  cardChoiceDescription,
  CARD_DEFS,
} from '../index.js';

describe('cardChoiceDescription', () => {
  it('returns def.description for flame_blade (wind-up text)', () => {
    const def = CARD_DEFS.flame_blade;
    const result = cardChoiceDescription(def);
    expect(result).toBe(def.description);
    expect(result).toContain('wind-up');
  });

  it('returns def.description for magma_greatsword (wind-up text)', () => {
    const def = CARD_DEFS.magma_greatsword;
    const result = cardChoiceDescription(def);
    expect(result).toBe(def.description);
    expect(result).toContain('wind-up');
  });

  it('falls back to generic type-based text for cards without description', () => {
    const def = CARD_DEFS.iron_sword;
    const result = cardChoiceDescription(def);
    // iron_sword has no description field, so it should fall back to the weapon template
    expect(result).not.toBe(def.description);
    expect(result).toContain('output technique');
  });

  it('returns empty string for null/undefined def', () => {
    expect(cardChoiceDescription(null)).toBe('');
    expect(cardChoiceDescription(undefined)).toBe('');
  });
});
