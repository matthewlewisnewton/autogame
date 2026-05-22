import { describe, it, expect, beforeEach } from 'vitest';
import {
	CARD_DEFS,
	COOLDOWN_MS,
	SUMMON_RADIUS,
	ATTACK_RANGE,
	createGameState,
	gameState,
	addMagicStones,
	cleanupAfterDamage,
	updateEnemies,
	updateMinions,
	healPlayer,
	collectConeHits,
	collectRadialHits,
	collectReturningProjectileHits,
	applyFreezeInRadius,
	pullEnemiesToward,
	spawnDragonsBreathEffect,
	isEnemyFrozen,
} from '../index.js';

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
		magicStones: 100,
		hand: [],
		deck: [],
		pendingSummons: new Set(),
		slotCooldowns: [null, null, null, null],
		...overrides,
	};
}

describe('new card pack definitions', () => {
	const newCardIds = [
		'saber_of_light',
		'photon_slicer',
		'frost_nova',
		'healing_font',
		'skeleton_knight',
		'storm_eagle',
		'gravity_well',
		'echo_blade',
		'mana_leach',
		'dragons_breath',
	];

	it('defines all ten new cards with expected types', () => {
		expect(Object.keys(CARD_DEFS)).toHaveLength(24);
		for (const cardId of newCardIds) {
			expect(CARD_DEFS[cardId]).toBeDefined();
		}
		expect(CARD_DEFS.saber_of_light.type).toBe('weapon');
		expect(CARD_DEFS.photon_slicer.type).toBe('weapon');
		expect(CARD_DEFS.echo_blade.type).toBe('weapon');
		expect(CARD_DEFS.frost_nova.type).toBe('summon');
		expect(CARD_DEFS.healing_font.type).toBe('summon');
		expect(CARD_DEFS.gravity_well.type).toBe('summon');
		expect(CARD_DEFS.mana_leach.type).toBe('summon');
		expect(CARD_DEFS.dragons_breath.type).toBe('summon');
		expect(CARD_DEFS.skeleton_knight.type).toBe('monster');
		expect(CARD_DEFS.storm_eagle.type).toBe('monster');
	});
});

