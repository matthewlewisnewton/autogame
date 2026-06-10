import { describe, it, expect, beforeEach } from 'vitest';
import {
	createGameState,
	gameState,
	CARD_DEFS,
	collectRadialHits,
	healPlayersInRadius,
	applyFreezeInRadius,
	pullEnemiesToward,
	applyEventHorizon,
	damagePlayer,
	armSelfEnchantment,
	spawnGroundEnchantment,
	updateEnchantments,
	updateAreaEffects,
	spawnVolatileExplosion,
	distance3D,
	getEntityWorldY,
} from '../index.js';
import { setGameState, isEntityInEnemyAttack } from '../simulation.js';
import { VARIANT_DEFS } from '../enemyVariants.js';

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

describe('pullEnemiesToward spherical inclusion', () => {
	beforeEach(resetState);

	it('includes a target at the same (x, z) within vertical range', () => {
		addEnemy('elevated', 3, 0, 100, 3);
		const moved = pullEnemiesToward(ORIGIN.x, ORIGIN.z, RADIUS, 2, OPTIONS);
		expect(moved).toHaveLength(1);
		expect(moved[0].enemyId).toBe('elevated');
	});

	it('skips a target at the same (x, z) beyond vertical range', () => {
		addEnemy('too-high', 4, 0, 100, 6);
		const before = gameState.enemies[0].x;
		const moved = pullEnemiesToward(ORIGIN.x, ORIGIN.z, RADIUS, 2, OPTIONS);
		expect(moved).toHaveLength(0);
		expect(gameState.enemies[0].x).toBe(before);
	});
});

describe('applyEventHorizon spherical inclusion', () => {
	beforeEach(resetState);

	it('crushes a target at the same (x, z) within vertical range', () => {
		addEnemy('elevated', 0, 0, 100, 2);
		const { crushed } = applyEventHorizon(ORIGIN.x, ORIGIN.z, CARD_DEFS.event_horizon, 'p1', OPTIONS);
		expect(crushed).toHaveLength(1);
		expect(crushed[0].enemyId).toBe('elevated');
	});

	it('skips crush for a target at the same (x, z) beyond vertical range', () => {
		addEnemy('too-high', 0, 0, 100, 6);
		const { crushed } = applyEventHorizon(ORIGIN.x, ORIGIN.z, CARD_DEFS.event_horizon, 'p1', OPTIONS);
		expect(crushed).toHaveLength(0);
		expect(gameState.enemies[0].hp).toBe(100);
	});
});

describe('isEntityInEnemyAttack spherical inclusion', () => {
	beforeEach(resetState);

	function radialEnemy(overrides = {}) {
		return {
			x: 0,
			z: 0,
			y: 0,
			attackStyle: 'radial',
			attackRange: 3.5,
			windupDirX: 1,
			windupDirZ: 0,
			...overrides,
		};
	}

	it('hits a radial target at the same (x, z) within vertical range', () => {
		const enemy = radialEnemy();
		const target = { x: 0, z: 0, y: 3 };
		expect(isEntityInEnemyAttack(enemy, target)).toBe(true);
	});

	it('misses a radial target at the same (x, z) beyond vertical range', () => {
		const enemy = radialEnemy();
		const target = { x: 0, z: 0, y: 5 };
		expect(isEntityInEnemyAttack(enemy, target)).toBe(false);
	});

	it('still applies cone-angle test on the horizontal windup direction', () => {
		const enemy = {
			x: 0,
			z: 0,
			y: 0,
			attackStyle: 'cone',
			attackRange: 5,
			attackConeAngle: Math.PI / 2,
			windupDirX: 1,
			windupDirZ: 0,
		};
		const inFront = { x: 3, z: 0, y: 0 };
		const behind = { x: -3, z: 0, y: 0 };
		expect(isEntityInEnemyAttack(enemy, inFront)).toBe(true);
		expect(isEntityInEnemyAttack(enemy, behind)).toBe(false);
	});
});

