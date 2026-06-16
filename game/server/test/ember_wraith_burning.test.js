import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	spawnEnemy,
	updateEnemies,
	updateBurning,
	isBurning,
	isPlayerConcealed,
	getEntityWorldY,
	computeAimDirection3D,
	ENEMY_DEFS,
	ENEMY_ATTACK_RANGE,
} from '../index.js';

const TICK_INTERVAL = 500;
const TICK_DAMAGE = 5;
const START = 2_000_000;

function setupPlayingRun() {
	gameState.gamePhase = 'playing';
	gameState.run = { status: 'playing' };
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		id,
		x: 0,
		y: 0.5,
		z: 0,
		hp: 100,
		dead: false,
		...overrides,
	};
	return gameState.players[id];
}

function makeExpiredWindup(type, targetId, overrides = {}) {
	const def = ENEMY_DEFS[type];
	const now = Date.now();
	const enemy = spawnEnemy(0, 0, type);
	const { windupDirX, windupDirY, windupDirZ, ...restOverrides } = overrides;
	Object.assign(enemy, {
		attackState: 'windup',
		windupTargetId: targetId,
		windupTargetType: 'player',
		windupStartTime: now - def.attackWindupMs - 100,
		...restOverrides,
	});
	// Match production lockWindupDirection for strike tests; lateral-miss cases
	// pass explicit flat windupDirX/windupDirZ in overrides.
	if (windupDirX === undefined && windupDirY === undefined && windupDirZ === undefined) {
		const target = gameState.players[targetId];
		if (target) {
			const originY = getEntityWorldY(enemy);
			const targetY = getEntityWorldY(target);
			const aim = computeAimDirection3D(
				{ x: enemy.x, y: originY, z: enemy.z },
				{ x: target.x, y: targetY, z: target.z },
			);
			enemy.windupDirX = aim.dirX;
			enemy.windupDirY = aim.dirY;
			enemy.windupDirZ = aim.dirZ;
		}
	} else {
		if (windupDirX !== undefined) enemy.windupDirX = windupDirX;
		if (windupDirY !== undefined) enemy.windupDirY = windupDirY;
		if (windupDirZ !== undefined) enemy.windupDirZ = windupDirZ;
	}
	return enemy;
}

