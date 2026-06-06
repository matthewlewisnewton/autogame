import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	updateEnemies,
	updateEnemyProjectiles,
	spawnIceBall,
	isSlowed,
	ENEMY_DEFS,
} from '../index.js';
// Pure layout helpers (no shared module state) — safe to import directly.
import {
	computeWalkableAABBs,
	computeDungeonBounds,
} from '../simulation.js';

const DEF = ENEMY_DEFS.glacial_thrower;

// A single large open room so traveling ice balls stay "inside the dungeon"
// for the duration of each test.
function buildOpenLayout() {
	return {
		rooms: [{ x: 0, z: 0, width: 60, depth: 60, role: 'start', walls: [] }],
		passages: [],
	};
}

function makeThrower(overrides = {}) {
	// Mirror an enemy after ensureEnemyCombatStats() has copied the def's stat
	// fields (combat stats + ice-ball tuning) onto the live instance.
	return {
		id: 'thrower',
		type: 'glacial_thrower',
		x: 0,
		z: 0,
		hp: DEF.hp,
		maxHp: DEF.hp,
		state: 'idle',
		attackState: 'idle',
		wanderTarget: { x: 0, z: 0 },
		chaseSpeed: DEF.chaseSpeed,
		wanderSpeed: DEF.wanderSpeed,
		attackDamage: DEF.attackDamage,
		attackWindupMs: DEF.attackWindupMs,
		attackStyle: DEF.attackStyle,
		attackRange: DEF.attackRange,
		iceBallSpeed: DEF.iceBallSpeed,
		iceBallSlowDurationMs: DEF.iceBallSlowDurationMs,
		iceBallSlowFactor: DEF.iceBallSlowFactor,
		iceBallRadius: DEF.iceBallRadius,
		iceBallMaxRange: DEF.iceBallMaxRange,
		...overrides,
	};
}

describe('glacial_thrower ice-ball projectile', () => {
	const NOW = 2_000_000;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		resetGameState();
		// Wire a big open room into the live game-state (resetGameState already
		// pointed the simulation at `gameState`, so mutating it in place is enough).
		const layout = buildOpenLayout();
		gameState.layout = layout;
		gameState.walkableAABBs = computeWalkableAABBs(layout);
		gameState.dungeonBounds = computeDungeonBounds(layout);
		gameState.run = { status: 'playing' };
		gameState.enemies = [];
		gameState.iceBalls = [];
		gameState.players = {};
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// ── Enemy definition shape ──

	it('is defined as a ranged ice_ball thrower with slow tuning', () => {
		expect(DEF.attackStyle).toBe('ice_ball');
		expect(DEF.iceBallSlowDurationMs).toBeGreaterThan(0);
		expect(DEF.iceBallSlowFactor).toBeGreaterThan(0);
		expect(DEF.iceBallSlowFactor).toBeLessThanOrEqual(1);
		// The ice ball must crawl: clearly below the player's max move speed (12).
		expect(DEF.iceBallSpeed).toBeLessThan(12);
	});

	// ── (a) wind-up completion spawns a projectile ──

	it('spawns an ice-ball projectile when the attack wind-up completes', () => {
		const thrower = makeThrower();
		gameState.enemies.push(thrower);
		gameState.players.p1 = { id: 'p1', x: 4, z: 0, hp: 100, dead: false };

		// First tick: acquire the player and enter wind-up (no instant strike).
		updateEnemies();
		expect(thrower.attackState).toBe('windup');
		expect(gameState.iceBalls).toHaveLength(0);
		expect(gameState.players.p1.hp).toBe(100); // ranged: no melee/cone damage on wind-up start

		// Advance past the wind-up and resolve it: a projectile is launched.
		vi.setSystemTime(Date.now() + DEF.attackWindupMs + 50);
		updateEnemies();

		expect(gameState.iceBalls).toHaveLength(1);
		expect(thrower.attackState).toBe('recovering');
		const ball = gameState.iceBalls[0];
		expect(ball.ownerId).toBe(thrower.id);
		// Aimed toward the player (locked +x direction).
		expect(ball.dirX).toBeCloseTo(1, 5);
		expect(ball.dirZ).toBeCloseTo(0, 5);
	});

	// ── (b) projectile travels over successive ticks ──

	it('advances the projectile in a straight line over successive ticks', () => {
		// Launch a ball manually (no player in its path) so it just travels.
		const thrower = makeThrower({ windupDirX: 1, windupDirZ: 0 });
		const ball = spawnIceBall(thrower);
		expect(ball.x).toBeCloseTo(0, 5);

		const dt = 1 / 20; // TICK_RATE
		const stepPerTick = DEF.iceBallSpeed * dt;

		updateEnemyProjectiles();
		expect(gameState.iceBalls).toHaveLength(1);
		expect(gameState.iceBalls[0].x).toBeCloseTo(stepPerTick, 5);

		updateEnemyProjectiles();
		expect(gameState.iceBalls[0].x).toBeCloseTo(stepPerTick * 2, 5);

		// Still on the z=0 axis (straight-line travel).
		expect(gameState.iceBalls[0].z).toBeCloseTo(0, 5);
	});

	it('expires a projectile once it travels beyond its max range', () => {
		const thrower = makeThrower({ windupDirX: 1, windupDirZ: 0 });
		spawnIceBall(thrower);
		// Force it just past max range; next tick must drop it.
		gameState.iceBalls[0].traveled = DEF.iceBallMaxRange;
		updateEnemyProjectiles();
		expect(gameState.iceBalls).toHaveLength(0);
	});

	it('expires a projectile that leaves the dungeon bounds', () => {
		const thrower = makeThrower({ x: 30, z: 0, windupDirX: 1, windupDirZ: 0 });
		spawnIceBall(thrower); // starts on the +x wall, travels outward
		updateEnemyProjectiles();
		// Stepped outside the 60-wide room (|x| > 30) → removed.
		expect(gameState.iceBalls).toHaveLength(0);
	});

	// ── (c) projectile reaching a player applies SLOW + damage ──

	it('applies SLOW and damage to a player it reaches, then is removed', () => {
		const thrower = makeThrower({ windupDirX: 1, windupDirZ: 0 });
		// Place the ball one tick-step away from the player so the next update lands it.
		const ball = spawnIceBall(thrower);
		const dt = 1 / 20;
		const step = DEF.iceBallSpeed * dt;
		gameState.players.p1 = { id: 'p1', x: ball.x + step, z: 0, hp: 100, dead: false };

		expect(isSlowed(gameState.players.p1)).toBe(false);

		updateEnemyProjectiles();

		expect(isSlowed(gameState.players.p1)).toBe(true);
		expect(gameState.players.p1.slowFactor).toBe(DEF.iceBallSlowFactor);
		expect(gameState.players.p1.hp).toBe(100 - DEF.attackDamage);
		// The ball is consumed on contact.
		expect(gameState.iceBalls).toHaveLength(0);
	});

	it('does not accumulate projectiles: a missed ball is cleaned up by range', () => {
		const thrower = makeThrower({ windupDirX: 1, windupDirZ: 0 });
		spawnIceBall(thrower);
		// No player in the path; tick until it exceeds max range.
		const dt = 1 / 20;
		const ticks = Math.ceil(DEF.iceBallMaxRange / (DEF.iceBallSpeed * dt)) + 2;
		for (let i = 0; i < ticks; i++) updateEnemyProjectiles();
		expect(gameState.iceBalls).toHaveLength(0);
	});
});
