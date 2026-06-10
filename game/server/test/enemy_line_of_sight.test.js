import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	updateEnemies,
	hasLineOfSight,
	getWallColliders,
} from '../index.js';
// Pure layout helpers (no shared module state) — safe to import directly.
import {
	computeWalkableAABBs,
	computeDungeonBounds,
} from '../simulation.js';

// A large open room so enemies/players stay inside the dungeon while we install
// hand-built walls between them. Walls are the standard layout-room wall shape
// ({ axis, x, z, length }) so getWallColliders() turns them into AABBs.
function buildLayout(walls = []) {
	return {
		rooms: [{ x: 0, z: 0, width: 60, depth: 60, role: 'start', walls }],
		passages: [],
	};
}

function wireLayout(walls) {
	const layout = buildLayout(walls);
	gameState.layout = layout;
	gameState.walkableAABBs = computeWalkableAABBs(layout);
	gameState.dungeonBounds = computeDungeonBounds(layout);
	gameState.run = { status: 'playing' };
	gameState.enemies = [];
	gameState.minions = [];
	gameState.players = {};
}

// Minimal grunt; ensureEnemyCombatStats() fills in combat stats from the def
// because chaseSpeed is left undefined here.
function makeGrunt(overrides = {}) {
	return {
		id: 'g1',
		type: 'grunt',
		x: 0,
		z: 0,
		hp: 30,
		maxHp: 30,
		state: 'idle',
		attackState: 'idle',
		wanderTarget: { x: 0, z: 0 },
		...overrides,
	};
}

function addPlayer(x, z) {
	gameState.players.p1 = { id: 'p1', x, z, hp: 100, dead: false, extracted: false };
}

describe('enemy line-of-sight target acquisition', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(2_000_000);
		resetGameState();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// ── hasLineOfSight helper ──

	it('returns false when a wall AABB straddles the segment, true otherwise', () => {
		const blocking = [{ minX: 2.8, maxX: 3.2, minZ: -5, maxZ: 5 }];
		expect(hasLineOfSight(0, 0, 6, 0, blocking)).toBe(false);
		expect(hasLineOfSight(0, 0, 6, 0, [])).toBe(true);
		// Wall fully off to the side of the segment does not block it.
		const offToSide = [{ minX: 2.8, maxX: 3.2, minZ: 10, maxZ: 20 }];
		expect(hasLineOfSight(0, 0, 6, 0, offToSide)).toBe(true);
	});

	it('defaults its colliders argument to getWallColliders()', () => {
		// A vertical wall at x=3 spanning the play area sits on the x-axis line.
		wireLayout([{ axis: 'z', x: 3, z: 0, length: 10 }]);
		expect(getWallColliders().length).toBeGreaterThan(0);
		expect(hasLineOfSight(0, 0, 6, 0)).toBe(false);
		expect(hasLineOfSight(0, 0, 0, 6)).toBe(true);
	});

	// ── (a) wall between enemy and player blocks acquisition ──

	it('does NOT chase a player ~6 units away behind a wall', () => {
		wireLayout([{ axis: 'z', x: 3, z: 0, length: 10 }]);
		const enemy = makeGrunt({ x: 0, z: 0 });
		gameState.enemies.push(enemy);
		addPlayer(6, 0); // within DETECTION_RADIUS (8) but wall-occluded

		updateEnemies();

		expect(enemy.state).toBe('idle');
		expect(enemy.attackState).toBe('idle');
	});

	// ── (b) clear line acquires the player ──

	it('chases a player ~6 units away with no wall between them', () => {
		wireLayout([]);
		const enemy = makeGrunt({ x: 0, z: 0 });
		gameState.enemies.push(enemy);
		addPlayer(6, 0);

		updateEnemies();

		expect(enemy.state).toBe('chasing');
	});

	// ── (c) doorway gap is not occlusion ──

	it('chases a player visible through a doorway gap between wall colliders', () => {
		// Two vertical wall segments at x=3 with a clear gap around z=0
		// (upper covers z≈[0.8,5.2], lower z≈[-5.2,-0.8]); the z=0 line passes through.
		wireLayout([
			{ axis: 'z', x: 3, z: 3, length: 4 },
			{ axis: 'z', x: 3, z: -3, length: 4 },
		]);
		const enemy = makeGrunt({ x: 0, z: 0 });
		gameState.enemies.push(enemy);
		addPlayer(6, 0); // straight line at z=0 threads the doorway

		updateEnemies();

		expect(enemy.state).toBe('chasing');
	});

	// ── losing line-of-sight reverts a chaser to idle ──

	it('reverts a chasing enemy to idle when the only target steps behind a wall', () => {
		wireLayout([{ axis: 'z', x: 3, z: 0, length: 10 }]);
		const enemy = makeGrunt({ x: 0, z: 0, state: 'chasing', attackState: 'chasing' });
		gameState.enemies.push(enemy);
		addPlayer(6, 0); // occluded by the wall

		updateEnemies();

		expect(enemy.state).toBe('idle');
		expect(enemy.attackState).toBe('idle');
	});
});
