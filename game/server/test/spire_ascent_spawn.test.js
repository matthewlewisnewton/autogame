import { describe, it, expect, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { buildWallColliders, computeWalkableAABBs } from '../simulation.js';
import {
	mulberry32,
	spawnCrystals,
	spawnEnemies,
	gameState,
	resetGameState,
} from '../index.js';
import { getLayoutProfileForQuest } from '../quests.js';

const SEED = 123;
const WALK_STEP = 0.4;
const PLAYER_RADIUS = 0.45;

function spireAscentLayout(seed = SEED) {
	return generateLayout(seed, 'spire-ascent');
}

function tierRooms(layout) {
	return layout.rooms.filter(r => r.band === 'tier').sort((a, b) => a.tierIndex - b.tierIndex);
}

function topTierIndex(layout) {
	const tiers = tierRooms(layout);
	return tiers.length > 0 ? tiers[tiers.length - 1].tierIndex : 0;
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

function canReachTopTreasureFromTier0(layout) {
	const tiers = tierRooms(layout);
	const start = tiers[0];
	const top = tiers[tiers.length - 1];
	const colliders = buildWallColliders(layout);
	const aabbs = computeWalkableAABBs(layout);
	const tolerance = 1.5;
	const seen = new Set();
	const key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
	const queue = [{ x: start.x, z: start.z }];
	seen.add(key(start.x, start.z));
	const dirs = [[WALK_STEP, 0], [-WALK_STEP, 0], [0, WALK_STEP], [0, -WALK_STEP]];

	for (let qi = 0; qi < queue.length && qi < 200000; qi++) {
		const { x, z } = queue[qi];
		if (Math.hypot(x - top.x, z - top.z) <= tolerance) return true;
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

function positionInTopTier(layout, pos) {
	const top = topTierIndex(layout);
	return tierIndexAt(layout, pos) === top;
}

describe('spire-ascent quest spawns', () => {
	beforeEach(() => resetGameState());

	it('quest uses spire-ascent layout profile', () => {
		expect(getLayoutProfileForQuest('spire_ascent')).toBe('spire-ascent');
	});

	function deploySpire(seed = SEED) {
		gameState.selectedQuestId = 'spire_ascent';
		gameState.layout = spireAscentLayout(seed);
		gameState.layoutSeed = seed;
		gameState.enemies = [];
		gameState.loot = [];
		spawnEnemies();
	}

	it('spawns enemies across non-top and non-bottom tiers without ramps', () => {
		deploySpire();
		const layout = gameState.layout;
		const top = topTierIndex(layout);
		expect(gameState.enemies.length).toBeGreaterThanOrEqual(3);

		const tierIndices = gameState.enemies
			.map(e => tierIndexAt(layout, e))
			.filter(idx => idx !== null);

		expect(tierIndices.some(idx => idx < top)).toBe(true);
		expect(tierIndices.some(idx => idx > 0)).toBe(true);

		for (const enemy of gameState.enemies) {
			const room = roomAt(layout, enemy.x, enemy.z);
			expect(room?.band).not.toBe('ramp');
			expect(room?.role).not.toBe('connector');
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
		for (const c of crystals) {
			expect(positionInTopTier(layout, c)).toBe(true);
		}
	});

	it('tier-0 spawn can reach top-tier treasure centre via walkable AABBs', () => {
		for (const seed of [1, 42, SEED, 777, 9999]) {
			const layout = spireAscentLayout(seed);
			expect(canReachTopTreasureFromTier0(layout)).toBe(true);
		}
	});
});
