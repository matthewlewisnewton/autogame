import { describe, it, expect, beforeEach } from 'vitest';
import {
	CARD_DEFS,
	DESPERATION_CARD_DEFS,
	COOLDOWN_MS,
	SUMMON_RADIUS,
	ATTACK_RANGE,
	PROJECTILE_HIT_WIDTH,
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
	collectProjectileHits,
	applyFreezeInRadius,
	pullEnemiesToward,
	applyKnockback,
	applyEventHorizon,
	spawnDragonsBreathEffect,
	spawnFireTrailEffect,
	spawnInfernoPillarEffect,
	isEnemyFrozen,
	rebuildWallColliders,
	isEntityPositionBlocked,
	ENTITY_RADIUS,
	computeWalkableAABBs,
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
		'arcane_bolt',
	];

	it('defines all eleven new cards with expected types', () => {
		expect(Object.keys(CARD_DEFS)).toHaveLength(40);
		for (const cardId of newCardIds) {
			expect(CARD_DEFS[cardId]).toBeDefined();
		}
		expect(CARD_DEFS.saber_of_light.type).toBe('weapon');
		expect(CARD_DEFS.photon_slicer.type).toBe('weapon');
		expect(CARD_DEFS.echo_blade.type).toBe('weapon');
		expect(CARD_DEFS.frost_nova.type).toBe('spell');
		expect(CARD_DEFS.healing_font.type).toBe('spell');
		expect(CARD_DEFS.gravity_well.type).toBe('spell');
		expect(CARD_DEFS.mana_leach.type).toBe('spell');
		expect(CARD_DEFS.dragons_breath.type).toBe('spell');
		expect(CARD_DEFS.arcane_bolt.type).toBe('weapon');
		expect(CARD_DEFS.skeleton_knight.type).toBe('creature');
		expect(CARD_DEFS.storm_eagle.type).toBe('creature');
	});
});

