import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	ATTACK_RANGE,
	CARD_DEFS,
	ENEMY_DEFS,
	TICK_RATE,
	createGameState,
	gameState,
	getEntityWorldY,
	computeAimDirection3D,
	resolveProjectileAim,
	collectProjectileHits,
	collectReturningProjectileHits,
	collectChainLightningHits,
	collectPhaseBeamHits,
	collectConeHits,
	spawnIceBall,
	isSlowed,
	updateEnemyProjectiles,
	updateMinions,
} from '../index.js';
import { handleUseCard, setCallbacks as setCardEffectCallbacks } from '../cardEffects.js';
import { setGameState as setSimGameState } from '../simulation.js';
import { setGameState as setProgressionGameState } from '../progression.js';

function mockIo() {
	return {
		to: () => ({
			emit: () => {},
		}),
	};
}

function wireCardEffectCallbacks() {
	setCardEffectCallbacks({
		io: mockIo(),
		emitCardError: () => {},
		findSacrificeTarget: () => null,
		resolveAttackRotation: (player, data) => (
			Number.isFinite(data?.rotation) ? data.rotation : (player.rotation || 0)
		),
		resolveProjectileAim,
	});
}

function resetState() {
	Object.assign(gameState, createGameState());
}

function addEnemy(id, x, z, hp = 100, y = undefined) {
	const enemy = {
		id,
		type: 'grunt',
		x,
		z,
		hp,
		maxHp: hp,
	};
	if (y !== undefined) enemy.y = y;
	gameState.enemies.push(enemy);
}

describe('height-aware combat helpers', () => {
	beforeEach(resetState);

	it('getEntityWorldY prefers entity.y when set', () => {
		expect(getEntityWorldY({ x: 0, z: 0, y: 4.5 })).toBe(4.5);
	});

	it('computeAimDirection3D returns a normalized vector toward the target', () => {
		const dir = computeAimDirection3D({ x: 0, y: 0, z: 0 }, { x: 0, y: 5, z: 0 });
		expect(dir.dirX).toBeCloseTo(0);
		expect(dir.dirY).toBeCloseTo(1);
		expect(dir.dirZ).toBeCloseTo(0);
	});
});

describe('collectProjectileHits height awareness', () => {
	beforeEach(resetState);

	const range = 10;
	const damage = 20;

	it('misses a target directly above on the same (x, z) with flat XZ aim but hits with +Y aim', () => {
		addEnemy('elevated', 0, 0, 100, 5);

		const flat = collectProjectileHits(0, 0, 1, 0, range, damage);
		expect(flat.hits).toHaveLength(0);
		expect(gameState.enemies[0].hp).toBe(100);

		resetState();
		addEnemy('elevated', 0, 0, 100, 5);

		const tilted = collectProjectileHits(0, 0, 0, 0, range, damage, {
			originY: 0,
			dirY: 1,
		});
		expect(tilted.hits).toHaveLength(1);
		expect(tilted.hits[0].enemyId).toBe('elevated');
		expect(gameState.enemies[0].hp).toBe(80);
	});

	it('hits a target at the same elevation with both flat and tilted aim', () => {
		addEnemy('level', 5, 0, 100, 0);

		const flat = collectProjectileHits(0, 0, 1, 0, range, damage);
		expect(flat.hits).toHaveLength(1);

		resetState();
		addEnemy('level', 5, 0, 100, 0);

		const tilted = collectProjectileHits(0, 0, 1, 0, range, damage, {
			originY: 0,
			dirY: 0,
		});
		expect(tilted.hits).toHaveLength(1);
	});
});

describe('collectReturningProjectileHits height awareness', () => {
	beforeEach(resetState);

	it('misses elevated target on flat aim and hits with +Y aim', () => {
		addEnemy('elevated', 0, 0, 100, 5);

		const flat = collectReturningProjectileHits(0, 0, 1, 0, ATTACK_RANGE + 3, 15);
		expect(flat.hits).toHaveLength(0);

		resetState();
		addEnemy('elevated', 0, 0, 100, 5);

		const tilted = collectReturningProjectileHits(0, 0, 0, 0, ATTACK_RANGE + 3, 15, {
			originY: 0,
			dirY: 1,
		});
		expect(tilted.hits.length).toBeGreaterThan(0);
		expect(tilted.hits[0].enemyId).toBe('elevated');
	});
});

