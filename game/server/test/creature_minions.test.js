import { describe, it, expect, beforeEach } from 'vitest';
import {
	resetGameState,
	gameState,
	CARD_DEFS,
	updateMinions,
} from '../index.js';
import { ATTACK_CONE_ANGLE, ATTACK_RANGE } from '../config.js';

function resetState() {
	resetGameState();
	gameState.gamePhase = 'playing';
	gameState.players.p1 = {
		id: 'p1',
		x: 0,
		z: -5,
		hp: 100,
		dead: false,
		lastActivity: Date.now(),
	};
	gameState.run = { status: 'playing' };
}

function makeStalker(overrides = {}) {
	return {
		id: 'stalker-1',
		ownerId: 'p1',
		type: 'null_crawler',
		x: 0,
		z: 0,
		hp: 55,
		ttl: 30,
		attackRange: 14,
		attackDamage: 22,
		attackIntervalMs: 2000,
		attackWindupMs: 1000,
		projectileHitWidth: 0.8,
		lastAttackAt: 0,
		...overrides,
	};
}

function fireStalkerBeam() {
	const minion = gameState.minions[0];
	minion.windupStartTime = Date.now() - (minion.attackWindupMs || 1000) - 50;
	updateMinions();
}

describe('Phase Stalker (null_crawler)', () => {
	beforeEach(resetState);

	it('defines long-range beam attack parameters', () => {
		expect(CARD_DEFS.null_crawler).toMatchObject({
			id: 'null_crawler',
			type: 'creature',
			attackRange: 14,
			attackDamage: 22,
			attackIntervalMs: 2000,
			attackWindupMs: 1000,
			projectileHitWidth: 0.8,
			specialEffect: 'phase_beam',
		});
	});

	it('enters windup before firing the beam', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 7,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 7, z: 0 },
		});
		gameState.minions.push(makeStalker());

		updateMinions();

		expect(gameState.minions[0].attackState).toBe('windup');
		expect(gameState.minions[0].windupDirX).toBeCloseTo(1, 5);
		expect(gameState.enemies[0].hp).toBe(50);
		expect(gameState._pendingMinionBreaths).toHaveLength(0);
	});

	it('fires a narrow beam at range after the windup completes', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 7,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 7, z: 0 },
		});
		gameState.minions.push(makeStalker());

		const distBefore = Math.hypot(
			gameState.enemies[0].x - gameState.minions[0].x,
			gameState.enemies[0].z - gameState.minions[0].z,
		);
		updateMinions();
		fireStalkerBeam();

		expect(gameState.enemies[0].hp).toBe(28);
		expect(distBefore).toBeGreaterThan(ATTACK_RANGE);
		const distAfter = Math.hypot(
			gameState.enemies[0].x - gameState.minions[0].x,
			gameState.enemies[0].z - gameState.minions[0].z,
		);
		expect(distAfter).toBeGreaterThanOrEqual(distBefore - 0.5);
		expect(gameState.minions[0].attackState).toBe('idle');
		expect(gameState._pendingMinionBreaths).toHaveLength(1);
		expect(gameState._pendingMinionBreaths[0]).toMatchObject({
			cardId: 'null_crawler',
			specialEffect: 'phase_beam',
			attackRange: 14,
			hitWidth: 0.8,
			hits: [{ enemyId: 'e1', hp: 28 }],
		});
	});

	it('damages allies and players caught in the beam path', () => {
		gameState.players.p1.x = 5;
		gameState.players.p1.z = 0;
		gameState.enemies.push({
			id: 'e1',
			x: 7,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 7, z: 0 },
		});
		gameState.minions.push(makeStalker());
		gameState.minions.push({
			id: 'ally-1',
			ownerId: 'p1',
			type: 'mana_prism',
			x: 3,
			z: 0,
			hp: 40,
			maxHp: 40,
			ttl: 30,
			maxTtl: 30,
		});

		updateMinions();
		fireStalkerBeam();

		expect(gameState.enemies[0].hp).toBe(28);
		expect(gameState.minions[1].hp).toBeLessThan(40);
		expect(gameState.players.p1.hp).toBeLessThan(100);
		expect(gameState._pendingMinionBreaths[0].hits).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ enemyId: 'e1' }),
				expect.objectContaining({ minionId: 'ally-1' }),
				expect.objectContaining({ playerId: 'p1' }),
			]),
		);
	});

	it('respects the beam cooldown between shots', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 7,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 7, z: 0 },
		});
		gameState.minions.push(makeStalker({
			lastAttackAt: Date.now() - 500,
		}));

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(50);
		expect(gameState.minions[0].attackState).toBeUndefined();
		expect(gameState._pendingMinionBreaths).toHaveLength(0);
	});
});

describe('Bulkhead Mauler (bulkhead_mauler)', () => {
	beforeEach(resetState);

	it('defines short wide shockwave parameters', () => {
		expect(CARD_DEFS.bulkhead_mauler).toMatchObject({
			id: 'bulkhead_mauler',
			type: 'creature',
			attackRange: 4,
			attackDamage: 9,
			specialEffect: 'shockwave_sweep',
		});
		expect(CARD_DEFS.bulkhead_mauler.attackConeAngle).toBeCloseTo((Math.PI * 2) / 3);
	});

	it('deals damage in a wide short-range cone', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 3,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 3, z: 0 },
		});
		gameState.minions.push({
			id: 'mauler-1',
			ownerId: 'p1',
			type: 'bulkhead_mauler',
			x: 0,
			z: 0,
			hp: 100,
			ttl: 30,
			attackRange: 4,
			attackConeAngle: (Math.PI * 2) / 3,
			attackDamage: 9,
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(41);
		expect(gameState._pendingMinionBreaths).toHaveLength(1);
		expect(gameState._pendingMinionBreaths[0]).toMatchObject({
			cardId: 'bulkhead_mauler',
			specialEffect: 'shockwave_sweep',
			attackRange: 4,
			attackConeAngle: (Math.PI * 2) / 3,
			hits: [{ enemyId: 'e1', hp: 41 }],
		});
	});

	it('does not hit enemies outside its shorter reach', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 6,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 6, z: 0 },
		});
		gameState.minions.push({
			id: 'mauler-1',
			ownerId: 'p1',
			type: 'bulkhead_mauler',
			x: 0,
			z: 0,
			hp: 100,
			ttl: 30,
			attackRange: 4,
			attackConeAngle: ATTACK_CONE_ANGLE,
			attackDamage: 9,
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(50);
		expect(gameState._pendingMinionBreaths).toHaveLength(0);
	});
});