describe('ember_wraith burning on windup strike', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(START);
		resetGameState();
		setupPlayingRun();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('successful cone hit ignites the player', () => {
		const player = addPlayer('p1', { x: 3, z: 0, hp: 100 });
		const wraith = makeExpiredWindup('ember_wraith', 'p1');
		const burnMs = ENEMY_DEFS.ember_wraith.burnDurationMs;

		updateEnemies();

		expect(player.hp).toBe(100 - ENEMY_DEFS.ember_wraith.attackDamage);
		expect(isBurning(player)).toBe(true);
		expect(player.burningUntil).toBe(START + burnMs);
		expect(wraith.attackState).toBe('recovering');
	});

	it('a dodge i-frame eats the strike AND prevents burn ignition', () => {
		const player = addPlayer('p1', {
			x: 3,
			z: 0,
			hp: 100,
			invulnerableUntil: START + 5000,
		});
		makeExpiredWindup('ember_wraith', 'p1');

		updateEnemies();

		// Strike dealt no damage (i-frame) and must NOT have applied burn.
		expect(player.hp).toBe(100);
		expect(isBurning(player)).toBe(false);
	});

	it('a one-hit absorb shield that eats the strike prevents burn ignition', () => {
		const player = addPlayer('p1', {
			x: 3,
			z: 0,
			hp: 100,
			shieldHitsRemaining: 1,
		});
		makeExpiredWindup('ember_wraith', 'p1');

		updateEnemies();

		expect(player.hp).toBe(100);
		expect(player.shieldHitsRemaining).toBe(0);
		expect(isBurning(player)).toBe(false);
	});

	it('a shield-HP pool that fully absorbs the strike prevents burn ignition', () => {
		const player = addPlayer('p1', {
			x: 3,
			z: 0,
			hp: 100,
			shieldHp: 9999,
			shieldExpiresAt: START + 60_000,
		});
		makeExpiredWindup('ember_wraith', 'p1');

		updateEnemies();

		expect(player.hp).toBe(100);
		expect(isBurning(player)).toBe(false);
	});

	it('godmode still ignites (burn DoT is later no-ops through damagePlayer)', () => {
		const player = addPlayer('p1', { x: 3, z: 0, hp: 100, debugGodmode: true });
		makeExpiredWindup('ember_wraith', 'p1');

		updateEnemies();

		// Godmode took no HP damage, but ignition is preserved per the fix.
		expect(player.hp).toBe(100);
		expect(isBurning(player)).toBe(true);

		// And the DoT tick is a harmless no-op under godmode.
		updateBurning();
		vi.setSystemTime(START + TICK_INTERVAL);
		updateBurning();
		expect(player.hp).toBe(100);
	});

	it('cone miss does not ignite the player', () => {
		const player = addPlayer('p1', { x: 0, z: 3, hp: 100 });
		const wraith = makeExpiredWindup('ember_wraith', 'p1', { windupDirX: 1, windupDirZ: 0 });

		updateEnemies();

		expect(player.hp).toBe(100);
		expect(isBurning(player)).toBe(false);
		expect(wraith.attackState).toBe('chasing');
	});

	it('out-of-range windup cancel does not ignite the player', () => {
		const player = addPlayer('p1', { x: ENEMY_ATTACK_RANGE + 10, z: 0, hp: 100 });
		makeExpiredWindup('ember_wraith', 'p1', { x: 0, z: 0 });

		updateEnemies();

		expect(player.hp).toBe(100);
		expect(isBurning(player)).toBe(false);
	});

	it('smoke-concealed target cancels the strike without igniting', () => {
		const player = addPlayer('p1', {
			x: 2,
			z: 0,
			hp: 100,
			smokeBombUntil: START + 10_000,
			smokeBombRadius: 4,
			smokeBombX: 2,
			smokeBombZ: 0,
		});
		expect(isPlayerConcealed(player, START)).toBe(true);
		const wraith = makeExpiredWindup('ember_wraith', 'p1');

		updateEnemies();

		expect(player.hp).toBe(100);
		expect(isBurning(player)).toBe(false);
		expect(wraith.attackState).toBe('chasing');
	});

	it('grunt windup hit does not ignite the player', () => {
		const player = addPlayer('p1', { x: 0, z: 3, hp: 100 });
		makeExpiredWindup('grunt', 'p1', { windupDirX: 1, windupDirZ: 0 });

		updateEnemies();

		expect(player.hp).toBe(100 - ENEMY_DEFS.grunt.attackDamage);
		expect(isBurning(player)).toBe(false);
	});

	it('burn tick damage accrues over 2+ intervals then stops after expiry', () => {
		const player = addPlayer('p1', { x: 3, z: 0, hp: 100 });
		makeExpiredWindup('ember_wraith', 'p1');
		const burnMs = ENEMY_DEFS.ember_wraith.burnDurationMs;

		updateEnemies();

		const hpAfterHit = player.hp;
		expect(isBurning(player)).toBe(true);
		expect(player.burningUntil).toBe(START + burnMs);

		updateBurning();
		expect(player.hp).toBe(hpAfterHit);

		vi.setSystemTime(START + TICK_INTERVAL);
		updateBurning();
		expect(player.hp).toBe(hpAfterHit - TICK_DAMAGE);

		vi.setSystemTime(START + 2 * TICK_INTERVAL);
		updateBurning();
		expect(player.hp).toBe(hpAfterHit - 2 * TICK_DAMAGE);

		const hpBeforeExpiry = player.hp;
		vi.setSystemTime(START + burnMs + TICK_INTERVAL);
		updateBurning();
		expect(isBurning(player)).toBe(false);
		expect(player.hp).toBe(hpBeforeExpiry);
	});
});