describe('collectChainLightningHits height awareness', () => {
	beforeEach(resetState);

	const baseDamage = 30;
	const attackRange = 10;

	it('misses elevated primary on flat aim and hits with +Y aim', () => {
		addEnemy('elevated', 0, 0, 100, 5);

		const flat = collectChainLightningHits(0, 0, 1, 0, attackRange, baseDamage, {
			chainRadius: 5,
			maxChainTargets: 0,
		});
		expect(flat.hits).toHaveLength(0);

		resetState();
		addEnemy('elevated', 0, 0, 100, 5);

		const tilted = collectChainLightningHits(0, 0, 0, 0, attackRange, baseDamage, {
			originY: 0,
			dirY: 1,
			chainRadius: 5,
			maxChainTargets: 0,
		});
		expect(tilted.hits).toHaveLength(1);
		expect(tilted.hits[0].enemyId).toBe('elevated');
	});
});

describe('collectPhaseBeamHits height awareness', () => {
	beforeEach(resetState);

	const range = 10;
	const damage = 12;

	it('misses elevated target on flat aim and hits with +Y aim', () => {
		addEnemy('elevated', 0, 0, 100, 5);

		const flat = collectPhaseBeamHits(0, 0, 1, 0, range, damage);
		expect(flat.hits).toHaveLength(0);

		resetState();
		addEnemy('elevated', 0, 0, 100, 5);

		const tilted = collectPhaseBeamHits(0, 0, 0, 0, range, damage, {
			originY: 0,
			dirY: 1,
		});
		expect(tilted.hits).toHaveLength(1);
		expect(tilted.hits[0].enemyId).toBe('elevated');
	});
});

describe('collectConeHits height awareness', () => {
	beforeEach(resetState);

	const range = 10;
	const coneAngle = Math.PI / 4;
	const damage = 15;

	it('misses elevated target in cone with flat aim but hits with upward cone axis', () => {
		addEnemy('elevated', 0, 0, 100, 5);

		const flat = collectConeHits(0, 0, 1, 0, range, coneAngle, damage);
		expect(flat.hits).toHaveLength(0);

		resetState();
		addEnemy('elevated', 0, 0, 100, 5);

		const tilted = collectConeHits(0, 0, 0, 0, range, coneAngle, damage, {
			originY: 0,
			dirY: 1,
		});
		expect(tilted.hits).toHaveLength(1);
		expect(tilted.hits[0].enemyId).toBe('elevated');
	});

	it('hits a same-elevation target with flat cone aim', () => {
		addEnemy('ahead', 3, 0, 100, 0);

		const result = collectConeHits(0, 0, 1, 0, range, Math.PI / 2, damage);
		expect(result.hits).toHaveLength(1);
	});
});

// excalibur_photon is out of scope for this matrix: it is a cone weapon (stationary
// photon sweep), not a traveling projectile. Height-aware cone coverage lives in
// collectConeHits above; no lock-on projectile regression is required here.

function setupLockOnProjectileTest(cardId) {
	resetState();
	const playerId = 'p1';
	const enemyId = 'elevated';
	const cardDef = CARD_DEFS[cardId];

	gameState.gamePhase = 'playing';
	gameState.run = {
		status: 'playing',
		objective: { type: 'defeat_enemies', current: 0, target: 1 },
	};
	gameState.enemies = [{
		id: enemyId,
		type: 'grunt',
		x: 0,
		z: 0,
		y: 5,
		hp: 100,
		maxHp: 100,
		state: 'idle',
		attackState: 'idle',
		wanderTarget: { x: 0, z: 0 },
	}];

	gameState.players[playerId] = {
		x: 0,
		y: 0,
		z: 0,
		rotation: 0,
		hp: 100,
		dead: false,
		extracted: false,
		magicStones: 100,
		pendingSummons: new Set(),
		hand: [{
			id: cardId,
			name: cardDef.name,
			type: cardDef.type,
			remainingCharges: cardDef.charges || 4,
			grind: 0,
		}, null, null, null],
		slotCooldowns: [null, null, null, null],
	};

	setSimGameState(gameState, {});
	setProgressionGameState(gameState);
	wireCardEffectCallbacks();

	const socket = {
		playerId,
		emit: () => {},
	};
	const lobby = {
		id: 'lobby1',
		state: gameState,
	};

	return {
		socket,
		lobby,
		playerId,
		enemyId,
		cardId,
		cast(extra = {}) {
			const hpBefore = gameState.enemies[0].hp;
			handleUseCard(socket, gameState, lobby, {
				cardId,
				slotIndex: 0,
				rotation: 0,
				...extra,
			});
			return { hpBefore, hpAfter: gameState.enemies[0].hp };
		},
	};
}