describe('volatile_explosion spherical inclusion', () => {
	beforeEach(resetState);

	it('damages a player at the same (x, z) within vertical range', () => {
		addPlayer('near', { x: 1, z: 0, y: 3, hp: 100 });
		spawnVolatileExplosion(0, 0, VARIANT_DEFS.volatile, OPTIONS);
		updateAreaEffects();
		expect(gameState.players.near.hp).toBe(100 - VARIANT_DEFS.volatile.damage);
	});

	it('spares a player at the same (x, z) beyond vertical range', () => {
		addPlayer('too-high', { x: 1, z: 0, y: 6, hp: 100 });
		spawnVolatileExplosion(0, 0, VARIANT_DEFS.volatile, OPTIONS);
		updateAreaEffects();
		expect(gameState.players['too-high'].hp).toBe(100);
	});
});

describe('inferno_pillar spherical inclusion', () => {
	beforeEach(resetState);

	it('ticks damage on a target at the same (x, z) within vertical range', () => {
		addEnemy('elevated', 0, 0, 100, 3);
		gameState.areaEffects.push({
			id: 'pillar-1',
			type: 'inferno_pillar',
			ownerId: 'p1',
			originX: 0,
			originZ: 0,
			originY: ORIGIN_Y,
			range: RADIUS,
			damagePerTick: 10,
			ticksRemaining: 1,
			intervalMs: 0,
			lastTickAt: Date.now(),
			expiresAt: Date.now() + 1000,
		});
		updateAreaEffects();
		expect(gameState.enemies[0].hp).toBe(90);
	});

	it('skips a target at the same (x, z) beyond vertical range', () => {
		addEnemy('too-high', 0, 0, 100, 6);
		gameState.areaEffects.push({
			id: 'pillar-2',
			type: 'inferno_pillar',
			ownerId: 'p1',
			originX: 0,
			originZ: 0,
			originY: ORIGIN_Y,
			range: RADIUS,
			damagePerTick: 10,
			ticksRemaining: 1,
			intervalMs: 0,
			lastTickAt: Date.now(),
			expiresAt: Date.now() + 1000,
		});
		updateAreaEffects();
		expect(gameState.enemies[0].hp).toBe(100);
	});
});

describe('enchantment trigger spherical inclusion', () => {
	beforeEach(resetState);

	it('spike_trap triggers on an enemy at the same (x, z) within vertical range', () => {
		addPlayer('p1');
		spawnGroundEnchantment(0, 0, CARD_DEFS.spike_trap, 'p1');
		gameState.enchantments[0].y = ORIGIN_Y;
		addEnemy('elevated', 0.5, 0, 50, 2);
		updateEnchantments();
		expect(gameState.enemies[0].hp).toBeLessThan(50);
		expect(gameState.enchantments).toHaveLength(0);
	});

	it('spike_trap ignores an enemy at the same (x, z) beyond vertical range', () => {
		addPlayer('p1');
		spawnGroundEnchantment(0, 0, CARD_DEFS.spike_trap, 'p1');
		gameState.enchantments[0].y = ORIGIN_Y;
		addEnemy('too-high', 0.5, 0, 50, 6);
		updateEnchantments();
		expect(gameState.enemies[0].hp).toBe(50);
		expect(gameState.enchantments).toHaveLength(1);
	});
});

describe('mirror_ward radial fallback spherical inclusion', () => {
	beforeEach(() => {
		resetState();
		gameState._pendingMirrorReflects = [];
	});

	it('reflects to a nearby enemy at the same (x, z) within vertical range', () => {
		addPlayer('p1', { x: 0, z: 0, y: 0, hp: 100 });
		addEnemy('elevated', 2, 0, 50, 3);
		armSelfEnchantment(gameState.players.p1, CARD_DEFS.mirror_ward);
		damagePlayer('p1', 20);
		expect(gameState.enemies[0].hp).toBeLessThan(50);
	});

	it('skips a nearby enemy at the same (x, z) beyond vertical range', () => {
		addPlayer('p1', { x: 0, z: 0, y: 0, hp: 100 });
		addEnemy('too-high', 2, 0, 50, 12);
		armSelfEnchantment(gameState.players.p1, CARD_DEFS.mirror_ward);
		damagePlayer('p1', 20);
		expect(gameState.enemies[0].hp).toBe(50);
	});
});
