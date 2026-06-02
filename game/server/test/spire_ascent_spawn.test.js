import { describe, it, expect, beforeEach } from 'vitest';
import {
	mulberry32,
	generateLayout,
	spawnCrystals,
	spawnEnemies,
	assignRunSpawnPositions,
	gameState,
	resetGameState,
} from '../index.js';
import { getLayoutProfileForQuest } from '../quests.js';
import { sampleFloorY } from '../dungeon.js';

const SEED = 123;

function spireLayout(seed = SEED) {
	return generateLayout(seed, 'spire-ascent');
}

function tierRooms(layout) {
	return layout.rooms.filter(r => r.band && r.band.startsWith('tier-'));
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

describe('spire-ascent quest spawns', () => {
	beforeEach(() => resetGameState());

	function deploySpire(seed = SEED) {
		gameState.selectedQuestId = 'spire_climb';
		gameState.layout = spireLayout(seed);
		gameState.layoutSeed = seed;
		gameState.enemies = [];
		gameState.loot = [];
		spawnEnemies();
	}

	it('registers spire_climb with spire-ascent layout profile', () => {
		expect(getLayoutProfileForQuest('spire_climb')).toBe('spire-ascent');
	});

	it('spawns at least one enemy on bottom, middle, and top tiers when tierCount ≥ 3', () => {
		deploySpire();
		const layout = gameState.layout;
		const tiers = tierRooms(layout);
		expect(tiers.length).toBeGreaterThanOrEqual(3);
		const topBand = `tier-${tiers.length - 1}`;
		const bands = gameState.enemies.map(e => bandAt(layout, e));
		expect(bands.filter(b => b === 'tier-0').length).toBeGreaterThanOrEqual(1);
		const middleBands = tiers
			.filter(t => t.band !== 'tier-0' && t.band !== topBand)
			.map(t => t.band);
		if (middleBands.length > 0) {
			expect(bands.some(b => middleBands.includes(b))).toBe(true);
		}
		expect(bands.filter(b => b === topBand).length).toBeGreaterThanOrEqual(1);
		expect(bands.some(b => b === 'ramp')).toBe(false);
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

	it('places collect-objective crystals only on the top treasure tier', () => {
		const layout = spireLayout();
		const tiers = tierRooms(layout);
		const topBand = `tier-${tiers.length - 1}`;
		gameState.loot = [];
		spawnCrystals(layout, mulberry32(SEED), 3);
		const crystals = gameState.loot.filter(l => l.kind === 'crystal');
		expect(crystals.length).toBe(3);
		for (const c of crystals) {
			expect(bandAt(layout, c)).toBe(topBand);
		}
	});

	it('assignRunSpawnPositions seats players on the bottom start tier with sampleFloorY', () => {
		gameState.layout = spireLayout();
		gameState.layoutSeed = SEED;
		const player = { x: 0, z: 0, y: 0 };
		assignRunSpawnPositions([player]);
		const startRoom = gameState.layout.rooms.find(r => r.role === 'start');
		expect(startRoom).toBeTruthy();
		const room = roomAt(gameState.layout, player.x, player.z);
		expect(room?.band).toBe('tier-0');
		const expectedY = sampleFloorY(gameState.layout, player.x, player.z);
		expect(player.y).toBe(expectedY);
	});
});