function expectLockOnHeightHit(cardId) {
	const missSetup = setupLockOnProjectileTest(cardId);
	const miss = missSetup.cast();
	expect(miss.hpAfter).toBe(miss.hpBefore);

	resetState();
	const hitSetup = setupLockOnProjectileTest(cardId);
	const hit = hitSetup.cast({ lockTargetId: hitSetup.enemyId });
	expect(hit.hpAfter).toBeLessThan(hit.hpBefore);
}

function setupMinionHeightTest() {
	resetState();
	setSimGameState(gameState, {});
	gameState.run = { status: 'playing' };
	gameState._pendingMinionBreaths = [];
	gameState.iceBalls = [];
	gameState.players.p1 = {
		id: 'p1',
		x: 0,
		z: 0,
		y: 0,
		hp: 100,
		dead: false,
	};
}

describe('fireball', () => {
	beforeEach(() => wireCardEffectCallbacks());

	it('hits an elevated target on the same (x, z) with lockTargetId', () => {
		expectLockOnHeightHit('fireball');
	});
});

describe('arcane_bolt', () => {
	beforeEach(() => wireCardEffectCallbacks());

	it('hits an elevated target on the same (x, z) with lockTargetId', () => {
		expectLockOnHeightHit('arcane_bolt');
	});
});

describe('photon_slicer', () => {
	beforeEach(() => wireCardEffectCallbacks());

	it('hits an elevated target on the same (x, z) with lockTargetId', () => {
		expectLockOnHeightHit('photon_slicer');
	});
});

describe('infinite_disk', () => {
	beforeEach(() => wireCardEffectCallbacks());

	it('hits an elevated target on the same (x, z) with lockTargetId', () => {
		expectLockOnHeightHit('infinite_disk');
	});
});

describe('ice_ball', () => {
	beforeEach(() => wireCardEffectCallbacks());

	it('hits an elevated target on the same (x, z) with lockTargetId', () => {
		expectLockOnHeightHit('ice_ball');
	});
});

describe('chain_lightning', () => {
	beforeEach(() => wireCardEffectCallbacks());

	it('hits an elevated target on the same (x, z) with lockTargetId', () => {
		expectLockOnHeightHit('chain_lightning');
	});
});

describe('dragons_breath', () => {
	beforeEach(() => wireCardEffectCallbacks());

	it('hits an elevated target on the same (x, z) with lockTargetId', () => {
		expectLockOnHeightHit('dragons_breath');
	});
});

describe('resolveProjectileAim lock-on tilt', () => {
	beforeEach(resetState);

	it('tilts upward toward a lock-on target above the shooter', () => {
		const playerId = 'p1';
		gameState.players[playerId] = { x: 0, y: 0, z: 0, rotation: 0 };
		addEnemy('elevated', 0, 0, 100, 5);

		const aim = resolveProjectileAim(
			gameState.players[playerId],
			{ lockTargetId: 'elevated', rotation: 0 },
			gameState,
		);

		expect(aim.dirY).toBeGreaterThan(0);
		expect(aim.dirX).toBeCloseTo(0, 5);
		expect(aim.dirZ).toBeCloseTo(0, 5);
	});
});

