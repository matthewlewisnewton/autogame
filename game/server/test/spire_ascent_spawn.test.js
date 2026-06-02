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

function tierAt(layout, pos) {
	const room = roomAt(layout, pos.x, pos.z);
	return room && room.band === 'tier' ? room.tierIndex : null;
}

function numTiers(layout) {
	return layout.rooms.filter(r => r.band === 'tier').length;
}

function maxTierIndex(layout) {
	const tiers = layout.rooms.filter(r => r.band === 'tier');
	return tiers.length > 0 ? Math.max(...tiers.map(r => r.tierIndex)) : 0;
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

	it('spawns at least one enemy on bottom tier and on upper tiers', () => {
		deploySpire();
		expect(gameState.enemies.length).toBe(6);
		const tiers = gameState.enemies.map(e => tierAt(gameState.layout, e));
		expect(tiers.filter(t => t === 0).length).toBeGreaterThanOrEqual(1);
		expect(tiers.some(t => t !== null && t > 0)).toBe(true);
		const top = maxTierIndex(gameState.layout);
		if (numTiers(gameState.layout) >= 3) {
			expect(tiers.some(t => t !== null && t < top)).toBe(true);
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
		gameState.loot = [];
		spawnCrystals(layout, mulberry32(SEED), 3);
		const crystals = gameState.loot.filter(l => l.kind === 'crystal');
		expect(crystals.length).toBe(3);
		const top = maxTierIndex(layout);
		for (const c of crystals) {
			expect(tierAt(layout, c)).toBe(top);
		}
	});

	it('places optional loot on the top tier when spawn chance passes', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);
		const layout = spireAscentLayout();
		gameState.loot = [];
		spawnLoot(layout, mulberry32(SEED));
		expect(gameState.loot.length).toBe(1);
		expect(tierAt(layout, gameState.loot[0])).toBe(maxTierIndex(layout));
		vi.restoreAllMocks();
	});
});
