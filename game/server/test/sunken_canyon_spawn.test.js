import { describe, it, expect, beforeEach } from 'vitest';
import config from '../config.js';
import {
	generateLayout,
	roomsByBand,
	buildAdjacencyMap,
	bfsDistances,
	randomRoomPositionByRole,
	mulberry32,
} from '../dungeon.js';
import {
	spawnEnemies,
	spawnCrystals,
	firstRoomPosition,
	gameState,
	resetGameState,
} from '../index.js';

const SEED = 13703;

function sunkenLayout(seed = SEED) {
	return generateLayout(seed, 'sunken-canyon');
}

function positionInRoom(pos, room) {
	const halfW = room.width / 2;
	const halfD = room.depth / 2;
	return (
		Math.abs(pos.x - room.x) <= halfW &&
		Math.abs(pos.z - room.z) <= halfD
	);
}

function bandAtPosition(layout, pos) {
	for (const room of layout.rooms) {
		if (positionInRoom(pos, room)) return room.band;
	}
	return null;
}

function countEnemiesByBand(layout, enemies) {
	const counts = { plateau: 0, canyon: 0, ramp: 0, other: 0 };
	for (const enemy of enemies) {
		const band = bandAtPosition(layout, enemy);
		if (band === 'plateau' || band === 'canyon' || band === 'ramp') {
			counts[band]++;
		} else {
			counts.other++;
		}
	}
	return counts;
}

function isInsideCanyonAABB(pos, canyon) {
	const halfW = canyon.width / 2;
	const halfD = canyon.depth / 2;
	return (
		pos.x >= canyon.x - halfW &&
		pos.x <= canyon.x + halfW &&
		pos.z >= canyon.z - halfD &&
		pos.z <= canyon.z + halfD
	);
}

describe('sunken-canyon spawn distribution and objectives', () => {
	beforeEach(() => resetGameState());

	function deploySunkenCanyon(seed = SEED) {
		gameState.selectedQuestId = 'sunken_canyon';
		gameState.layout = sunkenLayout(seed);
		gameState.layoutSeed = seed;
		gameState.enemies = [];
		gameState.loot = [];
		spawnEnemies();
	}

	it('firstRoomPosition places the player on the plateau, north of ramp mouths', () => {
		const layout = sunkenLayout();
		gameState.layout = layout;
		const plateau = roomsByBand(layout, 'plateau')[0];
		const pos = firstRoomPosition();
		expect(bandAtPosition(layout, pos)).toBe('plateau');
		const halfD = plateau.depth / 2;
		expect(pos.z).toBeLessThan(plateau.z);
		expect(pos.z).toBeGreaterThan(plateau.z - halfD + config.SPAWN_PADDING);
	});

	it('spawnCombatEnemies: plateau ≥ 1, canyon majority, zero on ramps (fixed seed)', () => {
		deploySunkenCanyon();
		const layout = gameState.layout;
		const total = gameState.enemies.length;
		expect(total).toBeGreaterThan(0);
		const counts = countEnemiesByBand(layout, gameState.enemies);
		expect(counts.plateau).toBeGreaterThanOrEqual(1);
		expect(counts.canyon).toBeGreaterThan(total / 2);
		expect(counts.ramp).toBe(0);
		expect(counts.other).toBe(0);
	});

	it('enemy spawn band counts are deterministic for the same seed', () => {
		deploySunkenCanyon();
		const first = gameState.enemies.map((e) => ({ x: e.x, z: e.z }));
		resetGameState();
		deploySunkenCanyon();
		const second = gameState.enemies.map((e) => ({ x: e.x, z: e.z }));
		expect(second).toEqual(first);
	});

	it('objective anchor (treasure room sample) lies on the canyon floor', () => {
		const layout = sunkenLayout();
		const canyon = roomsByBand(layout, 'canyon')[0];
		const rng = mulberry32(SEED + 1000);
		const anchor = randomRoomPositionByRole(layout, 'treasure', rng);
		expect(isInsideCanyonAABB(anchor, canyon)).toBe(true);
	});

	it('crystal objectives spawn inside the canyon AABB', () => {
		const layout = sunkenLayout();
		const canyon = roomsByBand(layout, 'canyon')[0];
		gameState.layout = layout;
		gameState.loot = [];
		spawnCrystals(layout, mulberry32(SEED + 2000), 3);
		const crystals = gameState.loot.filter((l) => l.kind === 'crystal');
		expect(crystals.length).toBe(3);
		for (const c of crystals) {
			expect(isInsideCanyonAABB(c, canyon)).toBe(true);
		}
	});

	it('plateau spawn has finite BFS distance to the canyon objective room', () => {
		const layout = sunkenLayout();
		gameState.layout = layout;
		const spawn = firstRoomPosition();
		const canyon = roomsByBand(layout, 'canyon')[0];
		const adj = buildAdjacencyMap(layout);
		const dist = bfsDistances(adj, layout.stageMeta.plateauRoomIndex);
		expect(dist[layout.stageMeta.canyonRoomIndex]).not.toBe(Infinity);
		expect(bandAtPosition(layout, spawn)).toBe('plateau');
		expect(isInsideCanyonAABB({ x: canyon.x, z: canyon.z }, canyon)).toBe(true);
	});
});