function addFlyingEnemy(id, x, z, type = 'void_seraph') {
	const def = ENEMY_DEFS[type];
	gameState.enemies.push({
		id,
		type,
		x,
		z,
		flying: true,
		altitude: def.altitude,
		hp: def.hp,
		maxHp: def.hp,
		state: 'idle',
		attackState: 'idle',
		wanderTarget: { x, z },
	});
}

function setupFlyingLockOnProjectileTest(cardId, enemyType = 'void_seraph') {
	resetState();
	const playerId = 'p1';
	const enemyId = 'flier';
	const cardDef = CARD_DEFS[cardId];
	const enemyDef = ENEMY_DEFS[enemyType];

	gameState.gamePhase = 'playing';
	gameState.run = {
		status: 'playing',
		objective: { type: 'defeat_enemies', current: 0, target: 1 },
	};
	gameState.enemies = [{
		id: enemyId,
		type: enemyType,
		x: 0,
		z: 0,
		flying: true,
		altitude: enemyDef.altitude,
		hp: enemyDef.hp,
		maxHp: enemyDef.hp,
		state: 'idle',
		attackState: 'idle',
		wanderTarget: { x: 0, z: 0 },
	}];

	gameState.players[playerId] = {
		x: 0,
		y: 0,
		z: 0,
		rotation: 0,
		hp: 100,
		dead: false,
		extracted: false,
		magicStones: 100,
		pendingSummons: new Set(),
		hand: [{
			id: cardId,
			name: cardDef.name,
			type: cardDef.type,
			remainingCharges: cardDef.charges || 4,
			grind: 0,
		}, null, null, null],
		slotCooldowns: [null, null, null, null],
	};

	setSimGameState(gameState, {});
	setProgressionGameState(gameState);
	wireCardEffectCallbacks();

	const socket = {
		playerId,
		emit: () => {},
	};
	const lobby = {
		id: 'lobby1',
		state: gameState,
	};

	return {
		socket,
		lobby,
		playerId,
		enemyId,
		cardId,
		cast(extra = {}) {
			const hpBefore = gameState.enemies[0].hp;
			handleUseCard(socket, gameState, lobby, {
				cardId,
				slotIndex: 0,
				rotation: 0,
				...extra,
			});
			return { hpBefore, hpAfter: gameState.enemies[0].hp };
		},
	};
}

describe('resolveProjectileAim flying lock-on', () => {
	beforeEach(resetState);

	it('tilts upward toward a flying lock-on target above the shooter on the same (x, z)', () => {
		const playerId = 'p1';
		gameState.players[playerId] = { x: 0, y: 0, z: 0, rotation: 0 };
		addFlyingEnemy('flier', 0, 0);

		const aim = resolveProjectileAim(
			gameState.players[playerId],
			{ lockTargetId: 'flier', rotation: 0 },
			gameState,
		);

		expect(aim.dirY).toBeGreaterThan(0);
		expect(aim.dirX).toBeCloseTo(0, 5);
		expect(aim.dirZ).toBeCloseTo(0, 5);
	});

	it('still resolves explicit enemy.y elevation (lock-on-elevated-projectile path)', () => {
		const playerId = 'p1';
		gameState.players[playerId] = { x: 0, y: 0, z: 0, rotation: 0 };
		addEnemy('elevated', 0, 0, 100, 5);

		const aim = resolveProjectileAim(
			gameState.players[playerId],
			{ lockTargetId: 'elevated', rotation: 0 },
			gameState,
		);

		expect(aim.dirY).toBeGreaterThan(0);
	});
});

describe('fireball flying lock-on', () => {
	beforeEach(() => wireCardEffectCallbacks());

	it('hits a flying target on the same (x, z) with lockTargetId', () => {
		const missSetup = setupFlyingLockOnProjectileTest('fireball');
		const miss = missSetup.cast();
		expect(miss.hpAfter).toBe(miss.hpBefore);

		resetState();
		const hitSetup = setupFlyingLockOnProjectileTest('fireball');
		const hit = hitSetup.cast({ lockTargetId: hitSetup.enemyId });
		expect(hit.hpAfter).toBeLessThan(hit.hpBefore);
	});

	it('hits a rime_drifter-style airborne target with lockTargetId', () => {
		const missSetup = setupFlyingLockOnProjectileTest('fireball', 'rime_drifter');
		const miss = missSetup.cast();
		expect(miss.hpAfter).toBe(miss.hpBefore);

		resetState();
		const hitSetup = setupFlyingLockOnProjectileTest('fireball', 'rime_drifter');
		const hit = hitSetup.cast({ lockTargetId: hitSetup.enemyId });
		expect(hit.hpAfter).toBeLessThan(hit.hpBefore);
	});
});

