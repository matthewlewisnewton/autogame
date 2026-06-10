import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	spawnEnemy,
	updateEnemies,
	updateBurning,
	isBurning,
	isPlayerConcealed,
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
	const enemy = spawnEnemy(gameState, 0, 0, type);
	Object.assign(enemy, {
		attackState: 'windup',
		windupTargetId: targetId,
		windupTargetType: 'player',
		windupStartTime: now - def.attackWindupMs - 100,
		windupDirX: 1,
		windupDirZ: 0,
		...overrides,
	});
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

	it('cone miss does not ignite the player', () => {
		const player = addPlayer('p1', { x: 0, z: 3, hp: 100 });
		const wraith = makeExpiredWindup('ember_wraith', 'p1');

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
		makeExpiredWindup('grunt', 'p1');

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