describe('new card combat helpers', () => {
	beforeEach(resetState);

	it('Saber of Light uses a faster cooldown than default weapons', () => {
		expect(CARD_DEFS.saber_of_light.cooldownMs).toBeLessThan(COOLDOWN_MS);
		expect(CARD_DEFS.saber_of_light.damage).toBeLessThan(CARD_DEFS.iron_sword.damage);
	});

	it('Photon Slicer returning projectile can hit on outbound and return passes', () => {
		addPlayer('p1');
		gameState.enemies = [
			{ id: 'near', type: 'grunt', x: 3, z: 0, hp: 30 },
			{ id: 'far', type: 'grunt', x: 6, z: 0, hp: 30 },
		];

		const result = collectReturningProjectileHits(0, 0, 1, 0, ATTACK_RANGE + 3, CARD_DEFS.photon_slicer.damage);
		expect(result.hits.some(h => h.enemyId === 'near')).toBe(true);
		expect(result.hits.some(h => h.enemyId === 'far')).toBe(true);
		expect(result.hits.some(h => h.pass === 2)).toBe(true);
	});

	it('Infinite Disk triple return passes hit enemies on each return split', () => {
		gameState.enemies = [{ id: 'mid', type: 'grunt', x: 4, z: 0, hp: 100 }];

		const result = collectReturningProjectileHits(
			0, 0, 1, 0, ATTACK_RANGE + 3, CARD_DEFS.infinite_disk.damage, { returnPasses: 3 },
		);
		const returnHits = result.hits.filter((h) => h.pass >= 2);
		expect(returnHits.length).toBe(3);
		expect(returnHits.every((h) => h.enemyId === 'mid')).toBe(true);
		expect(CARD_DEFS.infinite_disk).toMatchObject({
			damage: 18,
			charges: 4,
			effect: 'triple_returning_projectile',
			returnPasses: 3,
			isEvolved: true,
		});
	});

	it('Frost Nova freezes enemies in radius', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 2, z: 0, hp: 40 }];
		const hits = applyFreezeInRadius(0, 0, SUMMON_RADIUS, 2000, CARD_DEFS.frost_nova.damage);
		expect(hits).toHaveLength(1);
		expect(isEnemyFrozen(gameState.enemies[0])).toBe(true);
	});

	it('Healing Font restores player HP up to max', () => {
		addPlayer('p1', { hp: 60 });
		const healed = healPlayer('p1', CARD_DEFS.healing_font.healAmount);
		expect(healed).toBe(25);
		expect(gameState.players.p1.hp).toBe(85);
	});

	it('Gravity Well pulls enemies toward the origin', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 8, z: 0, hp: 40 }];
		const before = gameState.enemies[0].x;
		pullEnemiesToward(0, 0, CARD_DEFS.gravity_well.pullRadius, CARD_DEFS.gravity_well.pullStrength);
		expect(gameState.enemies[0].x).toBeLessThan(before);
	});

	it('Echo Blade shockwave hits radially on the configured combo count', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 4, z: 0, hp: 40 }];
		const result = collectRadialHits(0, 0, CARD_DEFS.echo_blade.shockwaveRadius, CARD_DEFS.echo_blade.shockwaveDamage);
		expect(result.hits).toHaveLength(1);
		expect(CARD_DEFS.echo_blade.shockwaveEvery).toBe(3);
	});

	it('Mana Leach radial hits grant magic stones per enemy hit', () => {
		addPlayer('p1', { magicStones: 0 });
		gameState.enemies = [
			{ id: 'e1', type: 'grunt', x: 1, z: 0, hp: 40 },
			{ id: 'e2', type: 'grunt', x: -2, z: 0, hp: 40 },
		];
		const result = collectRadialHits(0, 0, SUMMON_RADIUS, CARD_DEFS.mana_leach.damage, {
			magicStoneOnHit: CARD_DEFS.mana_leach.magicStoneOnHit,
		});
		addMagicStones(gameState.players.p1, result.magicStonesGained);
		expect(result.magicStonesGained).toBe(16);
		expect(gameState.players.p1.magicStones).toBe(16);
	});

	it("Dragon's Breath leaves a ticking cone area effect", () => {
		addPlayer('p1');
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 4, z: 0, hp: 40 }];
		spawnDragonsBreathEffect(0, 0, 1, 0, CARD_DEFS.dragons_breath, 'p1');
		expect(gameState.areaEffects).toHaveLength(1);
		gameState.areaEffects[0].lastTickAt = Date.now() - CARD_DEFS.dragons_breath.dotIntervalMs;
		const hpBefore = gameState.enemies[0].hp;
		updateMinions();
		expect(gameState.enemies[0].hp).toBeLessThan(hpBefore);
	});

	it('Skeleton Knight taunt draws enemy attacks toward the minion', () => {
		addPlayer('p1', { x: 10, z: 0 });
		gameState.enemies = [{
			id: 'e1',
			type: 'grunt',
			x: 0,
			z: 0,
			hp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
		}];
		gameState.minions = [{
			id: 'knight',
			ownerId: 'p1',
			type: 'skeleton_knight',
			x: 2,
			z: 0,
			hp: 120,
			taunt: true,
			ttl: 30,
		}];
		gameState.run = { status: 'playing' };

		updateEnemies();
		expect(gameState.minions[0].hp).toBeLessThan(120);
	});

	it('Storm Eagle minion damages enemies from range without closing to melee', () => {
		addPlayer('p1', { x: 0, z: 0 });
		gameState.enemies = [{
			id: 'e1',
			type: 'grunt',
			x: 6,
			z: 0,
			hp: 40,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 6, z: 0 },
		}];
		gameState.minions = [{
			id: 'eagle',
			ownerId: 'p1',
			type: 'storm_eagle',
			x: 0,
			z: 0,
			hp: 45,
			attackRange: 7,
			attackDamage: 12,
			ttl: 30,
		}];
		gameState.run = { status: 'playing' };

		const distBefore = Math.hypot(
			gameState.enemies[0].x - gameState.minions[0].x,
			gameState.enemies[0].z - gameState.minions[0].z
		);
		updateMinions();
		cleanupAfterDamage();
		expect(gameState.enemies[0].hp).toBeLessThan(40);
		const distAfter = Math.hypot(
			gameState.enemies[0].x - gameState.minions[0].x,
			gameState.enemies[0].z - gameState.minions[0].z
		);
		expect(distAfter).toBeGreaterThanOrEqual(distBefore - 0.5);
	});
});
