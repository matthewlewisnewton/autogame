import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';
import {
  STAT_LABELS,
  formatStatValue,
  buildLockOnPanelModel,
  syncLockOnInfoPanel,
} from '../lock-on-info-panel.js';

const require = createRequire(import.meta.url);
const { buildEnemyDisplayCatalog } = require('../../server/enemyDisplay.js');

const catalog = buildEnemyDisplayCatalog();

function createPanelDom() {
  const panelEl = document.createElement('div');
  panelEl.id = 'lock-on-info-panel';
  panelEl.classList.add('hidden');
  panelEl.setAttribute('aria-hidden', 'true');

  const nameEl = document.createElement('h2');
  nameEl.id = 'lock-on-target-name';
  panelEl.appendChild(nameEl);

  const variantEl = document.createElement('span');
  variantEl.id = 'lock-on-target-variant';
  variantEl.classList.add('lock-on-variant-badge', 'hidden');
  panelEl.appendChild(variantEl);

  const hpEl = document.createElement('div');
  hpEl.id = 'lock-on-target-hp';
  panelEl.appendChild(hpEl);

  const statsEl = document.createElement('div');
  statsEl.id = 'lock-on-target-stats';
  panelEl.appendChild(statsEl);

  const descEl = document.createElement('p');
  descEl.id = 'lock-on-target-description';
  panelEl.appendChild(descEl);

  document.body.appendChild(panelEl);

  return { panelEl, nameEl, variantEl, hpEl, statsEl, descEl };
}

afterEach(() => {
  document.getElementById('lock-on-info-panel')?.remove();
});

describe('STAT_LABELS', () => {
  it('maps common surfaced stat keys to readable labels', () => {
    expect(STAT_LABELS.attackDamage).toBe('Attack');
    expect(STAT_LABELS.chaseSpeed).toBe('Chase speed');
    expect(STAT_LABELS.radius).toBe('Explosion radius');
    expect(STAT_LABELS.burnDurationMs).toBe('Burn duration');
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

  it('formats burn duration in seconds', () => {
    const enemy = { type: 'ember_wraith', burnDurationMs: 2800 };
    expect(formatStatValue(enemy, 'burnDurationMs', catalog)).toBe('2.8s');
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

  it('builds a field_medic panel with support stats and description', () => {
    const enemy = {
      type: 'field_medic',
      hp: 50,
      maxHp: 65,
      attackDamage: 6,
      healAmount: 18,
      healCooldownMs: 4000,
      fleeSpeed: 5.0,
    };
    const model = buildLockOnPanelModel(enemy, catalog);
    expect(model).toEqual({
      name: 'Field Medic',
      variantName: undefined,
      description:
        'Fragile support drone that kites attackers, heals nearby allies, and fires defensive suppression beads.',
      hpText: '50 / 65',
      stats: [
        { label: 'Attack', value: '6' },
        { label: 'healAmount', value: '18' },
        { label: 'healCooldownMs', value: '4000' },
        { label: 'fleeSpeed', value: '5' },
      ],
    });
  });

  it('builds an ember_wraith panel with burn duration and description', () => {
    const enemy = {
      type: 'ember_wraith',
      hp: 40,
      maxHp: 55,
      attackDamage: 8,
      attackStyle: 'cone',
      chaseSpeed: 4.2,
      burnDurationMs: 2800,
    };
    const model = buildLockOnPanelModel(enemy, catalog);
    expect(model).toEqual({
      name: 'Ember Wraith',
      variantName: undefined,
      description: 'Fast cone striker that ignites players on hit, leaving them burning.',
      hpText: '40 / 55',
      stats: [
        { label: 'Attack', value: '8' },
        { label: 'Attack style', value: 'Cone' },
        { label: 'Chase speed', value: '4.2' },
        { label: 'Burn duration', value: '2.8s' },
      ],
    });
  });

  it('prefers namedRare.name over affix variant for the variant line', () => {
    const enemy = {
      type: 'grunt',
      variant: 'volatile',
      namedRare: { name: 'The Fake in Yellow', tint: '#ffdd00' },
      hp: 80,
      maxHp: 100,
      attackDamage: 10,
      attackStyle: 'radial',
      chaseSpeed: 2.5,
    };
    const model = buildLockOnPanelModel(enemy, catalog);
    expect(model.variantName).toBe('The Fake in Yellow');
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

describe('syncLockOnInfoPanel', () => {
  it('shows a populated panel while locked onto a living enemy', () => {
    const dom = createPanelDom();
    const enemy = {
      type: 'grunt',
      hp: 62,
      maxHp: 100,
      attackDamage: 10,
      attackStyle: 'radial',
      chaseSpeed: 2.5,
    };

    syncLockOnInfoPanel({ ...dom, enemy, catalog });

    expect(dom.panelEl.classList.contains('hidden')).toBe(false);
    expect(dom.panelEl.getAttribute('aria-hidden')).toBe('false');
    expect(dom.nameEl.textContent).toBe('Bulkhead Drone');
    expect(dom.hpEl.textContent).toBe('62 / 100');
    expect(dom.statsEl.querySelectorAll('.lock-on-stat-row')).toHaveLength(3);
    expect(dom.descEl.textContent).toContain('Slow, durable radial attacker.');
  });

  it('hides the panel when the enemy is missing or unlocked', () => {
    const dom = createPanelDom();
    const enemy = {
      type: 'grunt',
      hp: 62,
      maxHp: 100,
      attackDamage: 10,
      attackStyle: 'radial',
      chaseSpeed: 2.5,
    };

    syncLockOnInfoPanel({ ...dom, enemy, catalog });
    expect(dom.panelEl.classList.contains('hidden')).toBe(false);

    syncLockOnInfoPanel({ ...dom, enemy: null, catalog });
    expect(dom.panelEl.classList.contains('hidden')).toBe(true);
    expect(dom.panelEl.getAttribute('aria-hidden')).toBe('true');
  });

  it('updates HP text when the same enemy id receives a new hp value', () => {
    const dom = createPanelDom();
    const enemy = {
      type: 'grunt',
      hp: 80,
      maxHp: 100,
      attackDamage: 10,
      attackStyle: 'radial',
      chaseSpeed: 2.5,
    };

    syncLockOnInfoPanel({ ...dom, enemy, catalog });
    expect(dom.hpEl.textContent).toBe('80 / 100');

    syncLockOnInfoPanel({
      ...dom,
      enemy: { ...enemy, hp: 45 },
      catalog,
    });
    expect(dom.hpEl.textContent).toBe('45 / 100');
  });
});
