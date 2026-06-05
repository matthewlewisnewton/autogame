import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import config from '../config.js';
import { getLayoutGenerationOptions } from '../quests.js';
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

function sunkenCanyonLayout(seed = SEED, tier = 1) {
	const options = getLayoutGenerationOptions('canyon_descent', tier);
	return generateLayout(seed, 'sunken-canyon', options);
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

describe('sunken-canyon quest spawns', () => {
	beforeEach(() => resetGameState());

	function deployCanyon(seed = SEED) {
		gameState.selectedQuestId = 'canyon_descent';
		gameState.layout = sunkenCanyonLayout(seed);
		gameState.layoutSeed = seed;
		gameState.enemies = [];
		gameState.loot = [];
		spawnEnemies();
	}

	it('spawns at least one enemy on plateau and a majority on canyon', () => {
		deployCanyon();
		expect(gameState.enemies.length).toBeGreaterThan(0);
		const bands = gameState.enemies.map(e => bandAt(gameState.layout, e));
		expect(bands.filter(b => b === 'plateau').length).toBeGreaterThanOrEqual(1);
		expect(bands.filter(b => b === 'canyon').length).toBeGreaterThan(gameState.enemies.length / 2);
		expect(bands.some(b => b === 'ramp')).toBe(false);
	});

	it('never places enemies on ramp connector rooms', () => {
		deployCanyon();
		for (const enemy of gameState.enemies) {
			const room = roomAt(gameState.layout, enemy.x, enemy.z);
			expect(room?.role).not.toBe('connector');
			expect(room?.band).not.toBe('ramp');
		}
	});

	it('is deterministic for a fixed seed', () => {
		deployCanyon();
		const first = gameState.enemies.map(e => ({ x: e.x, z: e.z }));
		resetGameState();
		deployCanyon();
		const second = gameState.enemies.map(e => ({ x: e.x, z: e.z }));
		expect(second).toEqual(first);
	});

	it('places collect-objective crystals only in the canyon band', () => {
		const layout = sunkenCanyonLayout();
		gameState.loot = [];
		spawnCrystals(layout, mulberry32(SEED), 3);
		const crystals = gameState.loot.filter(l => l.kind === 'crystal');
		expect(crystals.length).toBe(3);
		for (const c of crystals) {
			expect(bandAt(layout, c)).toBe('canyon');
		}
	});

	it('places optional loot in the canyon band when spawn chance passes', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);
		const layout = sunkenCanyonLayout();
		gameState.loot = [];
		spawnLoot(layout, mulberry32(SEED));
		expect(gameState.loot.length).toBe(1);
		expect(bandAt(layout, gameState.loot[0])).toBe('canyon');
		vi.restoreAllMocks();
	});

	it('getLayoutGenerationOptions uses rigid mode for canyon_descent Tier 2 only', () => {
		expect(getLayoutGenerationOptions('canyon_descent', 1)).toEqual({
			slopes: true,
			layoutMode: 'default',
		});
		expect(getLayoutGenerationOptions('canyon_descent', 2)).toEqual({
			slopes: true,
			layoutMode: 'rigid',
		});
	});

	it('Tier 2 rigid layout preserves band spawn rules', () => {
		gameState.selectedQuestId = 'canyon_descent';
		gameState.selectedQuestTier = 2;
		gameState.layout = sunkenCanyonLayout(SEED, 2);
		gameState.layoutSeed = SEED;
		gameState.enemies = [];
		gameState.loot = [];
		gameState.run = { questTier: 2 };
		spawnEnemies();
		expect(gameState.enemies.length).toBe(6);
		const bands = gameState.enemies.map(e => bandAt(gameState.layout, e));
		expect(bands.filter(b => b === 'plateau').length).toBeGreaterThanOrEqual(1);
		expect(bands.filter(b => b === 'canyon').length).toBeGreaterThan(gameState.enemies.length / 2);
		expect(bands.some(b => b === 'ramp')).toBe(false);
	});
});
