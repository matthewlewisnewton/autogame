import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// All state-driven sim functions must come from index.js: under the test runner
// index.js and simulation.js load as separate module instances, and resetGameState()
// wires _gameState on index.js's simulation instance. The directly-imported pure
// helpers below take their inputs as arguments, so either instance is fine.
import {
	resetGameState,
	gameState,
	updateEnemies,
	updateBurning,
	applyPlayerMovement,
	applyBurning,
	debugTimeScale,
	debugScaledDt,
	simNow,
} from '../index.js';
import {
	computeWalkableAABBs,
	computeDungeonBounds,
	buildMovementContext,
} from '../simulation.js';

const TICK_RATE = 20;          // ticks/sec → 50ms per tick
const TICK_MS = 1000 / TICK_RATE;

// Large open room: no walls so line-of-sight is always clear and entities stay
// inside the dungeon while we drive the sim.
function wireLayout() {
	const layout = { rooms: [{ x: 0, z: 0, width: 60, depth: 60, role: 'start', walls: [] }], passages: [] };
	gameState.layout = layout;
	gameState.walkableAABBs = computeWalkableAABBs(layout);
	gameState.dungeonBounds = computeDungeonBounds(layout);
	gameState.run = { status: 'playing' };
	gameState.enemies = [];
	gameState.minions = [];
	gameState.players = {};
}

// Minimal grunt; ensureEnemyCombatStats() fills combat stats from the def
// (chaseSpeed 2.5, attackWindupMs 800, attackDamage 10) because chaseSpeed is undefined.
function makeGrunt(overrides = {}) {
	return {
		id: 'g1', type: 'grunt', x: 0, z: 0, hp: 30, maxHp: 30,
		state: 'idle', attackState: 'idle', wanderTarget: { x: 0, z: 0 }, ...overrides,
	};
}

function addPlayer(x, z) {
	gameState.players.p1 = { id: 'p1', x, z, hp: 100, dead: false, extracted: false };
	return gameState.players.p1;
}

// Run one full sim tick the way runGameLoopTick would: advance wall-clock by one
// tick, then run the enemy update (which advances the scaled clock) and burn pass.
function tick() {
	vi.advanceTimersByTime(TICK_MS);
	updateEnemies();
	updateBurning();
}

describe('debug time-scale applied to simulation', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(2_000_000);
		resetGameState();
		wireLayout();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// ── helpers / clamp ──

	it('debugTimeScale clamps to [0, 1] and defaults to 1', () => {
		gameState.debugTimeScale = 1;
		expect(debugTimeScale()).toBe(1);
		gameState.debugTimeScale = 2;       // above range
		expect(debugTimeScale()).toBe(1);
		gameState.debugTimeScale = -0.5;    // below range
		expect(debugTimeScale()).toBe(0);
		gameState.debugTimeScale = 0.25;
		expect(debugTimeScale()).toBe(0.25);
		expect(debugScaledDt()).toBeCloseTo(0.25 / TICK_RATE, 10);
		gameState.debugTimeScale = undefined;
		expect(debugTimeScale()).toBe(1);   // default
		expect(debugScaledDt()).toBeCloseTo(1 / TICK_RATE, 10);
	});

	// ── enemy chase movement scales with dt ──

	it('enemy chase distance scales: full > half > frozen', () => {
		function chaseDistanceAt(scale) {
			resetGameState();
			wireLayout();
			gameState.debugTimeScale = scale;
			addPlayer(6, 0);                  // within detection (8), beyond attack range (4)
			const enemy = makeGrunt({ x: 0, z: 0 });
			gameState.enemies = [enemy];
			for (let i = 0; i < 4; i++) updateEnemies(); // few ticks so it stays chasing
			return enemy.x;                   // distance moved toward the player along +x
		}

		const full = chaseDistanceAt(1);
		const half = chaseDistanceAt(0.5);
		const frozen = chaseDistanceAt(0);

		expect(full).toBeGreaterThan(0);
		expect(frozen).toBe(0);                       // scale 0 → enemies do not move
		expect(half).toBeCloseTo(full / 2, 5);        // scale 0.5 → exactly half the travel
		expect(half).toBeLessThan(full);
	});

	// ── enemy freezes mid-windup at scale 0 (no strike) ──

	it('enemy lands its windup strike at scale 1 but never at scale 0', () => {
		function hpAfterWindup(scale, ticks) {
			resetGameState();
			wireLayout();
			gameState.debugTimeScale = scale;
			const player = addPlayer(3, 0);   // inside attack range (4) → enemy winds up immediately
			gameState.enemies = [makeGrunt({ x: 0, z: 0 })];
			for (let i = 0; i < ticks; i++) tick();
			return player.hp;
		}

		// 800ms windup = 16 ticks; 30 ticks of sim is plenty of time to strike.
		expect(hpAfterWindup(1, 30)).toBeLessThan(100);   // strike landed
		// At scale 0 the windup clock never advances, so the enemy is frozen
		// mid-windup and never lands a hit no matter how long we wait.
		expect(hpAfterWindup(0, 60)).toBe(100);
	});

	// ── status DoT (burn) ticks slow with the world ──

	it('burn accrues less damage per wall-clock second under slow-mo', () => {
		function burnDamageOver(scale, ticks) {
			resetGameState();
			wireLayout();
			gameState.debugTimeScale = scale;
			const player = addPlayer(40, 40); // far away: no enemy interaction, just burning
			applyBurning(player, 60_000);     // long burn so it never expires during the window
			for (let i = 0; i < ticks; i++) tick();
			return 100 - player.hp;
		}

		const fullSpeed = burnDamageOver(1, 40);   // ~2000ms of sim → several burn ticks
		const slowMo = burnDamageOver(0.5, 40);    // ~1000ms of sim → fewer burn ticks

		expect(fullSpeed).toBeGreaterThan(0);
		expect(slowMo).toBeGreaterThan(0);
		expect(fullSpeed).toBeGreaterThan(slowMo); // slow-mo accrues DoT more slowly
	});

	// ── player movement is NOT scaled ──

	it('player movement is identical at scale 1 and scale 0', () => {
		function playerDisplacement(scale) {
			resetGameState();
			wireLayout();
			gameState.debugTimeScale = scale;
			const player = addPlayer(0, 0);
			player.inputActive = true;
			player.inputDx = 1;
			player.inputDz = 0;
			player.lastInputTime = Date.now();
			const ctx = buildMovementContext(gameState);
			const startX = player.x;
			for (let i = 0; i < 5; i++) {
				updateEnemies();             // advances the scaled clock (must not affect the player)
				applyPlayerMovement(gameState, ctx);
			}
			return player.x - startX;
		}

		const atFull = playerDisplacement(1);
		const atFrozen = playerDisplacement(0);
		expect(atFull).toBeGreaterThan(0);
		expect(atFrozen).toBeCloseTo(atFull, 10); // player unaffected by time-scale
	});

	// ── default scale = 1 leaves the scaled clock pinned to wall-clock ──

	it('simNow tracks Date.now exactly while scale stays 1', () => {
		gameState.debugTimeScale = 1;
		gameState.enemies = [];
		for (let i = 0; i < 10; i++) {
			vi.advanceTimersByTime(TICK_MS);
			updateEnemies();                  // advanceDebugClock is a no-op at scale 1
			expect(simNow()).toBe(Date.now());
		}
		expect(gameState._debugTimeOffsetMs ?? 0).toBe(0);
	});
});
