import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	applySlow,
	isSlowed,
	createGameState,
	gameState,
	updateEnemies,
	DETECTION_RADIUS,
} from '../index.js';
import {
	applyPlayerMovement,
	buildMovementContext,
	setGameState,
	rebuildWallColliders,
	computeWalkableAABBs,
	computeDungeonBounds,
} from '../simulation.js';

describe('SLOW status helpers', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('applySlow sets slowedUntil and slowFactor', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const entity = {};
		applySlow(entity, 2000, 0.4);
		expect(entity.slowedUntil).toBe(now + 2000);
		expect(entity.slowFactor).toBe(0.4);
	});

	it('defaults slowFactor to 0.5 when omitted or invalid', () => {
		const a = {};
		applySlow(a, 1000);
		expect(a.slowFactor).toBe(0.5);

		const b = {};
		applySlow(b, 1000, 0); // out of (0, 1] range
		expect(b.slowFactor).toBe(0.5);

		const c = {};
		applySlow(c, 1000, 2); // > 1
		expect(c.slowFactor).toBe(0.5);

		const d = {};
		applySlow(d, 1000, 'nope');
		expect(d.slowFactor).toBe(0.5);
	});

	it('isSlowed is true while active and false after expiry', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const entity = {};
		expect(isSlowed(entity)).toBe(false); // never applied
		applySlow(entity, 1000, 0.5);
		expect(isSlowed(entity)).toBe(true);
		vi.setSystemTime(now + 999);
		expect(isSlowed(entity)).toBe(true);
		vi.setSystemTime(now + 1000);
		expect(isSlowed(entity)).toBe(false); // expired (now == slowedUntil)
		vi.setSystemTime(now + 5000);
		expect(isSlowed(entity)).toBe(false);
	});

	it('re-application refreshes to the later expiry and never shortens', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const entity = {};
		applySlow(entity, 5000, 0.5);
		const longExpiry = entity.slowedUntil;

		// A shorter slow must NOT shorten the existing longer window.
		applySlow(entity, 1000, 0.3);
		expect(entity.slowedUntil).toBe(longExpiry);
		// ...but the active factor reflects the most recent application.
		expect(entity.slowFactor).toBe(0.3);

		// A longer slow extends the window.
		vi.setSystemTime(now + 100);
		applySlow(entity, 9000, 0.6);
		expect(entity.slowedUntil).toBe(now + 100 + 9000);
		expect(entity.slowFactor).toBe(0.6);
	});

	it('works identically for player-shaped and enemy-shaped entities', () => {
		const player = { id: 'p1', hp: 100 };
		const enemy = { id: 'e1', type: 'grunt', hp: 50 };
		applySlow(player, 1000, 0.5);
		applySlow(enemy, 1000, 0.5);
		expect(isSlowed(player)).toBe(true);
		expect(isSlowed(enemy)).toBe(true);
	});

	it('tolerates a null entity without throwing', () => {
		expect(() => applySlow(null, 1000, 0.5)).not.toThrow();
		expect(isSlowed(null)).toBe(false);
		expect(isSlowed(undefined)).toBe(false);
	});
});

// ── SLOW integrated into player movement ──

function buildOpenLayout() {
	return {
		rooms: [{ x: 0, z: 0, width: 20, depth: 20, walls: [] }],
		passages: [],
	};
}

function makePlayer(overrides = {}) {
	return {
		id: 'p1',
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		dead: false,
		inputDx: 1,
		inputDz: 0,
		inputRotation: 0,
		inputActive: true,
		lastInputTime: Date.now(),
		persistenceDirty: false,
		...overrides,
	};
}

