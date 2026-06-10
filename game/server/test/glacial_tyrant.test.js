import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	gameState,
	createGameState,
	spawnEnemy,
	ENEMY_DEFS,
	enemyDefFor,
	getEnemyCardDrop,
	getEnemyMagicStoneDrop,
	resetGameState,
	updateEnemies,
	MOVE_SPEED,
} from '../index.js';
import {
	DIFFICULTY_MINIBOSS_HP_PER_PLAYER,
	difficultyScaleFactor,
} from '../config.js';
import { buildEnemyDisplayCatalog } from '../enemyDisplay.js';
// Pure layout helpers (no shared module state) — safe to import directly.
import {
	computeWalkableAABBs,
	computeDungeonBounds,
	setGameState as setSimulationGameState,
} from '../simulation.js';
import { setGameState as setProgressionGameState } from '../progression.js';

const DEF = ENEMY_DEFS.glacial_tyrant;

function resetState() {
	const fresh = createGameState();
	Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
	gameState.enemies.length = 0;
	gameState.minions.length = 0;
	gameState.loot.length = 0;
	gameState.areaEffects.length = 0;
	gameState.enchantments.length = 0;
	gameState.lobby.length = 0;
	gameState.gamePhase = fresh.gamePhase;
	gameState.selectedQuestId = fresh.selectedQuestId;
	gameState.pendingTrades = {};
	gameState.shopOffer = null;
	gameState.telepipe = null;
	gameState._pendingMinionBreaths = [];
	gameState.run = null;
}

function makePlayer(i) {
	return { x: i, y: 0.5, z: 0, rotation: 0, hp: 100, dead: false, extracted: false };
}

function setPartySize(count) {
	Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
	for (let i = 1; i <= count; i++) {
		gameState.players[`p${i}`] = makePlayer(i);
	}
}

const BASE_GLACIAL_TYRANT_HP = DEF.hp;

describe('glacial_tyrant enemy type', () => {
	beforeEach(() => {
		resetState();
	});

	it('is registered in ENEMY_DEFS as a boss-tier ice-ball hurler', () => {
		expect(DEF.name).toBe('Glacial Tyrant');
		expect(DEF.description.length).toBeGreaterThan(0);
		expect(DEF.surfacedStats).toContain('hp');
		expect(DEF.attackStyle).toBe('ice_ball');
		// Boss-tier HP: above permafrost_warden's Tier-I boss baseline.
		expect(DEF.hp).toBeGreaterThanOrEqual(420);
		expect(DEF.hp).toBeGreaterThan(ENEMY_DEFS.permafrost_warden.hp);
	});

	it('carries its own ice-ball tuning, with speed below player MOVE_SPEED', () => {
		expect(DEF.iceBallSpeed).toBeGreaterThan(0);
		expect(DEF.iceBallSpeed).toBeLessThan(MOVE_SPEED);
		expect(DEF.iceBallSlowDurationMs).toBeGreaterThan(0);
		expect(DEF.iceBallSlowFactor).toBeGreaterThan(0);
		expect(DEF.iceBallSlowFactor).toBeLessThanOrEqual(1);
		expect(DEF.iceBallRadius).toBeGreaterThan(0);
		expect(DEF.iceBallMaxRange).toBeGreaterThan(0);
		// Distinct heavier tuning than the trash-tier glacial_thrower.
		expect(DEF.iceBallRadius).toBeGreaterThan(ENEMY_DEFS.glacial_thrower.iceBallRadius);
		expect(DEF.iceBallMaxRange).toBeGreaterThan(ENEMY_DEFS.glacial_thrower.iceBallMaxRange);
	});

	it('enemyDefFor resolves the type and the display catalog surfaces it', () => {
		expect(() => enemyDefFor('glacial_tyrant')).not.toThrow();
		expect(enemyDefFor('glacial_tyrant')).toBe(DEF);

		const entry = buildEnemyDisplayCatalog().types.glacial_tyrant;
		expect(entry).toBeDefined();
		expect(entry.name).toBe('Glacial Tyrant');
		expect(entry.description).toBe(DEF.description);
		expect(entry.surfacedStats).toEqual(DEF.surfacedStats);
	});

	it('spawnEnemy succeeds and copies the ice-ball tuning onto the instance', () => {
		setPartySize(2);
		const tyrant = spawnEnemy(3, 4, 'glacial_tyrant');
		expect(tyrant.type).toBe('glacial_tyrant');
		expect(tyrant.hp).toBe(BASE_GLACIAL_TYRANT_HP);
		expect(tyrant.maxHp).toBe(BASE_GLACIAL_TYRANT_HP);
		expect(tyrant.attackDamage).toBe(DEF.attackDamage);
		expect(tyrant.attackRange).toBe(DEF.attackRange);
		expect(tyrant.attackStyle).toBe('ice_ball');
		expect(tyrant.iceBallSpeed).toBe(DEF.iceBallSpeed);
		expect(tyrant.iceBallSlowDurationMs).toBe(DEF.iceBallSlowDurationMs);
		expect(tyrant.iceBallSlowFactor).toBe(DEF.iceBallSlowFactor);
		expect(tyrant.iceBallRadius).toBe(DEF.iceBallRadius);
		expect(tyrant.iceBallMaxRange).toBe(DEF.iceBallMaxRange);
		expect(tyrant).not.toHaveProperty('name');
	});

	it('has boss-tier card and magic stone drops matching the arena_champion tier', () => {
		expect(getEnemyCardDrop({ type: 'glacial_tyrant' })).toBe('dungeon_drake');
		expect(getEnemyMagicStoneDrop({ type: 'glacial_tyrant' })).toBe(70);
		expect(getEnemyMagicStoneDrop({ type: 'glacial_tyrant' })).toBe(
			getEnemyMagicStoneDrop({ type: 'arena_champion' }),
		);
	});
});

