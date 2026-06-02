import { describe, it, expect } from 'vitest';
import {
  gameState,
  createGameState,
  generateLayout,
  mulberry32,
  spawnEnemies,
  spawnLoot,
} from '../index.js';

// spawnCrystals is exported from progression but not re-exported by index.js.
// The same progression module instance is wired to `gameState` at index load,
// so mutating `gameState` here is visible to it.
const { spawnCrystals } = require('../progression.js');

const PLAZA_SEED = 7;
const COVER_PAD = 0.5; // matches dungeon PLAYER_RADIUS used by the spawn guards

// Inside the cover footprint inflated by the entity radius — the guarantee.
function insideInflatedCover(x, z, layout, pad = COVER_PAD) {
  return layout.cover.some(c =>
    x > c.x - c.width / 2 - pad && x < c.x + c.width / 2 + pad &&
    z > c.z - c.depth / 2 - pad && z < c.z + c.depth / 2 + pad);
}

function loadPlaza() {
  Object.assign(gameState, createGameState());
  const layout = generateLayout(PLAZA_SEED, 'open-plaza');
  gameState.layout = layout;
  gameState.layoutSeed = PLAZA_SEED;
  gameState.selectedQuestId = 'open_plaza_trial'; // defeat_enemies on open-plaza
  gameState.enemies = [];
  gameState.loot = [];
  return layout;
}

describe('cover-aware spawning on the open-plaza stage', () => {
  it('enemy spawns never overlap a cover footprint', () => {
    // randomRoomPosition() (the plaza fallback) uses Math.random, so fuzz it.
    for (let run = 0; run < 60; run++) {
      const layout = loadPlaza();
      spawnEnemies();
      expect(gameState.enemies.length).toBeGreaterThan(0);
      for (const e of gameState.enemies) {
        expect(insideInflatedCover(e.x, e.z, layout)).toBe(false);
      }
    }
  });

  it('crystal/item objectives never overlap cover, and are deterministic', () => {
    const layout = loadPlaza();
    spawnCrystals(layout, mulberry32(123), 8);
    const first = gameState.loot
      .filter(l => l.kind === 'crystal')
      .map(c => ({ x: c.x, z: c.z }));
    expect(first.length).toBe(8);
    for (const c of first) {
      expect(insideInflatedCover(c.x, c.z, layout)).toBe(false);
    }

    // Same seed/layout -> identical crystal positions.
    const layout2 = loadPlaza();
    spawnCrystals(layout2, mulberry32(123), 8);
    const second = gameState.loot
      .filter(l => l.kind === 'crystal')
      .map(c => ({ x: c.x, z: c.z }));
    expect(second).toEqual(first);
  });

  it('loot drops never overlap cover', () => {
    const layout = loadPlaza();
    const rng = mulberry32(321);
    // LOOT_SPAWN_CHANCE gates each call; many iterations yield plenty of drops.
    for (let i = 0; i < 400; i++) {
      spawnLoot(layout, rng);
    }
    const drops = gameState.loot.filter(l => l.kind !== 'crystal');
    expect(drops.length).toBeGreaterThan(0);
    for (const l of drops) {
      expect(insideInflatedCover(l.x, l.z, layout)).toBe(false);
    }
  });

  it('cover-free layout still spawns enemies inside rooms (no-op regression)', () => {
    Object.assign(gameState, createGameState());
    const layout = generateLayout(7, 'crowded');
    gameState.layout = layout;
    gameState.layoutSeed = 7;
    gameState.selectedQuestId = 'training_caverns';
    gameState.enemies = [];
    gameState.loot = [];

    expect(layout.cover).toBeUndefined();
    spawnEnemies();
    expect(gameState.enemies.length).toBeGreaterThan(0);
    for (const e of gameState.enemies) {
      const inRoom = layout.rooms.some(r =>
        e.x >= r.x - r.width / 2 && e.x <= r.x + r.width / 2 &&
        e.z >= r.z - r.depth / 2 && e.z <= r.z + r.depth / 2);
      expect(inRoom).toBe(true);
    }
  });
});