describe('SLOW applied to player movement', () => {
	let state;
	let movementContext;
	const NOW = 1_000_000;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		state = createGameState();
		state.gamePhase = 'playing';
		state.layout = buildOpenLayout();
		state.walkableAABBs = computeWalkableAABBs(state.layout);
		state.dungeonBounds = computeDungeonBounds(state.layout);
		movementContext = buildMovementContext(state);
		setGameState(state, {});
		rebuildWallColliders();
	});

	afterEach(() => {
		setGameState(null, null);
		vi.useRealTimers();
	});

	// Refresh both players' input freshness to the current (fake) clock and
	// advance the simulation one fixed tick.
	function tick() {
		for (const p of Object.values(state.players)) {
			if (p.inputActive) p.lastInputTime = Date.now();
		}
		applyPlayerMovement(state, movementContext);
	}

	it('moves a slowed player a shorter distance per tick than an un-slowed player', () => {
		state.players.p1 = makePlayer({ id: 'p1', x: 0 });
		state.players.p2 = makePlayer({ id: 'p2', x: 0 });
		applySlow(state.players.p2, 5000, 0.5);

		tick();

		const normalDist = state.players.p1.x;
		const slowedDist = state.players.p2.x;
		expect(slowedDist).toBeLessThan(normalDist);
		expect(slowedDist).toBeCloseTo(normalDist * 0.5, 5);
	});

	it('stacks the slow factor multiplicatively with ground_anchor (does not replace it)', () => {
		// anchor alone
		state.players.p1 = makePlayer({ id: 'p1', x: 0, anchorUntil: NOW + 5000, anchorSpeedMultiplier: 0.7 });
		// anchor + slow
		state.players.p2 = makePlayer({ id: 'p2', x: 0, anchorUntil: NOW + 5000, anchorSpeedMultiplier: 0.7 });
		applySlow(state.players.p2, 5000, 0.5);

		tick();

		const anchorOnly = state.players.p1.x;
		const anchorAndSlow = state.players.p2.x;
		// 0.7 * 0.5 = 0.35 of full, i.e. half of the anchor-only distance.
		expect(anchorAndSlow).toBeCloseTo(anchorOnly * 0.5, 5);
	});

	it('returns a player to full step distance on the tick after slow expires', () => {
		state.players.p1 = makePlayer({ id: 'p1', x: 0 }); // never slowed (control)
		state.players.p2 = makePlayer({ id: 'p2', x: 0 });
		applySlow(state.players.p2, 1000, 0.5);

		tick();
		const slowedStep = state.players.p2.x;
		const fullStep = state.players.p1.x;
		expect(slowedStep).toBeCloseTo(fullStep * 0.5, 5);

		// Advance past expiry and reset positions for a clean per-tick comparison.
		vi.setSystemTime(NOW + 2000);
		state.players.p1.x = 0;
		state.players.p2.x = 0;
		expect(isSlowed(state.players.p2)).toBe(false);

		tick();
		expect(state.players.p2.x).toBeCloseTo(state.players.p1.x, 5);
		expect(state.players.p2.x).toBeGreaterThan(slowedStep);
	});

	it('keeps a player slowed past the original expiry when re-applied', () => {
		state.players.p1 = makePlayer({ id: 'p1', x: 0 }); // control, never slowed
		state.players.p2 = makePlayer({ id: 'p2', x: 0 });
		applySlow(state.players.p2, 1000, 0.5); // expires at NOW + 1000

		// Re-apply just before the first window ends.
		vi.setSystemTime(NOW + 900);
		applySlow(state.players.p2, 1000, 0.5); // now expires at NOW + 1900

		// Past the ORIGINAL expiry — should still be slowed thanks to re-application.
		vi.setSystemTime(NOW + 1500);
		expect(isSlowed(state.players.p2)).toBe(true);

		state.players.p1.x = 0;
		state.players.p2.x = 0;
		tick();
		expect(state.players.p2.x).toBeCloseTo(state.players.p1.x * 0.5, 5);
	});
});

// ── SLOW integrated into enemy chase ──

function resetState() {
	Object.assign(gameState, createGameState());
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		hp: 100,
		dead: false,
		lastActivity: Date.now(),
		ready: false,
		magicStones: 30,
		currency: 0,
		debugScenario: null,
		pendingSummons: new Set(),
		deck: [],
		...overrides,
	};
}

function makeChasingGrunt(overrides = {}) {
	const startDist = DETECTION_RADIUS - 1;
	return {
		id: 'grunt',
		x: startDist,
		z: 0,
		type: 'grunt',
		hp: 100,
		maxHp: 100,
		state: 'idle',
		attackState: 'idle',
		wanderTarget: { x: startDist, z: 0 },
		...overrides,
	};
}