describe('glacial_tyrant HP scaling with party size at spawn', () => {
	beforeEach(() => {
		resetState();
	});

	it('1–4 players spawn a baseline-HP glacial_tyrant', () => {
		for (const count of [1, 2, 3, 4]) {
			gameState.enemies.length = 0;
			setPartySize(count);
			const tyrant = spawnEnemy(0, 0, 'glacial_tyrant');
			expect(tyrant.hp).toBe(BASE_GLACIAL_TYRANT_HP);
			expect(tyrant.maxHp).toBe(BASE_GLACIAL_TYRANT_HP);
		}
	});

	it('5..16 players spawn a glacial_tyrant with scaled hp/maxHp', () => {
		for (const count of [5, 8, 12, 16]) {
			gameState.enemies.length = 0;
			setPartySize(count);
			const expected = Math.round(
				BASE_GLACIAL_TYRANT_HP * difficultyScaleFactor(count, DIFFICULTY_MINIBOSS_HP_PER_PLAYER),
			);
			const tyrant = spawnEnemy(0, 0, 'glacial_tyrant');
			expect(tyrant.hp).toBeGreaterThan(BASE_GLACIAL_TYRANT_HP);
			expect(tyrant.hp).toBe(expected);
			expect(tyrant.maxHp).toBe(expected);
		}
	});

	it('HP is fixed at spawn when party size changes after spawn', () => {
		setPartySize(4);
		const tyrant = spawnEnemy(0, 0, 'glacial_tyrant');
		expect(tyrant.hp).toBe(BASE_GLACIAL_TYRANT_HP);

		setPartySize(16);
		expect(tyrant.hp).toBe(BASE_GLACIAL_TYRANT_HP);
		expect(tyrant.maxHp).toBe(BASE_GLACIAL_TYRANT_HP);
	});
});

// ── Attack path: a spawned tyrant launches an ice ball with its own tuning ──

// A single large open room so the launched ice ball stays "inside the dungeon".
function buildOpenLayout() {
	return {
		rooms: [{ x: 0, z: 0, width: 60, depth: 60, role: 'start', walls: [] }],
		passages: [],
	};
}

describe('glacial_tyrant ice-ball launch', () => {
	const NOW = 2_000_000;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		resetGameState();
		const layout = buildOpenLayout();
		gameState.layout = layout;
		gameState.walkableAABBs = computeWalkableAABBs(layout);
		gameState.dungeonBounds = computeDungeonBounds(layout);
		gameState.run = { status: 'playing' };
		gameState.enemies = [];
		gameState.iceBalls = [];
		gameState.players = {};
		setProgressionGameState(gameState);
		setSimulationGameState(gameState);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('wind-up completion launches an ice ball carrying the tyrant def tuning', () => {
		const tyrant = spawnEnemy(0, 0, 'glacial_tyrant');
		gameState.players.p1 = { id: 'p1', x: 5, z: 0, hp: 100, dead: false };

		// First tick: acquire the player and enter wind-up (no instant strike).
		updateEnemies();
		expect(tyrant.attackState).toBe('windup');
		expect(gameState.iceBalls).toHaveLength(0);

		// Advance past the wind-up: the projectile is launched with the tyrant's
		// own speed/radius/slow tuning (not glacial_thrower defaults).
		vi.setSystemTime(Date.now() + DEF.attackWindupMs + 50);
		updateEnemies();

		expect(gameState.iceBalls).toHaveLength(1);
		expect(tyrant.attackState).toBe('recovering');
		const ball = gameState.iceBalls[0];
		expect(ball.ownerId).toBe(tyrant.id);
		expect(ball.speed).toBe(DEF.iceBallSpeed);
		expect(ball.radius).toBe(DEF.iceBallRadius);
		expect(ball.slowDurationMs).toBe(DEF.iceBallSlowDurationMs);
		expect(ball.slowFactor).toBe(DEF.iceBallSlowFactor);
		expect(ball.maxRange).toBe(DEF.iceBallMaxRange);
		expect(ball.damage).toBe(DEF.attackDamage);
		// Aimed toward the player (locked +x direction).
		expect(ball.dirX).toBeCloseTo(1, 5);
		expect(ball.dirZ).toBeCloseTo(0, 5);
	});
});
