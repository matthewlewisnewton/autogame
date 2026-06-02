import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import config from '../config.js';
import {
	mulberry32,
	generateLayout,
	spawnCrystals,
	spawnLoot,
	spawnEnemies,
	gameState,
	resetGameState,
} from '../index.js';

const SEED = 123;

function spireAscentLayout(seed = SEED) {
	return generateLayout(seed, 'spire-ascent');
}

function roomAt(layout, x, z) {
	return layout.rooms.find(r => {
		const hw = r.width / 2;
		const hd = r.depth / 2;
		return x >= r.x - hw && x <= r.x + hw && z >= r.z - hd && z <= r.z + hd;
	});
}

function bandAt(layout, pos) {
	const room = roomAt(layout, pos.x, pos.z);
	return room ? room.band : null;
}

function tierIndexAt(layout, pos) {
	const room = roomAt(layout, pos.x, pos.z);
	return room && room.band === 'tier' ? room.tierIndex : null;
}

function numTiers(layout) {
	return layout.rooms.filter(r => r.band === 'tier').length;
}

describe('spire-ascent quest spawns', () => {
	beforeEach(() => resetGameState());

	function deploySpire(seed = SEED) {
		gameState.selectedQuestId = 'spire_ascent';
		gameState.layout = spireAscentLayout(seed);
		gameState.layoutSeed = seed;
		gameState.enemies = [];
		gameState.loot = [];
		spawnEnemies();
	}

	it('spawns at least one enemy on bottom, middle (when present), and top tiers', () => {
		deploySpire();
		expect(gameState.enemies.length).toBeGreaterThan(0);
		const tiers = gameState.enemies.map(e => tierIndexAt(gameState.layout, e));
		const n = numTiers(gameState.layout);
		expect(tiers.filter(t => t === 0).length).toBeGreaterThanOrEqual(1);
		expect(tiers.filter(t => t === n - 1).length).toBeGreaterThanOrEqual(1);
		if (n === 3) {
			expect(tiers.filter(t => t === 1).length).toBeGreaterThanOrEqual(1);
		} else if (n >= 4) {
			expect(tiers.some(t => t > 0 && t < n - 1)).toBe(true);
		}
	});

	it('never places enemies on ramp connector rooms', () => {
		deploySpire();
		for (const enemy of gameState.enemies) {
			const room = roomAt(gameState.layout, enemy.x, enemy.z);
			expect(room?.role).not.toBe('connector');
			expect(room?.band).not.toBe('ramp');
		}
	});

	it('is deterministic for a fixed seed', () => {
		deploySpire();
		const first = gameState.enemies.map(e => ({ x: e.x, z: e.z }));
		resetGameState();
		deploySpire();
		const second = gameState.enemies.map(e => ({ x: e.x, z: e.z }));
		expect(second).toEqual(first);
	});

	it('places collect-objective crystals only on the top tier', () => {
		const layout = spireAscentLayout();
		const n = numTiers(layout);
		gameState.loot = [];
		spawnCrystals(layout, mulberry32(SEED), 3);
		const crystals = gameState.loot.filter(l => l.kind === 'crystal');
		expect(crystals.length).toBe(3);
		for (const c of crystals) {
			expect(tierIndexAt(layout, c)).toBe(n - 1);
			expect(bandAt(layout, c)).toBe('tier');
		}
	});

	it('places optional loot on the top tier when spawn chance passes', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);
		const layout = spireAscentLayout();
		const n = numTiers(layout);
		gameState.loot = [];
		spawnLoot(layout, mulberry32(SEED));
		expect(gameState.loot.length).toBe(1);
		expect(tierIndexAt(layout, gameState.loot[0])).toBe(n - 1);
		vi.restoreAllMocks();
	});

	it('distributes enemies across tiers for multiple fixed seeds', () => {
		for (const seed of [1, 42, 777, 9999]) {
			resetGameState();
			deploySpire(seed);
			const n = numTiers(gameState.layout);
			const tiers = gameState.enemies.map(e => tierIndexAt(gameState.layout, e));
			expect(tiers.filter(t => t === 0).length).toBeGreaterThanOrEqual(1);
			expect(tiers.filter(t => t === n - 1).length).toBeGreaterThanOrEqual(1);
			if (n === 3) {
				expect(tiers.filter(t => t === 1).length).toBeGreaterThanOrEqual(1);
			} else if (n >= 4) {
				expect(tiers.some(t => t > 0 && t < n - 1)).toBe(true);
			}
		}
	});
});
