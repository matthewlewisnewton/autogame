import { describe, it, expect } from 'vitest';
import { LOOT_LIFETIME_MS } from '../config.js';

/**
 * The game loop purges expired loot each tick:
 *
 *   state.loot = state.loot.filter(l => l.questCritical || (now - l.createdAt) < LOOT_LIFETIME_MS);
 *
 * This regression test ensures quest-critical loot (e.g. quest crystals) survives
 * past the lifetime threshold while ordinary loot is still removed.
 */

/** Replicate the exact filter predicate used in the game loop (index.js). */
function filterExpiredLoot(loot, now) {
  return loot.filter(l => l.questCritical || (now - l.createdAt) < LOOT_LIFETIME_MS);
}

describe('loot lifetime filter', () => {
  it('LOOT_LIFETIME_MS is 120 000 ms', () => {
    expect(LOOT_LIFETIME_MS).toBe(120000);
  });

  it('removes ordinary loot that has exceeded LOOT_LIFETIME_MS', () => {
    const now = Date.now();
    const oldLoot = { id: 'old-gold', kind: 'gold', createdAt: now - LOOT_LIFETIME_MS - 1 };

    const loot = [oldLoot];
    const remaining = filterExpiredLoot(loot, now);

    expect(remaining).toHaveLength(0);
  });

  it('keeps ordinary loot that is still within LOOT_LIFETIME_MS', () => {
    const now = Date.now();
    const freshLoot = { id: 'fresh-gold', kind: 'gold', createdAt: now - LOOT_LIFETIME_MS + 1 };

    const loot = [freshLoot];
    const remaining = filterExpiredLoot(loot, now);

    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('fresh-gold');
  });

  it('keeps quest-critical loot even after LOOT_LIFETIME_MS has elapsed', () => {
    const now = Date.now();
    const oldCrystal = {
      id: 'quest-crystal',
      kind: 'crystal',
      questCritical: true,
      createdAt: now - LOOT_LIFETIME_MS - 10000, // 10 s past expiry
    };

    const loot = [oldCrystal];
    const remaining = filterExpiredLoot(loot, now);

    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('quest-crystal');
  });

  it('correctly mixes quest-critical and ordinary entries in a single filter pass', () => {
    const now = Date.now();

    const loot = [
      { id: 'crystal-1', kind: 'crystal', questCritical: true, createdAt: now - LOOT_LIFETIME_MS - 50000 },
      { id: 'gold-old', kind: 'gold', createdAt: now - LOOT_LIFETIME_MS - 1 },
      { id: 'gold-fresh', kind: 'gold', createdAt: now - 5000 },
      { id: 'crystal-2', kind: 'crystal', questCritical: true, createdAt: now - LOOT_LIFETIME_MS - 200000 },
      { id: 'ms-old', kind: 'magic_stone', createdAt: now - LOOT_LIFETIME_MS - 1 },
    ];

    const remaining = filterExpiredLoot(loot, now);

    expect(remaining).toHaveLength(3);
    const ids = remaining.map(l => l.id);
    expect(ids).toContain('crystal-1');
    expect(ids).toContain('crystal-2');
    expect(ids).toContain('gold-fresh');
    expect(ids).not.toContain('gold-old');
    expect(ids).not.toContain('ms-old');
  });
});
