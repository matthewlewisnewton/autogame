import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { buildEnemyDisplayCatalog } from '../enemyDisplay.js';
import { ENEMY_DEFS } from '../simulation.js';
import { VARIANT_DEFS } from '../enemyVariants.js';
import {
  startTestServer,
  closeServer,
  connectClient,
  clearServerUsers,
  setServerUsersFilePath,
} from './helpers.js';
import path from 'path';
import os from 'os';
import fs from 'fs';

const require = createRequire(import.meta.url);

const ENEMY_TYPES = ['grunt', 'skirmisher', 'miniboss', 'annex_overseer', 'arena_champion', 'spire_warden', 'cinder_warden', 'permafrost_warden', 'spawner', 'field_medic', 'glacial_thrower', 'ember_wraith', 'void_seraph', 'rime_drifter'];
const VARIANT_IDS = ['test', 'volatile', 'warded', 'leeching', 'frenzied'];

const COMBAT_ONLY_KEYS = [
  'attackWindupMs',
  'wanderSpeed',
  'attackConeAngle',
  'spawnMaxAlive',
  'apply',
  'id',
];

describe('buildEnemyDisplayCatalog', () => {
  it('includes all enemy types with display fields', () => {
    const catalog = buildEnemyDisplayCatalog();
    expect(Object.keys(catalog.types).sort()).toEqual([...ENEMY_TYPES].sort());
    for (const type of ENEMY_TYPES) {
      const entry = catalog.types[type];
      expect(entry.name).toBe(ENEMY_DEFS[type].name);
      expect(entry.description).toBe(ENEMY_DEFS[type].description);
      expect(entry.surfacedStats).toEqual(ENEMY_DEFS[type].surfacedStats);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('includes all five variants with display fields', () => {
    const catalog = buildEnemyDisplayCatalog();
    expect(Object.keys(catalog.variants).sort()).toEqual([...VARIANT_IDS].sort());
    for (const id of VARIANT_IDS) {
      const entry = catalog.variants[id];
      expect(entry.name).toBe(VARIANT_DEFS[id].name);
      expect(entry.description).toBe(VARIANT_DEFS[id].description);
      expect(entry.surfacedStats).toEqual(VARIANT_DEFS[id].surfacedStats);
    }
  });

  it('omits combat tuning keys not listed in surfacedStats', () => {
    const catalog = buildEnemyDisplayCatalog();
    for (const type of ENEMY_TYPES) {
      const entry = catalog.types[type];
      for (const key of COMBAT_ONLY_KEYS) {
        expect(entry).not.toHaveProperty(key);
      }
      expect(entry).toHaveProperty('attackDamage');
      expect(entry).not.toHaveProperty('attackWindupMs');
    }
    for (const id of VARIANT_IDS) {
      const entry = catalog.variants[id];
      for (const key of COMBAT_ONLY_KEYS) {
        expect(entry).not.toHaveProperty(key);
      }
      if (VARIANT_DEFS[id].surfacedStats.includes('radius')) {
        expect(entry.radius).toBe(VARIANT_DEFS[id].radius);
      }
      if (VARIANT_DEFS[id].surfacedStats.includes('bonusDrop')) {
        expect(entry.bonusDrop).toEqual(VARIANT_DEFS[id].bonusDrop);
      }
    }
  });
});

describe('init payload enemyDisplayCatalog', () => {
  let baseUrl;
  let usersPath;

  beforeEach(async () => {
    usersPath = path.join(
      os.tmpdir(),
      `enemy-display-catalog-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    fs.writeFileSync(usersPath, '{}');
    setServerUsersFilePath(usersPath);
    clearServerUsers();
    baseUrl = await startTestServer();
  });

  afterEach(async () => {
    await closeServer();
    try {
      fs.unlinkSync(usersPath);
    } catch (_) {}
  });

  it('includes enemyDisplayCatalog on socket init', async () => {
    const { session } = await connectClient(baseUrl, `catalog-${Date.now()}`, {
      skipLobby: true,
    });
    expect(session.enemyDisplayCatalog).toBeDefined();
    expect(session.enemyDisplayCatalog.types.grunt.name).toBe(
      ENEMY_DEFS.grunt.name
    );
    expect(session.enemyDisplayCatalog.variants.volatile.radius).toBe(
      VARIANT_DEFS.volatile.radius
    );
    expect(session.enemyDisplayCatalog).toEqual(buildEnemyDisplayCatalog());
  });
});
