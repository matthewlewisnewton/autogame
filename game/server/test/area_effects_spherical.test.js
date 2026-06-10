import { describe, it, expect, beforeEach } from 'vitest';
import {
	gameState,
	updateAreaEffects,
	spawnInfernoPillarEffect,
	spawnDragonsBreathEffect,
	spawnFireTrailEffect,
	spawnVolatileExplosion,
	collectConeHits,
	PROJECTILE_HIT_WIDTH,
} from '../index.js';

// With no layout in gameState, the floor fallback resolves to DEFAULT_FLOOR_Y.
const FLOOR_Y = 0.5;

function resetState() {
	gameState.players = {};
	gameState.enemies = [];
	gameState.minions = [];
	gameState.loot = [];
	gameState.areaEffects = [];
	gameState.enchantments = [];
	gameState.layout = null;
	gameState.gamePhase = 'playing';
	gameState._pendingVolatileExplosions = [];
	// No run objective so recordEnemyDefeated is a no-op in this harness.
	gameState.run = null;
}

function addEnemy(id, overrides = {}) {
	const enemy = { id, type: 'grunt', x: 0, z: 0, hp: 40, ...overrides };
	gameState.enemies.push(enemy);
	return enemy;
}

// Spawners stamp lastTickAt = now; rewind it so the next updateAreaEffects
// call resolves a damage tick immediately.
function forceTickDue(effect) {
	effect.lastTickAt = Date.now() - (effect.intervalMs + 1000);
}

describe('area-effect spawners record vertical origin', () => {
	beforeEach(resetState);

	it('inferno_pillar stores the caster Y passed by the cast', () => {
		spawnInfernoPillarEffect(2, 3, { attackRange: 6, damage: 10 }, 'p1', 4.5);
		expect(gameState.areaEffects[0].originY).toBe(4.5);
	});

	it('dragons_breath and fire_trail store originY and dirY from the cast aim', () => {
		spawnDragonsBreathEffect(0, 0, 1, 0, { attackRange: 7, damage: 8 }, 'p1', {
			originY: 2,
			dirY: 0.5,
		});
		spawnFireTrailEffect(0, 0, 1, 0, { attackRange: 5, damage: 4 }, 'p1', {
			originY: 1.5,
			dirY: -0.25,
		});
		const [breath, trail] = gameState.areaEffects;
		expect(breath.originY).toBe(2);
		expect(breath.dirY).toBe(0.5);
		expect(trail.originY).toBe(1.5);
		expect(trail.dirY).toBe(-0.25);
	});

	it('volatile_explosion stores the floor Y at the blast point', () => {
		spawnVolatileExplosion(3, -4, { radius: 5, damage: 10 });
		expect(gameState.areaEffects[0].originY).toBe(FLOOR_Y);
	});

	it('a spawn without vertical info falls back to the floor — never to 2D', () => {
		spawnInfernoPillarEffect(0, 0, { attackRange: 6, damage: 10 }, 'p1');
		expect(gameState.areaEffects[0].originY).toBe(FLOOR_Y);
	});
});

describe('inferno_pillar ticks — spherical inclusion', () => {
	beforeEach(resetState);

	it('damages an elevated enemy inside the sphere, excludes one XZ-inside but 3D-outside', () => {
		const lifted = addEnemy('lifted', { x: 3, z: 0, y: FLOOR_Y + 4 });
		const high = addEnemy('high', { x: 0, z: 0, y: FLOOR_Y + 7 });
		spawnInfernoPillarEffect(0, 0, { attackRange: 6, damage: 10, dotTicks: 3 }, 'p1', FLOOR_Y);
		forceTickDue(gameState.areaEffects[0]);

		updateAreaEffects();

		// lifted: 3D distance 5 ≤ 6. high: XZ distance 0 but 3D distance 7 > 6.
		expect(lifted.hp).toBe(30);
		expect(high.hp).toBe(40);
	});
});

