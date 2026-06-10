import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	updateEnemies,
	updateEnemyProjectiles,
	spawnEnemy,
	isEntityInEnemyAttack,
	ENEMY_DEFS,
} from '../index.js';
// Pure layout helpers (no shared module state) — safe to import directly.
import {
	computeWalkableAABBs,
	computeDungeonBounds,
} from '../simulation.js';
// Floor oracle: compute the expected grounded Y independently of the helper.
import { sampleFloorY, resolveFloorY } from '../../shared/floorSampling.js';
import { buildEnemyDisplayCatalog } from '../enemyDisplay.js';

// A single large open room with an explicit, non-default floor height so a
// hovering enemy's Y is provably `floorY + altitude` (not just the 0.5 default).
const FLOOR_HEIGHT = 1.5;
function buildOpenLayout() {
	return {
		rooms: [
			{
				x: 0,
				z: 0,
				width: 60,
				depth: 60,
				role: 'start',
				walls: [],
				floorCorners: {
					yNW: FLOOR_HEIGHT,
					yNE: FLOOR_HEIGHT,
					ySE: FLOOR_HEIGHT,
					ySW: FLOOR_HEIGHT,
				},
			},
		],
		passages: [],
	};
}

function floorYAt(layout, x, z) {
	return resolveFloorY(sampleFloorY(layout, x, z));
}

function wireOpenWorld() {
	resetGameState();
	const layout = buildOpenLayout();
	gameState.layout = layout;
	gameState.walkableAABBs = computeWalkableAABBs(layout);
	gameState.dungeonBounds = computeDungeonBounds(layout);
	gameState.run = { status: 'playing' };
	gameState.enemies = [];
	gameState.iceBalls = [];
	gameState.minions = [];
	gameState.players = {};
	return layout;
}

// ── Enemy definitions ──

describe('flying enemy definitions', () => {
	it('declares void_seraph as a high-hovering radial attacker', () => {
		const def = ENEMY_DEFS.void_seraph;
		expect(def.flying).toBe(true);
		expect(def.altitude).toBeGreaterThan(0);
		expect(Number.isFinite(def.altitude)).toBe(true);
		expect(def.attackStyle).toBe('radial');
		expect(Number.isFinite(def.attackRange)).toBe(true);
		// Standard combat fields present.
		expect(def.hp).toBeGreaterThan(0);
		expect(def.chaseSpeed).toBeGreaterThan(0);
		expect(def.wanderSpeed).toBeGreaterThan(0);
		expect(def.attackDamage).toBeGreaterThan(0);
		expect(def.attackWindupMs).toBeGreaterThan(0);
		// Display metadata for the lock-on panel.
		expect(def.name.length).toBeGreaterThan(0);
		expect(def.description.length).toBeGreaterThan(0);
		expect(def.surfacedStats).toContain('attackStyle');
		expect(def.surfacedStats).toContain('attackRange');
	});

	it('declares rime_drifter as a high-hovering height-aware ice-ball thrower', () => {
		const def = ENEMY_DEFS.rime_drifter;
		expect(def.flying).toBe(true);
		expect(def.altitude).toBeGreaterThan(0);
		expect(Number.isFinite(def.altitude)).toBe(true);
		expect(def.attackStyle).toBe('ice_ball');
		// Its own ice-ball tuning fields.
		expect(def.iceBallSpeed).toBeGreaterThan(0);
		expect(def.iceBallSpeed).toBeLessThan(12); // crawls below player MOVE_SPEED
		expect(def.iceBallRadius).toBeGreaterThan(0);
		expect(def.iceBallMaxRange).toBeGreaterThan(0);
		expect(def.iceBallSlowDurationMs).toBeGreaterThan(0);
		expect(def.iceBallSlowFactor).toBeGreaterThan(0);
		expect(def.iceBallSlowFactor).toBeLessThanOrEqual(1);
		// Standard combat fields present.
		expect(def.hp).toBeGreaterThan(0);
		expect(def.chaseSpeed).toBeGreaterThan(0);
		expect(def.attackDamage).toBeGreaterThan(0);
		expect(def.attackWindupMs).toBeGreaterThan(0);
		// Display metadata for the lock-on panel.
		expect(def.name.length).toBeGreaterThan(0);
		expect(def.description.length).toBeGreaterThan(0);
		expect(def.surfacedStats).toContain('attackStyle');
	});
});

// ── Hover Y (never re-grounded) ──

describe('flying enemies hover at floorY + altitude', () => {
	beforeEach(() => {
		wireOpenWorld();
	});

	for (const type of ['void_seraph', 'rime_drifter']) {
		it(`hovers a spawned ${type} at floorY + altitude each tick (never re-grounded)`, () => {
			const enemy = spawnEnemy(5, 5, type);
			// The def's flying/altitude flow onto the instance via ...statFieldsFromDef.
			expect(enemy.flying).toBe(true);
			expect(enemy.altitude).toBe(ENEMY_DEFS[type].altitude);

			const floorY = floorYAt(gameState.layout, enemy.x, enemy.z);
			updateEnemies();
			expect(enemy.y).toBe(floorY + enemy.altitude);
			// Airborne, not floor-snapped — matching ember_wraith.
			expect(enemy.y).not.toBe(floorY);

			// Stays airborne across further ticks.
			updateEnemies();
			const floorY2 = floorYAt(gameState.layout, enemy.x, enemy.z);
			expect(enemy.y).toBe(floorY2 + enemy.altitude);
		});
	}
});

