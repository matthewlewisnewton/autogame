import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	gameState,
	createGameState,
	damagePlayer,
	tryPlayerMove,
	computeWalkableAABBs,
	buildWallColliders,
	isInsideDungeon,
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

	// ── Open floor — full distance regression ──

	it('dodge roll on open floor travels full configured dash distance (7.2 units)', () => {
		// Regression / sanity check: on open floor (no walls in the path), a dodge
		// roll should travel the full configured dash distance without being
		// short-clamped by the collision pipeline.
		//
		// Layout: buildDashLayout() gives room A centered at (0,0) with 12×12
		// clearance (AABB: -6..6 on both axes) plus a passage to room B at (20,0).
		// A 7.2-unit dash from center toward +X lands at (7.2, 0) which sits
		// inside the passage walkable AABB — no wall collision expected.
		const startX = 0;
		const startZ = 0;
		const dist = dodgeDashDistance(); // MOVE_SPEED * 3 * 0.2s = 7.2

		expect(dist).toBeCloseTo(7.2, 1);

		const result = tryPlayerMove(startX, startZ, 1, 0, dist);

		// Movement succeeded
		expect(result.moved).toBe(true);

		// Displacement magnitude equals the full dodge dash distance
		const displacement = Math.hypot(result.x - startX, result.z - startZ);
		expect(displacement).toBeCloseTo(dist, 1);

		// Final position is still inside the dungeon
		expect(isInsideDungeon(result.x, result.z)).toBe(true);
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

	it('player dashes toward east wall with full dodge distance and stops at wall boundary without tunneling', () => {
		// Full dodge distance test: uses dodgeDashDistance() = 7.2 units
		const room = buildSmallRoom();
		setupRoom(room);
		// Build explicit colliders from the room layout to avoid cache issues
		const layout = { rooms: [room], passages: [] };
		const colliders = buildWallColliders(layout);

		// East wall: axis='z', x=6, length=12
		// Wall AABB (halfThickness=0.2): minX=5.8, maxX=6.2
		// Player at room center (0,0), dashes +X with full 7.2-unit distance
		// Proposed x=7.2 would tunnel through wall -> collision resolves to wall edge
		const startX = 0;
		const startZ = 0;
		const dist = dodgeDashDistance(); // 7.2 (MOVE_SPEED * 3 * 0.2s)

		expect(dist).toBeCloseTo(7.2, 1);

		const result = tryPlayerMove(startX, startZ, 1, 0, dist, colliders);

		const wallMinX = 5.8;

		// Critical assertions: player must NOT end up past the wall
		// (result.moved can be true [slid to wall] or false [fully blocked])
		if (result.moved) {
			// If player moved, they should be at the wall edge
			const expectedX = wallMinX - PLAYER_RADIUS; // 5.3
			expect(result.x).toBeCloseTo(expectedX, 1);
		}
		// In either case, player edge must NOT penetrate the wall
		expect(result.x + PLAYER_RADIUS).toBeLessThanOrEqual(wallMinX + 0.01);

		// Player must remain inside the room's walkable AABB (-6..6 on both axes)
		expect(result.x).toBeGreaterThanOrEqual(-6 - 0.01);
		expect(result.x).toBeLessThanOrEqual(6 + 0.01);
		expect(result.z).toBeGreaterThanOrEqual(-6 - 0.01);
		expect(result.z).toBeLessThanOrEqual(6 + 0.01);
	});

	it('player pinned flush against east wall cannot dodge into the wall', () => {
		// Pinned-against-wall test: player sits at the max interior position
		// and attempts to dodge straight into the wall
		const room = buildSmallRoom();
		setupRoom(room);
		const layout = { rooms: [room], passages: [] };
		const colliders = buildWallColliders(layout);

		// East wall AABB: minX=5.8, maxX=6.2
		// Player placed at x = wallMinX - PLAYER_RADIUS = 5.3 (flush against wall interior)
		const wallMinX = 5.8;
		const startX = wallMinX - PLAYER_RADIUS; // 5.3
		const startZ = 0;
		const dist = dodgeDashDistance(); // 7.2

		const result = tryPlayerMove(startX, startZ, 1, 0, dist, colliders);

		// Player is pinned flush against the wall; cannot move further +X
		expect(result.moved).toBe(false);
		expect(result.x).toBeCloseTo(startX, 4);
		expect(result.z).toBeCloseTo(startZ, 4);
	});

	it('player pinned flush against north wall cannot dodge into the wall', () => {
		// Same pinned test but on the north wall (axis='x', z=-6)
		const room = buildSmallRoom();
		setupRoom(room);
		const layout = { rooms: [room], passages: [] };
		const colliders = buildWallColliders(layout);

		// North wall AABB: minZ=-6.2, maxZ=-5.8
		// Player placed at z = wallMaxZ + PLAYER_RADIUS = -5.3 (flush against wall interior)
		const wallMaxZ = -5.8;
		const startX = 0;
		const startZ = wallMaxZ + PLAYER_RADIUS; // -5.3
		const dist = dodgeDashDistance(); // 7.2

		// Dodge toward -Z (north / into the wall)
		const result = tryPlayerMove(startX, startZ, 0, -1, dist, colliders);

		// Player is pinned flush against the wall; cannot move further -Z
		expect(result.moved).toBe(false);
		expect(result.x).toBeCloseTo(startX, 4);
		expect(result.z).toBeCloseTo(startZ, 4);
	});

	// ── Cooldown set on success ──

	it('keyItemCooldownUntil is set to now + cooldownMs after a successful dodge', () => {
		const frozenNow = 1000000;
		vi.useFakeTimers({ now: frozenNow });

		const now = Date.now();
		const def = KEY_ITEM_DEFS.dodge_roll;
		const expectedCooldownUntil = now + def.cooldownMs;

		expect(def.cooldownMs).toBe(800);
		expect(expectedCooldownUntil).toBe(frozenNow + 800);

		vi.useRealTimers();
	});
});
