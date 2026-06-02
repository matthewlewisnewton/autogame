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
import { buildWallColliders, computeWalkableAABBs } from '../simulation.js';

const SEED = 123;
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

function tierRooms(layout) {
	return layout.rooms.filter(r => r.band === 'tier').sort((a, b) => a.tierIndex - b.tierIndex);
}

function maxTierIndex(layout) {
	const tiers = tierRooms(layout);
	return tiers.length ? tiers[tiers.length - 1].tierIndex : 0;
}

function isWalkable(x, z, aabbs, colliders) {
	const PLAYER_RADIUS = 0.45;
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

	it('spawns enemies on bottom, middle, and top tiers but never on ramps', () => {
		deploySpire();
		expect(gameState.enemies.length).toBeGreaterThan(0);
		const maxTier = maxTierIndex(gameState.layout);
		const tiersHit = new Set();
		for (const enemy of gameState.enemies) {
			const room = roomAt(gameState.layout, enemy.x, enemy.z);
			expect(room?.band).not.toBe('ramp');
			if (room?.band === 'tier') tiersHit.add(room.tierIndex);
		}
		expect(tiersHit.has(0)).toBe(true);
		expect([...tiersHit].some(t => t >= 1 && t < maxTier)).toBe(true);
		expect(tiersHit.has(maxTier)).toBe(true);
	});

	it('never places enemies on ramp connector rooms', () => {
		deploySpire();
		for (const enemy of gameState.enemies) {
			const room = roomAt(gameState.layout, enemy.x, enemy.z);
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
			const room = roomAt(layout, c.x, c.z);
			expect(room?.band).toBe('tier');
			expect(room?.tierIndex).toBe(maxTier);
		}
	});

	it('places optional loot on the top tier when spawn chance passes', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);
		const layout = spireAscentLayout();
		const maxTier = maxTierIndex(layout);
		gameState.loot = [];
		spawnLoot(layout, mulberry32(SEED));
		expect(gameState.loot.length).toBe(1);
		const room = roomAt(layout, gameState.loot[0].x, gameState.loot[0].z);
		expect(room?.band).toBe('tier');
		expect(room?.tierIndex).toBe(maxTier);
		vi.restoreAllMocks();
	});

	it('bottom-tier spawn can reach top-tier treasure center via walkable AABBs', () => {
		for (const seed of [1, 42, 123, 777]) {
			const layout = spireAscentLayout(seed);
			const tiers = tierRooms(layout);
			const start = tiers[0];
			const top = tiers[tiers.length - 1];
			const colliders = buildWallColliders(layout);
			const aabbs = computeWalkableAABBs(layout);
			expect(canReachPoint(start.x, start.z, top.x, top.z, aabbs, colliders)).toBe(true);
		}
	});
});
