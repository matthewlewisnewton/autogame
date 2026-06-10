import { describe, it, expect, beforeEach } from 'vitest';
import {
	resetGameState,
	gameState,
	CARD_DEFS,
	updateMinions,
	scaledGrindStat,
	CARD_GRIND_STAT_SCALE,
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

function makeStalker(overrides = {}, grind = 0) {
	const baseAttackDamage = CARD_DEFS.null_crawler.attackDamage;
	const baseMinionHp = CARD_DEFS.null_crawler.minionHp;
	return {
		id: 'stalker-1',
		ownerId: 'p1',
		type: 'null_crawler',
		x: 0,
		z: 0,
		hp: scaledGrindStat(baseMinionHp, grind, 'null_crawler'),
		ttl: scaledGrindStat(CARD_DEFS.null_crawler.minionTtl, grind, 'null_crawler'),
		attackRange: 14,
		attackDamage: scaledGrindStat(baseAttackDamage, grind, 'null_crawler'),
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

	it('uses a conservative per-card grind scale below the global curve', () => {
		expect(CARD_GRIND_STAT_SCALE.null_crawler).toBeLessThan(0.05);
		expect(CARD_GRIND_STAT_SCALE.null_crawler).toBe(CARD_GRIND_STAT_SCALE.battle_familiar);
	});

	it('keeps base spawn stats at grind 0', () => {
		const stalker = makeStalker({}, 0);
		expect(stalker.attackDamage).toBe(22);
		expect(stalker.hp).toBe(55);
	});

	it('scales spawn stats below the global grind curve at grind 5+', () => {
		const grind = 5;
		const baseAttackDamage = CARD_DEFS.null_crawler.attackDamage;
		const baseMinionHp = CARD_DEFS.null_crawler.minionHp;
		const stalker = makeStalker({}, grind);

		expect(stalker.attackDamage).toBe(scaledGrindStat(baseAttackDamage, grind, 'null_crawler'));
		expect(stalker.hp).toBe(scaledGrindStat(baseMinionHp, grind, 'null_crawler'));
		expect(stalker.attackDamage).toBeLessThan(scaledGrindStat(baseAttackDamage, grind));
		expect(stalker.hp).toBeLessThan(scaledGrindStat(baseMinionHp, grind));
		expect(stalker.attackDamage).toBe(Math.round(baseAttackDamage * 1.15));
		expect(stalker.hp).toBe(Math.round(baseMinionHp * 1.15));
	});

	it('applies scaled attackDamage to beam hits at high grind', () => {
		const grind = 5;
		const scaledDamage = scaledGrindStat(CARD_DEFS.null_crawler.attackDamage, grind, 'null_crawler');
		gameState.enemies.push({
			id: 'e1',
			x: 7,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 7, z: 0 },
		});
		gameState.minions.push(makeStalker({}, grind));

		updateMinions();
		fireStalkerBeam();

		expect(scaledDamage).toBeLessThan(CARD_DEFS.null_crawler.attackDamage * 1.25);
		expect(gameState.enemies[0].hp).toBe(50 - scaledDamage);
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

	it('attacks at most once per attackIntervalMs window', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 3,
			z: 0,
			hp: 200,
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
			attackIntervalMs: 1500,
		});

		updateMinions();
		expect(gameState._pendingMinionBreaths).toHaveLength(1);
		expect(gameState.enemies[0].hp).toBe(191);

		// Second tick within the interval should not produce another attack
		updateMinions();
		expect(gameState._pendingMinionBreaths).toHaveLength(1);
		expect(gameState.enemies[0].hp).toBe(191);
	});
});

describe('Astral Guardian (astral_guardian)', () => {
	beforeEach(resetState);

	it('defines 1500ms attack interval in card definition', () => {
		expect(CARD_DEFS.astral_guardian.attackIntervalMs).toBe(1500);
	});

	it('attacks at most once per attackIntervalMs window', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 2,
			z: 0,
			hp: 200,
			state: 'idle',
			wanderTarget: { x: 2, z: 0 },
		});
		gameState.minions.push({
			id: 'guardian-1',
			ownerId: 'p1',
			type: 'astral_guardian',
			x: 0,
			z: 0,
			hp: 60,
			ttl: 30,
			attackDamage: 11,
			lastAttackAt: 0,
		});

		updateMinions();
		expect(gameState.enemies[0].hp).toBe(189);

		// Second tick within the interval should not produce another attack
		updateMinions();
		expect(gameState.enemies[0].hp).toBe(189);
	});

	it('uses default 1500ms interval when attackIntervalMs is missing from minion', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 2,
			z: 0,
			hp: 200,
			state: 'idle',
			wanderTarget: { x: 2, z: 0 },
		});
		gameState.minions.push({
			id: 'guardian-2',
			ownerId: 'p1',
			type: 'aegis_sentinel',
			x: 0,
			z: 0,
			hp: 160,
			ttl: 30,
			attackDamage: 0,
			lastAttackAt: 0,
		});

		updateMinions();
		// aegis_sentinel has attackDamage 0, so hp should not change
		expect(gameState.enemies[0].hp).toBe(200);

		// Second tick should also not attack (interval gate)
		updateMinions();
		expect(gameState.enemies[0].hp).toBe(200);
	});
});
