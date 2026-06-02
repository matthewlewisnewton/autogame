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

function tierIndexAt(layout, pos) {
	const room = roomAt(layout, pos.x, pos.z);
	return room && room.band === 'tier' ? room.tierIndex : null;
}

function tierCount(layout) {
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

	it('spawns enemies on low and high tiers, not all on bottom or top alone', () => {
		deploySpire();
		const N = tierCount(gameState.layout);
		expect(gameState.enemies.length).toBeGreaterThan(0);
		const tiers = gameState.enemies.map(e => tierIndexAt(gameState.layout, e));
		expect(tiers.some(t => t !== null && t < N - 1)).toBe(true);
		expect(tiers.some(t => t !== null && t > 0)).toBe(true);
		const onBottom = tiers.filter(t => t === 0).length;
		const onTop = tiers.filter(t => t === N - 1).length;
		expect(onBottom).toBeLessThan(gameState.enemies.length);
		expect(onTop).toBeLessThan(gameState.enemies.length);
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
		const N = tierCount(layout);
		gameState.loot = [];
		spawnCrystals(layout, mulberry32(SEED), 3);
		const crystals = gameState.loot.filter(l => l.kind === 'crystal');
		expect(crystals.length).toBe(3);
		for (const c of crystals) {
			expect(tierIndexAt(layout, c)).toBe(N - 1);
		}
	});

	it('places optional loot on the top tier when spawn chance passes', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);
		const layout = spireAscentLayout();
		const N = tierCount(layout);
		gameState.loot = [];
		spawnLoot(layout, mulberry32(SEED));
		expect(gameState.loot.length).toBe(1);
		expect(tierIndexAt(layout, gameState.loot[0])).toBe(N - 1);
		vi.restoreAllMocks();
	});
});