// ── void_seraph: spherical (3D) radial attack ──

describe('void_seraph radial attack resolves with true 3D distance', () => {
	function makeSeraph(overrides = {}) {
		const def = ENEMY_DEFS.void_seraph;
		return {
			id: 'seraph',
			type: 'void_seraph',
			x: 0,
			y: 0.5,
			z: 0,
			attackStyle: def.attackStyle,
			attackRange: def.attackRange,
			...overrides,
		};
	}

	function makePlayer(overrides = {}) {
		return { id: 'p1', x: 0, y: 0.5, z: 0, hp: 100, dead: false, ...overrides };
	}

	it('misses a player XZ-close but beyond attackRange in 3D (above)', () => {
		const enemy = makeSeraph();
		const range = ENEMY_DEFS.void_seraph.attackRange;
		// XZ distance < range, but 3D distance > range (player far overhead).
		const target = makePlayer({ x: range - 1, z: 0, y: 0.5 + range });
		expect(Math.hypot(range - 1, range)).toBeGreaterThan(range);
		expect(isEntityInEnemyAttack(enemy, target)).toBe(false);
	});

	it('misses a player XZ-close but beyond attackRange in 3D (below)', () => {
		const enemy = makeSeraph({ y: 0.5 + ENEMY_DEFS.void_seraph.altitude });
		const range = ENEMY_DEFS.void_seraph.attackRange;
		const target = makePlayer({ x: range - 1, z: 0, y: 0.5 });
		const dy = ENEMY_DEFS.void_seraph.altitude;
		expect(Math.hypot(range - 1, dy)).toBeGreaterThan(range);
		expect(isEntityInEnemyAttack(enemy, target)).toBe(false);
	});

	it('hits a player within the 3D sphere even at a different height', () => {
		const enemy = makeSeraph();
		const range = ENEMY_DEFS.void_seraph.attackRange;
		// 3D distance hypot(2, 2) ≈ 2.83 < range — radial has no angle gate.
		const target = makePlayer({ x: 2, z: 0, y: 0.5 + 2 });
		expect(Math.hypot(2, 2)).toBeLessThan(range);
		expect(isEntityInEnemyAttack(enemy, target)).toBe(true);
	});
});

// ── rime_drifter: height-aware ice ball ──

describe('rime_drifter launches a height-aware ice ball', () => {
	const NOW = 3_000_000;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		wireOpenWorld();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('launches a ball with non-zero dirY when its target is at a different height, and that ball damages the player', () => {
		const drifter = spawnEnemy(0, 0, 'rime_drifter');
		// Let the drifter exist for a tick first so the engine stamps its hover
		// world-Y (floorY + altitude). A drifter alive ≥1 tick then aims from its
		// true altitude when it locks a wind-up direction (mirrors real gameplay).
		const floorY = floorYAt(gameState.layout, drifter.x, drifter.z);
		updateEnemies();
		expect(drifter.y).toBe(floorY + drifter.altitude);

		// Grounded player below the high-hovering drifter so the locked aim has a
		// clear vertical (downward) component.
		gameState.players.p1 = { id: 'p1', x: 4, y: FLOOR_HEIGHT, z: 0, hp: 100, dead: false };

		// Acquire the player and enter wind-up (no instant strike for a ranged foe).
		updateEnemies();
		expect(drifter.attackState).toBe('windup');
		expect(gameState.iceBalls).toHaveLength(0);
		expect(gameState.players.p1.hp).toBe(100); // ranged: no melee damage on wind-up start

		// Resolve the wind-up: a height-aware projectile is launched.
		vi.setSystemTime(Date.now() + ENEMY_DEFS.rime_drifter.attackWindupMs + 50);
		updateEnemies();

		expect(gameState.iceBalls).toHaveLength(1);
		const ball = gameState.iceBalls[0];
		expect(ball.ownerId).toBe(drifter.id);
		// The drifter hovers above the grounded player → the aim tilts downward.
		expect(ball.dirY).toBeLessThan(0);
		expect(Math.abs(ball.dirY)).toBeGreaterThan(0);

		// The in-flight ball reaches and damages the player via the 3D contact check.
		const maxTicks = Math.ceil(
			ENEMY_DEFS.rime_drifter.iceBallMaxRange / (ENEMY_DEFS.rime_drifter.iceBallSpeed / 20),
		) + 5;
		for (let i = 0; i < maxTicks && gameState.iceBalls.length > 0; i++) {
			updateEnemyProjectiles();
		}
		expect(gameState.players.p1.hp).toBe(100 - ENEMY_DEFS.rime_drifter.attackDamage);
		expect(gameState.players.p1.slowFactor).toBe(ENEMY_DEFS.rime_drifter.iceBallSlowFactor);
		expect(gameState.iceBalls).toHaveLength(0);
	});
});

// ── Display catalog presence ──

describe('flying enemies surface in the display catalog', () => {
	it('includes void_seraph and rime_drifter with populated display fields', () => {
		const catalog = buildEnemyDisplayCatalog();
		for (const type of ['void_seraph', 'rime_drifter']) {
			const entry = catalog.types[type];
			expect(entry).toBeDefined();
			expect(entry.name).toBe(ENEMY_DEFS[type].name);
			expect(entry.description).toBe(ENEMY_DEFS[type].description);
			expect(entry.surfacedStats.length).toBeGreaterThan(0);
			// Each surfaced stat key resolves to a value on the entry.
			for (const key of entry.surfacedStats) {
				expect(entry[key]).toBeDefined();
			}
		}
	});
});
