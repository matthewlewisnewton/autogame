import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import {
  STAT_LABELS,
  formatStatValue,
  buildLockOnPanelModel,
} from '../lock-on-info-panel.js';

const require = createRequire(import.meta.url);
const { buildEnemyDisplayCatalog } = require('../../server/enemyDisplay.js');

const catalog = buildEnemyDisplayCatalog();

describe('STAT_LABELS', () => {
  it('maps common surfaced stat keys to readable labels', () => {
    expect(STAT_LABELS.attackDamage).toBe('Attack');
    expect(STAT_LABELS.chaseSpeed).toBe('Chase speed');
    expect(STAT_LABELS.radius).toBe('Explosion radius');
  });
});

describe('formatStatValue', () => {
  it('prefers live enemy values over catalog defaults', () => {
    const enemy = {
      type: 'grunt',
      attackDamage: 7,
    };
    expect(formatStatValue(enemy, 'attackDamage', catalog)).toBe('7');
  });

  it('falls back to catalog type defaults when live value is absent', () => {
    const enemy = { type: 'grunt' };
    expect(formatStatValue(enemy, 'attackDamage', catalog)).toBe('10');
  });
});

describe('buildLockOnPanelModel', () => {
  it('returns null for missing or dead enemies', () => {
    expect(buildLockOnPanelModel(null, catalog)).toBeNull();
    expect(buildLockOnPanelModel(undefined, catalog)).toBeNull();
    expect(
      buildLockOnPanelModel(
        { type: 'grunt', hp: 0, maxHp: 100 },
        catalog
      )
    ).toBeNull();
  });

  it('builds a base grunt panel with live HP and type stats', () => {
    const enemy = {
      type: 'grunt',
      hp: 62,
      maxHp: 100,
      attackDamage: 10,
      attackStyle: 'radial',
      chaseSpeed: 2.5,
    };
    const model = buildLockOnPanelModel(enemy, catalog);
    expect(model).toEqual({
      name: 'Bulkhead Drone',
      variantName: undefined,
      description: 'Slow, durable radial attacker.',
      hpText: '62 / 100',
      stats: [
        { label: 'Attack', value: '10' },
        { label: 'Attack style', value: 'Radial' },
        { label: 'Chase speed', value: '2.5' },
      ],
    });
  });

  it('appends variant name, stats, and description for volatile grunts', () => {
    const enemy = {
      type: 'grunt',
      variant: 'volatile',
      hp: 40,
      maxHp: 100,
      attackDamage: 10,
      attackStyle: 'radial',
      chaseSpeed: 2.5,
      radius: 5,
      damage: 20,
    };
    const model = buildLockOnPanelModel(enemy, catalog);
    expect(model.name).toBe('Bulkhead Drone');
    expect(model.variantName).toBe('Volatile');
    expect(model.hpText).toBe('40 / 100');
    expect(model.description).toContain('Slow, durable radial attacker.');
    expect(model.description).toContain('Explodes on death');
    const labels = model.stats.map((s) => s.label);
    expect(labels).toContain('Attack');
    expect(labels).toContain('Explosion radius');
    expect(labels).toContain('Explosion damage');
    const radiusRow = model.stats.find((s) => s.label === 'Explosion radius');
    expect(radiusRow.value).toBe('5');
  });
});
