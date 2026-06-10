import { describe, it, expect, beforeEach } from 'vitest';
import {
	ATTACK_RANGE,
	CARD_DEFS,
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

const LOCK_ON_PROJECTILE_CARDS = [
	'fireball',
	'ice_ball',
	'arcane_bolt',
	'chain_lightning',
	'photon_slicer',
	'infinite_disk',
	'dragons_breath',
];

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

describe('player lock-on projectile aim (useCard integration)', () => {
	beforeEach(() => {
		wireCardEffectCallbacks();
	});

	for (const cardId of LOCK_ON_PROJECTILE_CARDS) {
		it(`${cardId} hits an elevated target with lockTargetId and misses with flat rotation only`, () => {
			const setup = setupLockOnProjectileTest(cardId);

			const miss = setup.cast();
			expect(miss.hpAfter).toBe(miss.hpBefore);

			resetState();
			const hitSetup = setupLockOnProjectileTest(cardId);
			const hit = hitSetup.cast({ lockTargetId: hitSetup.enemyId });
			expect(hit.hpAfter).toBeLessThan(hit.hpBefore);
		});
	}

	it('resolveProjectileAim tilts upward toward a lock-on target above the shooter', () => {
		resetState();
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
