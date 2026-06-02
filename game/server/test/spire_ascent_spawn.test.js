import { describe, it, expect, beforeEach, vi } from 'vitest';
import config from '../config.js';
import { isSpireAscentLayout } from '../progression.js';
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

describe('spire-ascent tier spawns', () => {
	beforeEach(() => resetGameState());

	function deploySpire(seed = SEED) {
		gameState.selectedQuestId = 'spire_ascent';
		gameState.layout = spireAscentLayout(seed);
		gameState.layoutSeed = seed;
		gameState.enemies = [];
		gameState.loot = [];
		spawnEnemies();
	}

	it('isSpireAscentLayout is true for profile spire-ascent', () => {
		const layout = spireAscentLayout();
		expect(isSpireAscentLayout(layout)).toBe(true);
		expect(isSpireAscentLayout({ profile: 'crowded' })).toBe(false);
	});

	it('distributes enemies across bottom, middle, and top tiers when tier count >= 3', () => {
		deploySpire();
		expect(gameState.enemies.length).toBeGreaterThanOrEqual(5);
		const layout = gameState.layout;
		const tiers = gameState.enemies.map(e => tierIndexAt(layout, e));
		const uniqueTiers = new Set(tiers);
		expect(tiers.some(t => t === 0)).toBe(true);
		if (tierCount(layout) >= 3) {
			const topIndex = tierCount(layout) - 1;
			expect(tiers.some(t => t > 0 && t < topIndex)).toBe(true);
			expect(tiers.some(t => t === topIndex)).toBe(true);
		}
		expect(uniqueTiers.size).toBeGreaterThan(1);
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

	it('places collect-objective crystals only on the treasure tier', () => {
		const layout = spireAscentLayout();
		gameState.loot = [];
		spawnCrystals(layout, mulberry32(SEED), 3);
		const crystals = gameState.loot.filter(l => l.kind === 'crystal');
		expect(crystals.length).toBe(3);
		const treasure = layout.rooms.find(r => r.role === 'treasure');
		expect(treasure).toBeTruthy();
		for (const c of crystals) {
			const room = roomAt(layout, c.x, c.z);
			expect(room?.band).toBe('tier');
			expect(room?.role).toBe('treasure');
			expect(room?.tierIndex).toBe(treasure.tierIndex);
		}
	});

	it('places optional loot on the treasure tier when spawn chance passes', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);
		const layout = spireAscentLayout();
		gameState.loot = [];
		spawnLoot(layout, mulberry32(SEED));
		expect(gameState.loot.length).toBe(1);
		const room = roomAt(layout, gameState.loot[0].x, gameState.loot[0].z);
		expect(room?.role).toBe('treasure');
		vi.restoreAllMocks();
	});
});
