import { describe, it, expect, beforeEach } from 'vitest';
import {
	createGameState,
	gameState,
	collectRadialHits,
	healPlayersInRadius,
	applyFreezeInRadius,
	distance3D,
	getEntityWorldY,
} from '../index.js';
import { setGameState } from '../simulation.js';

const ORIGIN = { x: 0, z: 0 };
const ORIGIN_Y = 0;
const RADIUS = 5;
const OPTIONS = { originY: ORIGIN_Y };

function resetState() {
	Object.assign(gameState, createGameState());
	setGameState(gameState, {});
}

function addEnemy(id, x, z, hp = 100, y = undefined) {
	const enemy = { id, type: 'grunt', x, z, hp, maxHp: hp };
	if (y !== undefined) enemy.y = y;
	gameState.enemies.push(enemy);
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		hp: 50,
		dead: false,
		extracted: false,
		magicStones: 100,
		hand: [],
		deck: [],
		pendingSummons: new Set(),
		slotCooldowns: [null, null, null, null],
		debuffs: [],
		...overrides,
	};
}

describe('distance3D', () => {
	beforeEach(resetState);

	it('uses getEntityWorldY for targets without an explicit y', () => {
		addEnemy('floor', 3, 0);
		const entityY = getEntityWorldY(gameState.enemies[0]);
		expect(distance3D(0, 0, 0, gameState.enemies[0])).toBeCloseTo(Math.hypot(3, entityY, 0));
	});

	it('uses the entity y when set', () => {
		const enemy = { x: 0, z: 0, y: 3 };
		expect(distance3D(0, 0, 0, enemy)).toBe(3);
	});
});

describe('collectRadialHits spherical inclusion', () => {
	beforeEach(resetState);

	it('hits a target at the same (x, z) within vertical range', () => {
		addEnemy('elevated', 0, 0, 100, 3);
		const result = collectRadialHits(ORIGIN.x, ORIGIN.z, RADIUS, 10, OPTIONS);
		expect(result.hits).toHaveLength(1);
		expect(result.hits[0].enemyId).toBe('elevated');
	});

	it('misses a target at the same (x, z) beyond vertical range', () => {
		addEnemy('too-high', 0, 0, 100, 6);
		const result = collectRadialHits(ORIGIN.x, ORIGIN.z, RADIUS, 10, OPTIONS);
		expect(result.hits).toHaveLength(0);
		expect(gameState.enemies[0].hp).toBe(100);
	});

	it('misses a target outside horizontal range at the same Y', () => {
		addEnemy('far', 6, 0, 100, ORIGIN_Y);
		const result = collectRadialHits(ORIGIN.x, ORIGIN.z, RADIUS, 10, OPTIONS);
		expect(result.hits).toHaveLength(0);
		expect(gameState.enemies[0].hp).toBe(100);
	});
});

describe('healPlayersInRadius spherical inclusion', () => {
	beforeEach(resetState);

	it('heals a player at the same (x, z) within vertical range', () => {
		addPlayer('ally', { x: 0, z: 0, y: 3, hp: 40 });
		const healed = healPlayersInRadius(ORIGIN.x, ORIGIN.z, RADIUS, 20, OPTIONS);
		expect(healed).toEqual([{ playerId: 'ally', hpGained: 20, cleansed: true }]);
		expect(gameState.players.ally.hp).toBe(60);
	});

	it('skips a player at the same (x, z) beyond vertical range', () => {
		addPlayer('too-high', { x: 0, z: 0, y: 6, hp: 40 });
		const healed = healPlayersInRadius(ORIGIN.x, ORIGIN.z, RADIUS, 20, OPTIONS);
		expect(healed).toEqual([]);
		expect(gameState.players['too-high'].hp).toBe(40);
	});

	it('skips a player outside horizontal range at the same Y', () => {
		addPlayer('far', { x: 6, z: 0, y: ORIGIN_Y, hp: 40 });
		const healed = healPlayersInRadius(ORIGIN.x, ORIGIN.z, RADIUS, 20, OPTIONS);
		expect(healed).toEqual([]);
		expect(gameState.players.far.hp).toBe(40);
	});
});

describe('applyFreezeInRadius spherical inclusion', () => {
	beforeEach(resetState);

	it('freezes a target at the same (x, z) within vertical range', () => {
		addEnemy('elevated', 0, 0, 100, 3);
		const hits = applyFreezeInRadius(
			ORIGIN.x,
			ORIGIN.z,
			RADIUS,
			2000,
			0,
			0,
			OPTIONS,
		);
		expect(hits).toHaveLength(0);
		expect(gameState.enemies[0].frozenUntil).toBeGreaterThan(Date.now());
	});

	it('skips a target at the same (x, z) beyond vertical range', () => {
		addEnemy('too-high', 0, 0, 100, 6);
		const hits = applyFreezeInRadius(
			ORIGIN.x,
			ORIGIN.z,
			RADIUS,
			2000,
			0,
			0,
			OPTIONS,
		);
		expect(hits).toHaveLength(0);
		expect(gameState.enemies[0].frozenUntil).toBeUndefined();
	});

	it('skips a target outside horizontal range at the same Y', () => {
		addEnemy('far', 6, 0, 100, ORIGIN_Y);
		const hits = applyFreezeInRadius(
			ORIGIN.x,
			ORIGIN.z,
			RADIUS,
			2000,
			0,
			0,
			OPTIONS,
		);
		expect(hits).toHaveLength(0);
		expect(gameState.enemies[0].frozenUntil).toBeUndefined();
	});
});
