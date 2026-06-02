import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import config from '../config.js';
import { generateLayout } from '../dungeon.js';
import { buildWallColliders, computeWalkableAABBs } from '../simulation.js';
import { getLayoutProfileForQuest } from '../quests.js';
import {
	mulberry32,
	spawnCrystals,
	spawnLoot,
	spawnEnemies,
	gameState,
	resetGameState,
} from '../index.js';

const SEED = 123;
const PLAYER_RADIUS = 0.45;
const WALK_STEP = 0.4;

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

function maxTierIndex(layout) {
	const tiers = layout.rooms.filter(r => r.band === 'tier');
	if (tiers.length === 0) return 0;
	return Math.max(...tiers.map(r => r.tierIndex));
}

function isWalkable(x, z, aabbs, colliders) {
	if (!aabbs.some(a => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ)) return false;
	const pr = PLAYER_RADIUS;
	for (const w of colliders) {
		if (x + pr <= w.minX || x - pr >= w.maxX) continue;
		if (z + pr <= w.minZ || z - pr >= w.maxZ) continue;
		return false;
	}
	return true;
}

function canReachPoint(fromX, fromZ, toX, toZ, aabbs, colliders) {
	const tolerance = 1.5;
	const seen = new Set();
	const key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
	const queue = [{ x: fromX, z: fromZ }];
	seen.add(key(fromX, fromZ));
	const dirs = [[WALK_STEP, 0], [-WALK_STEP, 0], [0, WALK_STEP], [0, -WALK_STEP]];

	for (let qi = 0; qi < queue.length && qi < 200000; qi++) {
		const { x, z } = queue[qi];
		if (Math.hypot(x - toX, z - toZ) <= tolerance) return true;
		for (const [dx, dz] of dirs) {
			const nx = x + dx;
			const nz = z + dz;
			const k = key(nx, nz);
			if (seen.has(k) || !isWalkable(nx, nz, aabbs, colliders)) continue;
			seen.add(k);
			queue.push({ x: nx, z: nz });
		}
	}
	return false;
}

describe('spire-ascent quest wiring', () => {
	it('spire_ascent quest uses layoutProfile spire-ascent', () => {
		expect(getLayoutProfileForQuest('spire_ascent')).toBe('spire-ascent');
	});
});

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

	it('spawns enemies across bottom, middle, and top tiers (not all on one tier)', () => {
		deploySpire();
		expect(gameState.enemies.length).toBeGreaterThan(0);
		const maxTier = maxTierIndex(gameState.layout);
		const tiers = gameState.enemies.map(e => tierAt(gameState.layout, e));
		expect(tiers.filter(t => t === 0).length).toBeGreaterThanOrEqual(1);
		expect(tiers.filter(t => t === maxTier).length).toBeGreaterThanOrEqual(1);
		expect(tiers.filter(t => t === 0).length).toBeLessThan(gameState.enemies.length);
		expect(tiers.filter(t => t === maxTier).length).toBeLessThan(gameState.enemies.length);
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
		const maxTier = maxTierIndex(layout);
		gameState.loot = [];
		spawnCrystals(layout, mulberry32(SEED), 3);
		const crystals = gameState.loot.filter(l => l.kind === 'crystal');
		expect(crystals.length).toBe(3);
		for (const c of crystals) {
			expect(tierAt(layout, c)).toBe(maxTier);
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

	it('bottom-tier spawn can reach top-tier treasure center via walkable AABBs', () => {
		for (const seed of [1, 42, 123, 777]) {
			const layout = spireAscentLayout(seed);
			const startRoom = layout.rooms.find(r => r.role === 'start');
			const treasureRoom = layout.rooms.find(r => r.role === 'treasure');
			expect(startRoom?.tierIndex).toBe(0);
			expect(treasureRoom?.tierIndex).toBe(maxTierIndex(layout));
			const colliders = buildWallColliders(layout);
			const aabbs = computeWalkableAABBs(layout);
			expect(
				canReachPoint(startRoom.x, startRoom.z, treasureRoom.x, treasureRoom.z, aabbs, colliders)
			).toBe(true);
		}
	});
});
