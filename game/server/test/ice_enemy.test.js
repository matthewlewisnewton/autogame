import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	updateEnemies,
	updateEnemyProjectiles,
	spawnIceBall,
	spawnCombatEnemies,
	isSlowed,
	resetTransientRunState,
	buildWorldSnapshot,
	ENEMY_DEFS,
} from '../index.js';
// Pure layout helpers (no shared module state) — safe to import directly.
import {
	computeWalkableAABBs,
	computeDungeonBounds,
} from '../simulation.js';
// Pure quest data/accessors (no shared module state) — safe to import directly.
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import {
	setGameState,
	spawnEnemies,
	startDungeonRun,
	updateScriptedEncounters,
	removeDeadEnemies,
} from '../progression.js';
import { setGameState as setSimulationGameState } from '../simulation.js';
import {
	getQuest,
	getGuaranteedEnemyType,
	getLayoutProfileForQuest,
	getLayoutGenerationOptions,
} from '../quests.js';

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

// ── run-exit cleanup clears in-flight ice balls ──

describe('run-exit cleanup clears in-flight ice balls', () => {
	beforeEach(() => {
		resetGameState();
	});

	it('resetTransientRunState() empties iceBalls, so the world snapshot has none', () => {
		// Seed a live projectile (mirrors what spawnIceBall leaves behind mid-run).
		gameState.iceBalls.push({
			id: 'ice-1',
			ownerId: 'thrower',
			x: 5,
			z: 0,
			dirX: 1,
			dirZ: 0,
			traveled: 2,
		});
		expect(gameState.iceBalls).toHaveLength(1);
		// Pre-cleanup the snapshot still carries the stale projectile.
		expect(buildWorldSnapshot().iceBalls).toHaveLength(1);

		// Run-exit cleanup path (shared by suspend/return-to-lobby/give-up).
		resetTransientRunState();

		expect(gameState.iceBalls).toEqual([]);
		// No stale projectiles leak into the broadcast snapshot.
		expect(buildWorldSnapshot().iceBalls).toEqual([]);
	});
});

// Deterministic seeded RNG mirroring the server's mulberry32 so the spawn tests
// can replay the same seed independently of the live run state.
function makeRng(seed) {
	let a = seed >>> 0;
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// A layout with a dedicated combat room so spawnCombatEnemies places enemies via
// the standard combat-room sampler (avoids open-floor / canyon / spire paths).
function buildCombatLayout() {
	return {
		rooms: [
			{ x: 0, z: 0, width: 20, depth: 20, role: 'start', walls: [] },
			{ x: 60, z: 0, width: 40, depth: 40, role: 'combat', walls: [], encounterTier: 0 },
		],
		passages: [],
	};
}

// Drive the real spawn path for a quest at a given seed and return the spawned
// enemy types in order.
function spawnTypesForQuest(questId, seed) {
	resetGameState();
	gameState.enemies = [];
	gameState.run = { status: 'playing', questId, questTier: 1 };
	const quest = getQuest(questId, 1);
	spawnCombatEnemies(buildCombatLayout(), makeRng(seed), quest);
	return gameState.enemies.map((e) => e.type);
}

function deployScriptedFrostCrossing() {
	const questId = 'frost_crossing';
	const tier = 1;
	const seed = questLayoutSeed(questId, tier);
	const layout = generateLayout(
		seed,
		getLayoutProfileForQuest(questId, tier),
		getLayoutGenerationOptions(questId, tier),
	);
	const startRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];
	const iceRoom = layout.rooms.find((room) => room.band === 'ice');

	resetGameState();
	gameState.selectedQuestId = questId;
	gameState.selectedQuestTier = tier;
	gameState.layout = layout;
	gameState.layoutSeed = seed;
	gameState.enemies = [];
	gameState.loot = [];
	gameState.gamePhase = 'playing';
	gameState.players = {
		p1: {
			x: startRoom.x,
			y: 0.5,
			z: startRoom.z,
			rotation: 0,
			hp: 100,
			dead: false,
			extracted: false,
		},
	};
	setGameState(gameState);
	setSimulationGameState(gameState);
	spawnEnemies();
	startDungeonRun();
	return { iceRoom };
}