describe('new card combat helpers', () => {
	beforeEach(resetState);

	it('Saber of Light uses a faster cooldown than default weapons', () => {
		expect(CARD_DEFS.saber_of_light.cooldownMs).toBeLessThan(COOLDOWN_MS);
		expect(CARD_DEFS.saber_of_light.damage).toBeLessThan(CARD_DEFS.iron_sword.damage);
	});

	it('Excalibur Photon inherits Saber stats with +50% damage and double swings', () => {
		expect(CARD_DEFS.excalibur_photon.damage).toBe(
			Math.round(CARD_DEFS.saber_of_light.damage * 1.5)
		);
		expect(CARD_DEFS.excalibur_photon.charges).toBe(CARD_DEFS.saber_of_light.charges);
		expect(CARD_DEFS.excalibur_photon.cooldownMs).toBeLessThan(CARD_DEFS.saber_of_light.cooldownMs);
		expect(CARD_DEFS.excalibur_photon.swingsPerUse).toBe(2);
	});

	it('Excalibur Photon double swing applies cone damage twice', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 3, z: 0, hp: 40 }];
		const damage = CARD_DEFS.excalibur_photon.damage;
		const swings = CARD_DEFS.excalibur_photon.swingsPerUse;
		for (let swing = 0; swing < swings; swing++) {
			collectConeHits(0, 0, 1, 0, ATTACK_RANGE, Math.PI / 2, damage);
		}
		expect(gameState.enemies[0].hp).toBe(40 - damage * swings);
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

	it('Arcane Bolt projectile hits at long range and misses beyond range', () => {
		const range = CARD_DEFS.arcane_bolt.attackRange;
		const outOfRangeMargin = 2;
		gameState.enemies = [
			{ id: 'in-range-near', type: 'grunt', x: PROJECTILE_HIT_WIDTH, z: 0, hp: 30 },
			{ id: 'in-range-far-edge', type: 'grunt', x: range, z: 0, hp: 30 },
			{
				id: 'out-of-range',
				type: 'grunt',
				x: range + PROJECTILE_HIT_WIDTH + outOfRangeMargin,
				z: 0,
				hp: 30,
			},
		];

		const result = collectProjectileHits(0, 0, 1, 0, range, CARD_DEFS.arcane_bolt.damage, {
			pierces: CARD_DEFS.arcane_bolt.projectile?.pierces === true,
		});
		expect(result.hits.some(h => h.enemyId === 'in-range-near')).toBe(true);
		expect(result.hits.some(h => h.enemyId === 'in-range-far-edge')).toBe(true);
		expect(result.hits.some(h => h.enemyId === 'out-of-range')).toBe(false);
		expect(CARD_DEFS.arcane_bolt).toMatchObject({
			type: 'weapon',
			damage: 15,
			charges: 4,
			attackRange: 10,
			effect: 'projectile',
			specialEffect: 'long_range',
			projectile: { pierces: true },
		});
	});

	it('Arcane Bolt pierces multiple enemies along its path', () => {
		const range = CARD_DEFS.arcane_bolt.attackRange;
		gameState.enemies = [
			{ id: 'first', type: 'grunt', x: 2, z: 0, hp: 30 },
			{ id: 'second', type: 'grunt', x: 4, z: 0, hp: 30 },
		];

		const result = collectProjectileHits(0, 0, 1, 0, range, CARD_DEFS.arcane_bolt.damage, { pierces: true });
		expect(result.hits.map((h) => h.enemyId)).toEqual(['first', 'second']);
	});

	it('Throw Rock stops after the first enemy hit', () => {
		const throwRock = DESPERATION_CARD_DEFS.throw_rock;
		const range = throwRock.attackRange;
		gameState.enemies = [
			{ id: 'first', type: 'grunt', x: 2, z: 0, hp: 30 },
			{ id: 'second', type: 'grunt', x: 4, z: 0, hp: 30 },
		];

		const result = collectProjectileHits(0, 0, 1, 0, range, throwRock.damage);
		expect(result.hits).toHaveLength(1);
		expect(result.hits[0].enemyId).toBe('first');
		expect(gameState.enemies.find((e) => e.id === 'second').hp).toBe(30);
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
			damage: 20,
			charges: 4,
			effect: 'triple_returning_projectile',
			returnPasses: 3,
			isEvolved: true,
		});
	});

	it('Cryo Burst freezes enemies in radius', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 2, z: 0, hp: 40 }];
		const hits = applyFreezeInRadius(0, 0, SUMMON_RADIUS, 2000, CARD_DEFS.frost_nova.damage);
		expect(hits).toHaveLength(1);
		expect(isEnemyFrozen(gameState.enemies[0])).toBe(true);
	});

	it('Glacier Rupture deals bonus damage to already-frozen enemies', () => {
		const now = Date.now();
		const def = CARD_DEFS.glacier_collapse;
		gameState.enemies = [
			{ id: 'e1', type: 'grunt', x: 2, z: 0, hp: 100, frozenUntil: now + 5000 },
			{ id: 'e2', type: 'grunt', x: -2, z: 0, hp: 100 },
		];
		const hits = applyFreezeInRadius(
			0,
			0,
			SUMMON_RADIUS,
			def.freezeDurationMs,
			def.damage,
			def.frozenBonusDamage
		);
		expect(hits).toHaveLength(2);
		expect(gameState.enemies[0].hp).toBe(100 - def.damage - def.frozenBonusDamage);
		expect(hits[0].frozenShatter).toBe(true);
		expect(gameState.enemies[1].hp).toBe(100 - def.damage);
		expect(hits[1].frozenShatter).toBeUndefined();
	});

	it('Restoration Beacon restores player HP up to max', () => {
		addPlayer('p1', { hp: 60 });
		const healed = healPlayer('p1', CARD_DEFS.healing_font.healAmount);
		expect(healed).toBe(25);
		expect(gameState.players.p1.hp).toBe(85);
	});

	it('Sanctum Pulse heals 50% more than Restoration Beacon and restores magic stones', () => {
		expect(CARD_DEFS.divine_grace.healAmount).toBe(38);
		expect(CARD_DEFS.divine_grace.magicStoneRestore).toBe(10);
		addPlayer('p1', { hp: 60, magicStones: 0 });
		const healed = healPlayer('p1', CARD_DEFS.divine_grace.healAmount);
		expect(healed).toBe(38);
		expect(gameState.players.p1.hp).toBe(98);
		const gained = addMagicStones(gameState.players.p1, CARD_DEFS.divine_grace.magicStoneRestore);
		expect(gained).toBe(10);
		expect(gameState.players.p1.magicStones).toBe(10);
	});

	it('Steel Claymore knockback pushes hit enemies along attack direction', () => {
		gameState.layout = {
			rooms: [{ x: 0, z: 0, width: 20, depth: 20, walls: [] }],
			passages: [],
		};
		gameState.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
		gameState.walkableAABBs = computeWalkableAABBs(gameState.layout);
		rebuildWallColliders();

		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 3, z: 0, hp: 40 }];
		const beforeX = gameState.enemies[0].x;
		const beforeZ = gameState.enemies[0].z;
		const hits = [{ enemyId: 'e1', hp: 17 }];
		const moved = applyKnockback(0, 0, 1, 0, hits, CARD_DEFS.steel_claymore.knockbackStrength);
		expect(moved).toHaveLength(1);
		expect(gameState.enemies[0].x).toBeGreaterThan(beforeX);
		expect(gameState.enemies[0].z).toBe(beforeZ);
		expect(gameState.enemies[0].x - beforeX).toBe(CARD_DEFS.steel_claymore.knockbackStrength);
	});

	it('Steel Claymore knockback stops at a wall instead of passing through', () => {
		gameState.layout = {
			rooms: [{
				x: 0,
				z: 0,
				width: 12,
				depth: 12,
				walls: [{ axis: 'z', x: 3, z: 0, length: 10 }],
			}],
			passages: [],
		};
		gameState.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
		gameState.walkableAABBs = computeWalkableAABBs(gameState.layout);
		rebuildWallColliders();

		const startX = 2.3;
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: startX, z: 0, hp: 40 }];
		const strength = CARD_DEFS.steel_claymore.knockbackStrength;
		const hits = [{ enemyId: 'e1', hp: 17 }];
		applyKnockback(0, 0, 1, 0, hits, strength);

		const enemy = gameState.enemies[0];
		expect(isEntityPositionBlocked(enemy.x, enemy.z)).toBe(false);
		expect(enemy.x + ENTITY_RADIUS).toBeLessThanOrEqual(2.8 + 1e-6);
		expect(enemy.x - startX).toBeLessThan(strength);
	});

	it('Gravity Well pulls enemies toward the origin', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 8, z: 0, hp: 40 }];
		const before = gameState.enemies[0].x;
		pullEnemiesToward(0, 0, CARD_DEFS.gravity_well.pullRadius, CARD_DEFS.gravity_well.pullStrength);
		expect(gameState.enemies[0].x).toBeLessThan(before);
	});

	it('Event Horizon pulls harder and crushes enemies at the center', () => {
		addPlayer('p1');
		gameState.enemies = [
			{ id: 'edge', type: 'grunt', x: 10, z: 0, hp: 40 },
			{ id: 'core', type: 'grunt', x: 0.5, z: 0, hp: 40 },
		];
		const edgeBefore = gameState.enemies[0].x;
		const coreHpBefore = gameState.enemies[1].hp;
		const { pulled, crushed } = applyEventHorizon(0, 0, CARD_DEFS.event_horizon, 'p1');
		expect(gameState.enemies[0].x).toBeLessThan(edgeBefore);
		expect(CARD_DEFS.event_horizon.pullStrength).toBeGreaterThan(CARD_DEFS.gravity_well.pullStrength);
		expect(pulled.length).toBeGreaterThan(0);
		expect(crushed).toHaveLength(1);
		expect(crushed[0].enemyId).toBe('core');
		expect(gameState.enemies[1].hp).toBe(coreHpBefore - CARD_DEFS.event_horizon.centerDamage);
		expect(gameState.enemies[0].hp).toBe(40);
	});

	it('Phase Echo shockwave hits radially on the configured combo count', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 4, z: 0, hp: 40 }];
		const result = collectRadialHits(0, 0, CARD_DEFS.echo_blade.shockwaveRadius, CARD_DEFS.echo_blade.shockwaveDamage);
		expect(result.hits).toHaveLength(1);
		expect(CARD_DEFS.echo_blade.shockwaveEvery).toBe(3);
	});

	it('Resonance Edge inherits buffed shockwave stats and triggers every second hit', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 4, z: 0, hp: 40 }];
		const def = CARD_DEFS.resonance_edge;
		const result = collectRadialHits(0, 0, def.shockwaveRadius, def.shockwaveDamage);
		expect(result.hits).toHaveLength(1);
		expect(def).toMatchObject({
			damage: 23,
			shockwaveEvery: 2,
			shockwaveDamage: 33,
			isEvolved: true,
			specialEffect: 'shockwave',
		});
	});

	it('Ether Siphon radial hits grant magic stones per enemy hit', () => {
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

	it('Soul Drain radial hits grant magic stones and heal the attacker', () => {
		addPlayer('p1', { hp: 50, magicStones: 0 });
		gameState.enemies = [
			{ id: 'e1', type: 'grunt', x: 1, z: 0, hp: 40 },
			{ id: 'e2', type: 'grunt', x: -2, z: 0, hp: 40 },
		];
		const def = CARD_DEFS.soul_drain;
		const result = collectRadialHits(0, 0, SUMMON_RADIUS, def.damage, {
			magicStoneOnHit: def.magicStoneOnHit,
			healOnHit: def.healOnHit,
			healOnKill: def.healOnKill,
			attackerId: 'p1',
		});
		addMagicStones(gameState.players.p1, result.magicStonesGained);
		expect(def.damage).toBe(42);
		expect(def.magicStoneOnHit).toBe(12);
		expect(result.magicStonesGained).toBe(24);
		expect(result.hpHealed).toBe(24);
		expect(gameState.players.p1.hp).toBe(74);
	});

	it("Wyrmflare leaves a ticking cone area effect", () => {
		addPlayer('p1');
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 4, z: 0, hp: 40 }];
		spawnDragonsBreathEffect(0, 0, 1, 0, CARD_DEFS.dragons_breath, 'p1');
		expect(gameState.areaEffects).toHaveLength(1);
		gameState.areaEffects[0].lastTickAt = Date.now() - CARD_DEFS.dragons_breath.dotIntervalMs;
		const hpBefore = gameState.enemies[0].hp;
		updateMinions();
		expect(gameState.enemies[0].hp).toBeLessThan(hpBefore);
	});

	it('Corebreaker Greatsword fire trail leaves a ticking cone area effect', () => {
		addPlayer('p1');
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: 4, z: 0, hp: 40 }];
		spawnFireTrailEffect(0, 0, 1, 0, CARD_DEFS.magma_greatsword, 'p1');
		expect(gameState.areaEffects).toHaveLength(1);
		expect(gameState.areaEffects[0].type).toBe('fire_trail');
		expect(gameState.areaEffects[0].damagePerTick).toBe(CARD_DEFS.magma_greatsword.trailDamagePerTick);
		gameState.areaEffects[0].lastTickAt = Date.now() - CARD_DEFS.magma_greatsword.dotIntervalMs;
		const hpBefore = gameState.enemies[0].hp;
		updateMinions();
		expect(gameState.enemies[0].hp).toBeLessThan(hpBefore);
		expect(gameState.enemies[0].hp).toBe(hpBefore - CARD_DEFS.magma_greatsword.trailDamagePerTick);
	});

	it('Thermal Column radial burst hits enemies behind the caster', () => {
		gameState.enemies = [{ id: 'e1', type: 'grunt', x: -3, z: 0, hp: 40 }];
		const result = collectRadialHits(0, 0, CARD_DEFS.inferno_pillar.attackRange, CARD_DEFS.inferno_pillar.damage);
		expect(result.hits).toHaveLength(1);
		expect(gameState.enemies[0].hp).toBe(40 - CARD_DEFS.inferno_pillar.damage);
	});

	it('Thermal Column leaves a ticking radial area effect', () => {
		addPlayer('p1');
		gameState.enemies = [
			{ id: 'e1', type: 'grunt', x: 3, z: 0, hp: 40 },
			{ id: 'e2', type: 'grunt', x: 0, z: -4, hp: 40 },
		];
		spawnInfernoPillarEffect(0, 0, CARD_DEFS.inferno_pillar, 'p1');
		expect(gameState.areaEffects[0].type).toBe('inferno_pillar');
		gameState.areaEffects[0].lastTickAt = Date.now() - CARD_DEFS.inferno_pillar.dotIntervalMs;
		const hpBefore = gameState.enemies.map((enemy) => enemy.hp);
		updateMinions();
		expect(gameState.enemies[0].hp).toBeLessThan(hpBefore[0]);
		expect(gameState.enemies[1].hp).toBeLessThan(hpBefore[1]);
	});

	it('Necroframe Knight taunt draws enemy attacks toward the minion', () => {
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
		expect(gameState.minions[0].ttl).toBeLessThan(30);
	});

	it('Stormwing Drone minion damages enemies from range without closing to melee', () => {
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
			attackDamage: 13,
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

	it('Thunderbird minion chains lightning damage to nearby enemies', () => {
		addPlayer('p1', { x: 0, z: 0 });
		gameState.enemies = [
			{
				id: 'e1',
				type: 'grunt',
				x: 6,
				z: 0,
				hp: 50,
				state: 'idle',
				attackState: 'idle',
				wanderTarget: { x: 6, z: 0 },
			},
			{
				id: 'e2',
				type: 'grunt',
				x: 8,
				z: 0,
				hp: 50,
				state: 'idle',
				attackState: 'idle',
				wanderTarget: { x: 8, z: 0 },
			},
		];
		gameState.minions = [{
			id: 'bird',
			ownerId: 'p1',
			type: 'thunderbird',
			x: 0,
			z: 0,
			hp: 68,
			attackRange: 11,
			attackDamage: 20,
			chainRadius: 5,
			maxChainTargets: 2,
			ttl: 30,
		}];
		gameState.run = { status: 'playing' };

		updateMinions();
		cleanupAfterDamage();
		expect(gameState.enemies[0].hp).toBeLessThan(50);
		expect(gameState.enemies[1].hp).toBeLessThan(50);
	});
});