describe('glacial_thrower', () => {
	const GLACIAL_DEF = ENEMY_DEFS.glacial_thrower;

	beforeEach(setupMinionHeightTest);
	afterEach(() => vi.useRealTimers());

	it('ice ball hits a player elevated on the same (x, z)', () => {
		const thrower = {
			id: 'thrower',
			type: 'glacial_thrower',
			x: 0,
			z: 0,
			y: 0,
			attackDamage: GLACIAL_DEF.attackDamage,
			iceBallSpeed: GLACIAL_DEF.iceBallSpeed,
			iceBallRadius: GLACIAL_DEF.iceBallRadius,
			iceBallSlowDurationMs: GLACIAL_DEF.iceBallSlowDurationMs,
			iceBallSlowFactor: GLACIAL_DEF.iceBallSlowFactor,
			iceBallMaxRange: GLACIAL_DEF.iceBallMaxRange,
			windupDirX: 0,
			windupDirY: 1,
			windupDirZ: 0,
		};
		const ball = spawnIceBall(thrower);
		expect(ball.y).toBe(0);
		expect(ball.dirY).toBe(1);

		const step = GLACIAL_DEF.iceBallSpeed / TICK_RATE;
		gameState.players.p1.y = ball.y + step;
		gameState.players.p1.x = 0;
		gameState.players.p1.z = 0;

		updateEnemyProjectiles();

		expect(gameState.players.p1.hp).toBe(100 - GLACIAL_DEF.attackDamage);
		expect(isSlowed(gameState.players.p1)).toBe(true);
		expect(gameState.players.p1.slowFactor).toBe(GLACIAL_DEF.iceBallSlowFactor);
		expect(gameState.players.p1.slowedUntil).toBeGreaterThan(Date.now());
		expect(gameState.iceBalls).toHaveLength(0);
	});
});

describe('null_crawler', () => {
	beforeEach(setupMinionHeightTest);
	afterEach(() => vi.useRealTimers());

	it('phase beam hits an elevated enemy on the same (x, z)', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);

		gameState.enemies.push({
			id: 'elevated',
			type: 'grunt',
			x: 0,
			z: 0,
			y: 5,
			hp: 100,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 },
		});
		gameState.minions.push({
			id: 'crawler',
			ownerId: 'p1',
			type: 'null_crawler',
			x: 0,
			z: 0,
			y: 0,
			hp: 40,
			ttl: 30,
			attackRange: 14,
			attackDamage: 22,
			attackIntervalMs: 2000,
			attackWindupMs: 1000,
			projectileHitWidth: 0.8,
			attackState: 'windup',
			windupStartTime: now,
			windupDirX: 0,
			windupDirY: 1,
			windupDirZ: 0,
		});

		vi.setSystemTime(now + 1001);
		updateMinions();

		expect(gameState.enemies[0].hp).toBe(78);
		expect(gameState._pendingMinionBreaths).toHaveLength(1);
		expect(gameState._pendingMinionBreaths[0].direction).toMatchObject({ x: 0, y: 1, z: 0 });
	});
});

