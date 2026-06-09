import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';
import {
  buildBossEncounterModel,
  syncBossEncounterHud,
} from '../boss-encounter-hud.js';

const require = createRequire(import.meta.url);
const { buildEnemyDisplayCatalog } = require('../../server/enemyDisplay.js');

const catalog = buildEnemyDisplayCatalog();

function makeBoss(overrides = {}) {
  return { id: 'boss-1', type: 'annex_overseer', hp: 800, maxHp: 1000, ...overrides };
}

function activeEncounter(overrides = {}) {
  return { phase: 'active', locked: false, bossEnemyId: 'boss-1', ...overrides };
}

function createHudDom() {
  const container = document.createElement('div');
  container.id = 'boss-encounter-hud';
  container.classList.add('hidden');
  container.setAttribute('aria-hidden', 'true');

  const nameEl = document.createElement('div');
  nameEl.id = 'boss-encounter-name';
  container.appendChild(nameEl);

  const barEl = document.createElement('div');
  barEl.id = 'boss-encounter-hp-bar';
  const fillEl = document.createElement('div');
  fillEl.id = 'boss-encounter-hp-fill';
  fillEl.classList.add('hp-high');
  barEl.appendChild(fillEl);
  container.appendChild(barEl);

  document.body.appendChild(container);
  return { container, nameEl, fillEl };
}

afterEach(() => {
  document.getElementById('boss-encounter-hud')?.remove();
});

describe('buildBossEncounterModel', () => {
  it('returns null when there is no encounter', () => {
    expect(buildBossEncounterModel({ encounter: null, enemies: [], catalog })).toBeNull();
    expect(buildBossEncounterModel({ enemies: [], catalog })).toBeNull();
    expect(buildBossEncounterModel()).toBeNull();
  });

  it('returns null when the encounter is dormant and not locked', () => {
    const encounter = { phase: 'dormant', locked: false, bossEnemyId: 'boss-1' };
    expect(
      buildBossEncounterModel({ encounter, enemies: [makeBoss()], catalog })
    ).toBeNull();
  });

  it('returns null when no enemy matches bossEnemyId', () => {
    expect(
      buildBossEncounterModel({
        encounter: activeEncounter(),
        enemies: [makeBoss({ id: 'someone-else' })],
        catalog,
      })
    ).toBeNull();
  });

  it('returns null when the matched boss is dead', () => {
    expect(
      buildBossEncounterModel({
        encounter: activeEncounter(),
        enemies: [makeBoss({ hp: 0 })],
        catalog,
      })
    ).toBeNull();
  });

  it('builds a populated model for an active encounter', () => {
    const model = buildBossEncounterModel({
      encounter: activeEncounter(),
      enemies: [makeBoss({ hp: 800, maxHp: 1000 })],
      catalog,
    });
    expect(model).toEqual({
      name: 'Annex Overseer',
      hp: 800,
      maxHp: 1000,
      hpPct: 80,
      tier: 'hp-high',
    });
  });

  it('builds a populated model for a locked encounter even when not active', () => {
    const encounter = { phase: 'dormant', locked: true, bossEnemyId: 'boss-1' };
    const model = buildBossEncounterModel({
      encounter,
      enemies: [makeBoss({ hp: 150, maxHp: 1000 })],
      catalog,
    });
    expect(model).not.toBeNull();
    expect(model.name).toBe('Annex Overseer');
    expect(model.hpPct).toBe(15);
    expect(model.tier).toBe('hp-low');
  });

  it('resolves a stage-boss display name from the real catalog', () => {
    const model = buildBossEncounterModel({
      encounter: activeEncounter(),
      enemies: [makeBoss()],
      catalog,
      questId: 'training_caverns',
    });
    expect(model.name).toBe('Annex Overseer');
  });

  it('shows Canyon Warden for canyon_descent stage-boss encounters', () => {
    const model = buildBossEncounterModel({
      encounter: activeEncounter(),
      enemies: [makeBoss({ type: 'miniboss' })],
      catalog,
      questId: 'canyon_descent',
    });
    expect(model.name).toBe('Canyon Warden');
  });

  it('prefers the variant name when the boss has a catalog variant', () => {
    const model = buildBossEncounterModel({
      encounter: activeEncounter(),
      enemies: [makeBoss({ variant: 'frenzied' })],
      catalog,
    });
    expect(model.name).toBe('Frenzied');
  });

  it('falls back to a generic label when the catalog lacks the entry', () => {
    const model = buildBossEncounterModel({
      encounter: activeEncounter(),
      enemies: [makeBoss({ type: 'unknown_boss' })],
      catalog,
    });
    expect(model.name).toBe('Boss');
  });

  it('clamps hpPct to the 0-100 range', () => {
    const model = buildBossEncounterModel({
      encounter: activeEncounter(),
      enemies: [makeBoss({ hp: 1500, maxHp: 1000 })],
      catalog,
    });
    expect(model.hpPct).toBe(100);
  });
});

describe('syncBossEncounterHud', () => {
  it('shows the container and updates name + HP fill for a truthy model', () => {
    const dom = createHudDom();
    const model = buildBossEncounterModel({
      encounter: activeEncounter(),
      enemies: [makeBoss({ hp: 200, maxHp: 1000 })],
      catalog,
    });

    syncBossEncounterHud(model, dom);

    expect(dom.container.classList.contains('hidden')).toBe(false);
    expect(dom.container.getAttribute('aria-hidden')).toBe('false');
    expect(dom.nameEl.textContent).toBe('Annex Overseer');
    expect(dom.fillEl.style.width).toBe('20%');
    expect(dom.fillEl.classList.contains('hp-low')).toBe(true);
    expect(dom.fillEl.classList.contains('hp-high')).toBe(false);
  });

  it('hides the container when the model is null', () => {
    const dom = createHudDom();
    const model = buildBossEncounterModel({
      encounter: activeEncounter(),
      enemies: [makeBoss()],
      catalog,
    });

    syncBossEncounterHud(model, dom);
    expect(dom.container.classList.contains('hidden')).toBe(false);

    syncBossEncounterHud(null, dom);
    expect(dom.container.classList.contains('hidden')).toBe(true);
    expect(dom.container.getAttribute('aria-hidden')).toBe('true');
  });
});