describe('volatile_explosion — spherical inclusion for players and minions', () => {
	beforeEach(resetState);

	const def = { radius: 6, damage: 20 };

	it('damages an elevated player and minion inside the sphere', () => {
		gameState.players.lifted = { x: 3, z: 0, y: FLOOR_Y + 4, hp: 100, dead: false };
		gameState.minions.push({
			id: 'm1', x: 0, z: 3, y: FLOOR_Y + 4, hp: 50, maxHp: 50, ttl: 10, maxTtl: 10,
		});
		spawnVolatileExplosion(0, 0, def);

		updateAreaEffects();

		expect(gameState.players.lifted.hp).toBe(80);
		expect(gameState.minions[0].hp).toBe(30);
	});

	it('excludes a player and minion that are XZ-inside but 3D-outside', () => {
		gameState.players.high = { x: 0, z: 0, y: FLOOR_Y + 7, hp: 100, dead: false };
		gameState.minions.push({
			id: 'm1', x: 1, z: 0, y: FLOOR_Y + 7, hp: 50, maxHp: 50, ttl: 10, maxTtl: 10,
		});
		spawnVolatileExplosion(0, 0, def);

		updateAreaEffects();

		expect(gameState.players.high.hp).toBe(100);
		expect(gameState.minions[0].hp).toBe(50);
	});
});

describe('dragons_breath DoT ticks — 3D range', () => {
	beforeEach(resetState);

	const cardDef = { attackRange: 7, attackConeAngle: Math.PI / 3, damage: 8, dotTicks: 4 };

	it('hits a slightly elevated in-cone enemy but respects the 3D range', () => {
		const inCone = addEnemy('inCone', { x: 5, z: 0, y: FLOOR_Y + 2 });
		const tooHigh = addEnemy('tooHigh', { x: 2, z: 0, y: FLOOR_Y + 7 });
		spawnDragonsBreathEffect(0, 0, 1, 0, cardDef, 'p1', { originY: FLOOR_Y, dirY: 0 });
		forceTickDue(gameState.areaEffects[0]);

		updateAreaEffects();

		// inCone: 3D distance √29 ≈ 5.39 ≤ 7, in the cone. tooHigh: XZ distance
		// 2 but 3D distance √53 ≈ 7.28 > 7.
		expect(inCone.hp).toBe(32);
		expect(tooHigh.hp).toBe(40);
	});
});

describe('collectConeHits — flat aim resolves in 3D', () => {
	beforeEach(resetState);

	const range = 7;
	const coneAngle = Math.PI / 3;

	it('hits a slightly elevated in-cone enemy (old |dy| hard gate removed)', () => {
		const dy = 2;
		// The old 2D path skipped any target with |dy| > PROJECTILE_HIT_WIDTH.
		expect(dy).toBeGreaterThan(PROJECTILE_HIT_WIDTH);
		const enemy = addEnemy('lifted', { x: 5, z: 0, y: FLOOR_Y + dy });

		const result = collectConeHits(0, 0, 1, 0, range, coneAngle, 10, { originY: FLOOR_Y });

		expect(result.hits.map((h) => h.enemyId)).toEqual(['lifted']);
		expect(enemy.hp).toBe(30);
	});

	it('excludes an enemy whose dy alone pushes it beyond the 3D range', () => {
		const enemy = addEnemy('high', { x: 1, z: 0, y: FLOOR_Y + range + 1 });

		const result = collectConeHits(0, 0, 1, 0, range, coneAngle, 10, { originY: FLOOR_Y });

		expect(result.hits).toHaveLength(0);
		expect(enemy.hp).toBe(40);
	});

	it('excludes an enemy directly overhead of a flat cone via the angle check', () => {
		const enemy = addEnemy('overhead', { x: 0, z: 0, y: FLOOR_Y + 3 });

		const result = collectConeHits(0, 0, 1, 0, range, coneAngle, 10, { originY: FLOOR_Y });

		expect(result.hits).toHaveLength(0);
		expect(enemy.hp).toBe(40);
	});
});