describe('storm_eagle', () => {
	beforeEach(setupMinionHeightTest);

	it('strike hits an elevated enemy on the same (x, z)', () => {
		gameState.enemies.push({
			id: 'elevated',
			type: 'grunt',
			x: 0,
			z: 0,
			y: 5,
			hp: 40,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 },
		});
		gameState.minions.push({
			id: 'eagle',
			ownerId: 'p1',
			type: 'storm_eagle',
			x: 0,
			z: 0,
			y: 0,
			hp: 45,
			attackRange: 7,
			attackDamage: 13,
			attackIntervalMs: 1500,
			ttl: 30,
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(27);
		expect(gameState._pendingMinionBreaths).toHaveLength(1);
		expect(gameState._pendingMinionBreaths[0].direction.y).toBeGreaterThan(0);
	});
});

describe('dungeon_drake', () => {
	beforeEach(setupMinionHeightTest);
	afterEach(() => vi.useRealTimers());

	it('breath cone hits an elevated enemy on the same (x, z) when aimed upward', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);

		const minionPos = { x: 0, y: 0, z: 0 };
		const enemyPos = { x: 0, y: 5, z: 0 };
		const aim = computeAimDirection3D(minionPos, enemyPos);

		gameState.enemies.push({
			id: 'elevated',
			type: 'grunt',
			x: enemyPos.x,
			z: enemyPos.z,
			y: enemyPos.y,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: enemyPos.x, z: enemyPos.z },
		});
		gameState.minions.push({
			id: 'drake',
			ownerId: 'p1',
			type: 'dungeon_drake',
			x: minionPos.x,
			z: minionPos.z,
			y: minionPos.y,
			hp: 20,
			ttl: 30,
			breathState: 'breathing',
			breathStartedAt: now,
			lastBreathTickAt: 0,
			breathDirX: aim.dirX,
			breathDirY: aim.dirY,
			breathDirZ: aim.dirZ,
			breathRange: 8,
			breathHoldDistance: 3.5,
			breathConeAngle: Math.PI / 2,
			breathDamage: 2,
			burnDurationMs: 2000,
			breathDurationMs: 2000,
			breathTickMs: 500,
			breathIntervalMs: 2500,
			lastBreathAt: 0,
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(48);
		expect(gameState.minions[0].breathDirY).toBeGreaterThan(0);
		expect(gameState._pendingMinionBreaths[0].direction.y).toBeGreaterThan(0);
		expect(gameState._pendingMinionBreaths[0].origin.y).toBeUndefined();
	});
});

describe('ancient_wyrm', () => {
	beforeEach(setupMinionHeightTest);
	afterEach(() => vi.useRealTimers());

	it('breath cone hits an elevated enemy on the same (x, z) when aimed upward', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);

		const altitude = CARD_DEFS.ancient_wyrm.altitude;
		const minionWorldY = getEntityWorldY({ flying: true, altitude, x: 0, z: 0 });
		const minionPos = { x: 0, y: minionWorldY, z: 0 };
		const enemyPos = { x: 0, y: 5, z: 0 };
		const aim = computeAimDirection3D(minionPos, enemyPos);

		gameState.enemies.push({
			id: 'elevated',
			type: 'grunt',
			x: enemyPos.x,
			z: enemyPos.z,
			y: enemyPos.y,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: enemyPos.x, z: enemyPos.z },
		});
		gameState.minions.push({
			id: 'wyrm',
			ownerId: 'p1',
			type: 'ancient_wyrm',
			x: minionPos.x,
			z: minionPos.z,
			flying: true,
			altitude,
			hp: 90,
			ttl: 30,
			breathState: 'breathing',
			breathStartedAt: now,
			lastBreathTickAt: 0,
			breathDirX: aim.dirX,
			breathDirY: aim.dirY,
			breathDirZ: aim.dirZ,
			breathRange: 10,
			breathHoldDistance: 5.5,
			breathConeAngle: CARD_DEFS.ancient_wyrm.breathConeAngle,
			breathDamage: CARD_DEFS.ancient_wyrm.breathDamage,
			burnDurationMs: 2000,
			breathDurationMs: 2500,
			breathTickMs: 500,
			breathIntervalMs: 3000,
			lastBreathAt: 0,
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(50 - CARD_DEFS.ancient_wyrm.breathDamage);
		expect(gameState.minions[0].breathDirY).toBeGreaterThan(0);
		expect(gameState._pendingMinionBreaths[0].direction.y).toBeGreaterThan(0);
		expect(gameState._pendingMinionBreaths[0].origin.y).toBe(minionWorldY);
	});
});
