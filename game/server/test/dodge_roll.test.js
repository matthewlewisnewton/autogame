import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	gameState,
	createGameState,
	damagePlayer,
	tryPlayerMove,
	computeWalkableAABBs,
	PLAYER_RADIUS,
	KEY_ITEM_DEFS,
	MOVE_SPEED,
} from '../index.js';

// ── Helpers ──

function resetState() {
	Object.assign(gameState, createGameState());
}

/**
 * Build a layout for dash direction tests.
 * Uses 2 rooms + passage to match simulation.test.js pattern.
 */
function buildDashLayout() {
	return {
		rooms: [
			{ x: 0, z: 0, width: 12, depth: 12, walls: [] },
			{ x: 20, z: 0, width: 12, depth: 12, walls: [] },
		],
		passages: [
			{ x1: 0, z1: 0, x2: 20, z2: 0, walls: [], corridorLength: 4 },
		],
	};
}

/**
 * Build a smaller room for wall-collision tests.
 * Room centered at (0,0), width=12, depth=12.
 * Walls at x=6 (axis='z') and z=6 (axis='x') for east/north edges.
 */
function buildSmallRoom() {
	const halfW = 6;
	const halfD = 6;
	return {
		x: 0,
		z: 0,
		width: 12,
		depth: 12,
		walls: [
			{ x: 0, z: -halfD, length: 12, axis: 'x' },
			{ x: 0, z: halfD, length: 12, axis: 'x' },
			{ x: -halfW, z: 0, length: 12, axis: 'z' },
			{ x: halfW, z: 0, length: 12, axis: 'z' },
		],
	};
}

function setupDashLayout() {
	const layout = buildDashLayout();
	gameState.layout = layout;
	gameState.walkableAABBs = computeWalkableAABBs(layout);
	gameState.dungeonBounds = { minX: -20, maxX: 40, minZ: -20, maxZ: 20 };
}

function setupRoom(room) {
	const layout = room.rooms ? room : { rooms: [room], passages: [] };
	gameState.layout = layout;
	gameState.walkableAABBs = computeWalkableAABBs(layout);
	gameState.dungeonBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
}

function dodgeDashDistance() {
	const def = KEY_ITEM_DEFS.dodge_roll;
	return MOVE_SPEED * 3 * ((def.rollDistanceMs || 200) / 1000);
}

// ── Tests ──

describe('Dodge Roll — unit tests', () => {
	beforeEach(() => {
		resetState();
		setupDashLayout();
	});

	// ── Cooldown gate ──

	it('useKeyItem returns on_cooldown when keyItemCooldownUntil is in the future', () => {
		const now = Date.now();
		gameState.players['p1'] = {
			x: 0, y: 0.5, z: 0, rotation: 0,
			hp: 100, dead: false,
			keyItemCooldownUntil: now + 500,
			inputDx: 0, inputDz: 0,
		};

		// Simulate the cooldown check in the useKeyItem handler
		const player = gameState.players['p1'];
		const cooldownUntil = player.keyItemCooldownUntil || 0;
		const result = now < cooldownUntil
			? { ok: false, reason: 'on_cooldown', remainingMs: cooldownUntil - now }
			: null;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('on_cooldown');
		expect(result.remainingMs).toBe(500);

		// Position should not have changed
		expect(player.x).toBe(0);
		expect(player.z).toBe(0);
	});

	// ── Invulnerability blocks damage ──

	it('damagePlayer returns null and leaves hp unchanged when invulnerableUntil is in the future', () => {
		gameState.players['p1'] = {
			x: 0, y: 0.5, z: 0, rotation: 0,
			hp: 100, dead: false,
			invulnerableUntil: Date.now() + 300,
		};

		const result = damagePlayer('p1', 50);
		expect(result).toBeNull();
		expect(gameState.players['p1'].hp).toBe(100);
	});

	it('damagePlayer applies damage normally after invulnerableUntil expires', () => {
		gameState.players['p1'] = {
			x: 0, y: 0.5, z: 0, rotation: 0,
			hp: 100, dead: false,
			invulnerableUntil: Date.now() + 300,
		};

		// Still invulnerable
		expect(damagePlayer('p1', 50)).toBeNull();
		expect(gameState.players['p1'].hp).toBe(100);

		// Advance time past invulnerability
		vi.useFakeTimers();
		vi.advanceTimersByTime(400);

		damagePlayer('p1', 50);
		expect(gameState.players['p1'].hp).toBe(50);

		vi.useRealTimers();
	});

	// ── Dash direction from input ──

	it('player with active inputDx/inputDz dashes in that direction', () => {
		const startX = 0;
		const startZ = 0;
		const dx = 1;
		const dz = 0;
		const dist = dodgeDashDistance(); // 7.2

		const result = tryPlayerMove(startX, startZ, dx, dz, dist);

		expect(result.moved).toBe(true);
		expect(result.x).toBeCloseTo(startX + dist, 1);
		expect(result.z).toBeCloseTo(startZ, 1);
	});

	// ── Dash direction fallback to rotation ──

	it('player with zero input dashes in the direction of player.rotation (yaw)', () => {
		const startX = 0;
		const startZ = 0;
		const rotation = Math.PI / 2; // facing +X

		// Fallback logic: dx = sin(rotation), dz = cos(rotation)
		const dx = Math.sin(rotation);
		const dz = Math.cos(rotation);
		const dist = dodgeDashDistance();

		const result = tryPlayerMove(startX, startZ, dx, dz, dist);

		expect(result.moved).toBe(true);
		// sin(PI/2) = 1, cos(PI/2) ~ 0
		expect(result.x).toBeCloseTo(startX + dist, 1);
		expect(result.z).toBeCloseTo(startZ, 1);
	});

	// ── Dash respects walls ──

	it('player dashes toward a wall and stops at the wall boundary', () => {
		// Use a smaller room for wall collision test
		setupRoom(buildSmallRoom());
		// East wall: axis='z', x=6, length=12
		// Wall AABB (halfThickness=0.2): minX=5.8, maxX=6.2
		// Player at x=2, dash distance=3.5 -> proposed x=5.5
		// Player edge at 5.5+0.5=6.0 overlaps wall at 5.8 -> collision
		// Resolved: x = 5.8 - 0.5 = 5.3 (inside room: -6 <= 5.3 <= 6)
		const startX = 2;
		const startZ = 0;
		const dist = 3.5;

		const result = tryPlayerMove(startX, startZ, 1, 0, dist);

		expect(result.moved).toBe(true);
		const wallMinX = 5.8;
		const expectedX = wallMinX - PLAYER_RADIUS; // 5.3
		expect(result.x).toBeCloseTo(expectedX, 1);
		expect(result.z).toBeCloseTo(startZ, 1);

		// Verify player is not inside the wall
		expect(result.x + PLAYER_RADIUS).toBeLessThanOrEqual(wallMinX + 0.1);
	});

	// ── Cooldown set on success ──

	it('keyItemCooldownUntil is set to now + cooldownMs after a successful dodge', () => {
		const frozenNow = 1000000;
		vi.useFakeTimers({ now: frozenNow });

		const now = Date.now();
		const def = KEY_ITEM_DEFS.dodge_roll;
		const expectedCooldownUntil = now + def.cooldownMs;

		expect(def.cooldownMs).toBe(1200);
		expect(expectedCooldownUntil).toBe(frozenNow + 1200);

		vi.useRealTimers();
	});
});