describe('Frost Crossing guaranteed glacial_thrower spawn', () => {
	const SEEDS = [1, 7, 42, 123, 2026, 99999];

	it('declares glacial_thrower as the frost_crossing signature foe', () => {
		expect(getGuaranteedEnemyType('frost_crossing')).toBe('glacial_thrower');
	});

	it('scripts Rimecast the Slow as a glacial_thrower on the final ice-band wave', () => {
		const { iceRoom } = deployScriptedFrostCrossing();
		expect(gameState.enemies.map((enemy) => enemy.type)).not.toContain('glacial_thrower');
		expect(gameState.enemies).toHaveLength(2);

		for (const enemy of [...gameState.enemies]) {
			if (enemy.scriptedWave?.roomKey === 'room:0' && enemy.scriptedWave?.waveIndex === 0) {
				enemy.hp = 0;
			}
		}
		removeDeadEnemies();

		gameState.players.p1.x = iceRoom.x;
		gameState.players.p1.z = iceRoom.z;
		updateScriptedEncounters();

		const throwers = gameState.enemies.filter((enemy) => enemy.type === 'glacial_thrower');
		expect(throwers.length).toBeGreaterThanOrEqual(2);
		expect(gameState.enemies.some((enemy) => enemy.displayName === 'Rimecast the Slow')).toBe(false);

		for (const enemy of [...gameState.enemies]) {
			if (enemy.scriptedWave?.roomKey === 'band:ice' && enemy.scriptedWave?.waveIndex === 0) {
				enemy.hp = 0;
			}
		}
		removeDeadEnemies();
		updateScriptedEncounters();

		expect(gameState.enemies.some((enemy) => enemy.displayName === 'Rimecast the Slow')).toBe(true);
	});

	it('scripts only the dock wave at deploy', () => {
		deployScriptedFrostCrossing();
		const types = gameState.enemies.map((enemy) => enemy.type);
		expect(types).toHaveLength(2);
		expect(types.every((type) => type === 'grunt')).toBe(true);
	});

	it('authored ice-band scripted waves include ranged glacial_thrower offsets', () => {
		const quest = getQuest('frost_crossing', 1);
		const iceRoom = quest.scriptedEncounters.rooms.find((room) => room.band === 'ice');
		const throwerSpawns = iceRoom.waves[0].spawns.filter((spawn) => spawn.type === 'glacial_thrower');
		expect(throwerSpawns.length).toBeGreaterThanOrEqual(2);
		expect(throwerSpawns.every((spawn) => spawn.offset)).toBe(true);
		expect(iceRoom.waves.some((wave) => wave.spawns.some((spawn) => spawn.namedRare))).toBe(true);
	});

	it('keeps glacial_thrower out of the stone dock scripted wave', () => {
		const quest = getQuest('frost_crossing', 1);
		const entryRoom = quest.scriptedEncounters.rooms.find((room) => room.roomIndex === 0);
		const types = entryRoom.waves.flatMap((wave) => wave.spawns.map((spawn) => spawn.type));
		expect(types).toContain('grunt');
		expect(types).not.toContain('glacial_thrower');
	});

	it('keeps glacial_thrower out of bulk spawns because scripted waves replace enemyCount', () => {
		for (const seed of SEEDS) {
			const types = spawnTypesForQuest('frost_crossing', seed);
			expect(types.length).toBe(0);
		}
	});

	it('does not force the signature foe onto non-ice quests', () => {
		// A quest with no declared guaranteed type is unaffected.
		expect(getGuaranteedEnemyType('training_caverns')).toBeNull();
		expect(getGuaranteedEnemyType('ember_descent')).toBeNull();
		for (const seed of SEEDS) {
			const types = spawnTypesForQuest('training_caverns', seed);
			expect(types).not.toContain('glacial_thrower');
		}
	});
});