describe('SLOW applied to enemy chase in updateEnemies()', () => {
	beforeEach(() => {
		resetState();
	});

	it('a slowed enemy covers less chase distance per tick than an un-slowed enemy', () => {
		const startDist = DETECTION_RADIUS - 1;

		addPlayer('p1', { x: 0, z: 0, dead: false });
		gameState.enemies.push(makeChasingGrunt({ id: 'normal', x: startDist }));
		updateEnemies();
		const normalMoved = Math.abs(startDist - gameState.enemies[0].x);

		resetState();

		addPlayer('p1', { x: 0, z: 0, dead: false });
		const slowed = makeChasingGrunt({ id: 'slowed', x: startDist });
		applySlow(slowed, 5000, 0.5);
		gameState.enemies.push(slowed);
		updateEnemies();
		const slowedMoved = Math.abs(startDist - gameState.enemies[0].x);

		expect(slowedMoved).toBeLessThan(normalMoved);
		expect(slowedMoved).toBeCloseTo(normalMoved * 0.5, 5);
	});

	it('a frozen enemy does not move even while also slowed', () => {
		const startDist = DETECTION_RADIUS - 1;
		addPlayer('p1', { x: 0, z: 0, dead: false });
		const enemy = makeChasingGrunt({ id: 'frozen', x: startDist, frozenUntil: Date.now() + 5000 });
		applySlow(enemy, 5000, 0.5);
		gameState.enemies.push(enemy);

		updateEnemies();

		expect(gameState.enemies[0].x).toBe(startDist); // freeze takes precedence
	});

	it('an enemy returns to normal chase speed on the tick after slow expires', () => {
		const startDist = DETECTION_RADIUS - 1;
		const NOW = 2_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(NOW);

		try {
			addPlayer('p1', { x: 0, z: 0, dead: false });
			const enemy = makeChasingGrunt({ id: 'expiring', x: startDist });
			applySlow(enemy, 1000, 0.5); // expires at NOW + 1000
			gameState.enemies.push(enemy);

			const beforeSlow = enemy.x;
			updateEnemies();
			const slowedMoved = Math.abs(beforeSlow - enemy.x);

			// Advance past expiry; reset position for a clean single-tick comparison.
			vi.setSystemTime(NOW + 2000);
			enemy.x = startDist;
			expect(isSlowed(enemy)).toBe(false);

			updateEnemies();
			const fullMoved = Math.abs(startDist - enemy.x);

			expect(fullMoved).toBeGreaterThan(slowedMoved);
			expect(fullMoved).toBeCloseTo(slowedMoved / 0.5, 5);
		} finally {
			vi.useRealTimers();
		}
	});

	it('re-application keeps an enemy slowed past the original expiry', () => {
		const startDist = DETECTION_RADIUS - 1;
		const NOW = 3_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(NOW);

		try {
			addPlayer('p1', { x: 0, z: 0, dead: false });
			const enemy = makeChasingGrunt({ id: 'refreshed', x: startDist });
			applySlow(enemy, 1000, 0.5); // expires at NOW + 1000
			vi.setSystemTime(NOW + 900);
			applySlow(enemy, 1000, 0.5); // refreshed: expires at NOW + 1900
			gameState.enemies.push(enemy);

			// Past the original expiry but inside the refreshed window.
			vi.setSystemTime(NOW + 1500);
			expect(isSlowed(enemy)).toBe(true);

			const beforeSlow = enemy.x;
			updateEnemies();
			const slowedMoved = Math.abs(beforeSlow - enemy.x);

			// Reference un-slowed move at the same clock for comparison.
			resetState();
			vi.setSystemTime(NOW + 1500);
			addPlayer('p1', { x: 0, z: 0, dead: false });
			gameState.enemies.push(makeChasingGrunt({ id: 'normal', x: startDist }));
			const beforeNormal = gameState.enemies[0].x;
			updateEnemies();
			const normalMoved = Math.abs(beforeNormal - gameState.enemies[0].x);

			expect(slowedMoved).toBeCloseTo(normalMoved * 0.5, 5);
		} finally {
			vi.useRealTimers();
		}
	});
});
