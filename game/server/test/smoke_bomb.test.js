import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	KEY_ITEM_DEFS,
	gameState,
	createGameState,
	updateEnemies,
	isPlayerHiddenBySmoke,
	ENEMY_DEFS,
	ENEMY_ATTACK_RANGE,
} from '../index.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
} from './helpers.js';

// ── Def values ──

describe('Smoke Bomb — definition', () => {
	it('smoke_bomb def is re-tuned to 2s/4m/8s and has no stale fields', () => {
		const def = KEY_ITEM_DEFS.smoke_bomb;
		expect(def).toBeDefined();
		expect(def.id).toBe('smoke_bomb');
		expect(def.name).toBe('Smoke Bomb');
		expect(def.type).toBe('stealth');
		expect(def.cooldownMs).toBe(8000);
		expect(def.durationMs).toBe(2000);
		expect(def.radius).toBe(4);
		// Description should mention fog/smoke + losing track
		const desc = def.description.toLowerCase();
		expect(desc).toMatch(/fog|smoke/);
		expect(desc).toContain('track');
		// No stray legacy values
		expect(def.cooldownMs).not.toBe(18000);
		expect(def.durationMs).not.toBe(3000);
		expect(def.description).not.toBe('Become temporarily invisible');
	});
});

// ── Socket integration ──

describe('useKeyItem — smoke_bomb (socket integration)', () => {
	let baseUrl;
	let activeSocket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	}, 20000);

	afterEach(async () => {
		if (activeSocket) {
			try { activeSocket.disconnect(); } catch (_) {}
			activeSocket = null;
		}
		await closeServer();
	}, 20000);

	async function connectAndStartRun() {
		const { socket } = await connectClient(baseUrl);
		activeSocket = socket;
		const startGamePromise = waitForEvent(socket, 'startGame', 15000);
		socket.emit('playerReady', true);
		await startGamePromise;
		return { socket };
	}

	it('casting sets smokeBombUntil/radius/center and cooldown on the caster', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const def = KEY_ITEM_DEFS.smoke_bomb;

		// Clean state
		player.keyItemCooldownUntil = 0;
		player.smokeBombUntil = 0;
		player.x = 7;
		player.z = -3;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const result = await resultPromise;

		const now = Date.now();
		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('smoke_bomb');
		expect(result.smokeBombUntil).toBeGreaterThan(now);
		expect(result.cooldownUntil).toBeGreaterThan(now);

		// Player transient state — zone is fixed at the cast position
		expect(player.smokeBombUntil).toBeGreaterThan(now);
		expect(player.smokeBombRadius).toBe(def.radius);
		expect(player.smokeBombX).toBe(7);
		expect(player.smokeBombZ).toBe(-3);
		expect(player.keyItemCooldownUntil).toBeGreaterThan(now);

		// Duration roughly matches def
		expect(player.smokeBombUntil - now).toBeCloseTo(def.durationMs, -1);
	});

	it('cooldown enforced: immediate re-cast returns on_cooldown and does not refresh the zone', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;

		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const result1 = await result1Promise;
		expect(result1.ok).toBe(true);

		const firstZoneUntil = player.smokeBombUntil;

		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);

		// Zone window was not refreshed by the rejected re-cast
		expect(player.smokeBombUntil).toBe(firstZoneUntil);
	});
});

// ── Enemy targeting gated by smoke (drives updateEnemies directly) ──

describe('Smoke Bomb — enemies lose detection in zone', () => {
	function resetState() {
		Object.assign(gameState, createGameState());
	}

	function addPlayer(id, overrides = {}) {
		gameState.players[id] = {
			id,
			x: 0,
			y: 0.5,
			z: 0,
			hp: 100,
			dead: false,
			extracted: false,
			smokeBombUntil: 0,
			smokeBombRadius: 0,
			smokeBombX: 0,
			smokeBombZ: 0,
			wanderTarget: { x: 0, z: 0 },
			...overrides,
		};
		return gameState.players[id];
	}

	function addEnemy(id, overrides = {}) {
		const enemy = {
			id,
			type: 'grunt',
			x: 0,
			z: 0,
			hp: 50,
			state: 'idle',
			attackState: 'chasing',
			wanderTarget: { x: 100, z: 100 },
			...overrides,
		};
		gameState.enemies.push(enemy);
		return enemy;
	}

	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2000, 0, 1));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('isPlayerHiddenBySmoke: true inside an active zone, false when outside or expired', () => {
		const now = Date.now();
		const caster = addPlayer('caster', {
			x: 0,
			z: 0,
			smokeBombUntil: now + 5000,
			smokeBombRadius: 4,
			smokeBombX: 0,
			smokeBombZ: 0,
		});
		const inside = addPlayer('inside', { x: 2, z: 0 });
		const outside = addPlayer('outside', { x: 10, z: 0 });

		expect(isPlayerHiddenBySmoke(caster, now)).toBe(true);
		expect(isPlayerHiddenBySmoke(inside, now)).toBe(true);
		expect(isPlayerHiddenBySmoke(outside, now)).toBe(false);

		// Expired zone hides no one
		expect(isPlayerHiddenBySmoke(inside, now + 6000)).toBe(false);

		// A dead caster's zone does not protect
		caster.dead = true;
		expect(isPlayerHiddenBySmoke(inside, now)).toBe(false);
	});

	it('enemy adjacent to a player inside an active zone does NOT enter windup', () => {
		const now = Date.now();
		addPlayer('p1', {
			x: 0,
			z: 0,
			smokeBombUntil: now + 5000,
			smokeBombRadius: 4,
			smokeBombX: 0,
			smokeBombZ: 0,
		});
		const enemy = addEnemy('e1', {
			x: ENEMY_ATTACK_RANGE - 1, // well within attack range
			z: 0,
			attackState: 'chasing',
		});

		updateEnemies();

		expect(enemy.attackState).not.toBe('windup');
		expect(enemy.windupTargetId).toBeUndefined();
	});

	it('enemy already winding up cancels the strike when the target ducks into smoke', () => {
		const now = Date.now();
		addPlayer('p1', {
			x: 0,
			z: 0,
			hp: 100,
			smokeBombUntil: now + 5000,
			smokeBombRadius: 4,
			smokeBombX: 0,
			smokeBombZ: 0,
		});
		const enemy = addEnemy('e1', {
			x: 0,
			z: 0,
			attackState: 'windup',
			windupTargetType: 'player',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.grunt.attackWindupMs - 100, // windup elapsed
		});

		updateEnemies();

		expect(gameState.players['p1'].hp).toBe(100); // no damage dealt
		expect(enemy.attackState).toBe('chasing');
	});

	it('expired zone restores normal targeting (enemy acquires the player)', () => {
		const now = Date.now();
		addPlayer('p1', {
			x: 0,
			z: 0,
			smokeBombUntil: now - 1000, // already expired
			smokeBombRadius: 4,
			smokeBombX: 0,
			smokeBombZ: 0,
		});
		const enemy = addEnemy('e1', {
			x: ENEMY_ATTACK_RANGE - 1,
			z: 0,
			attackState: 'chasing',
		});

		updateEnemies();

		expect(enemy.attackState).toBe('windup');
		expect(enemy.windupTargetId).toBe('p1');
	});

	it('a player standing OUTSIDE the radius of an active zone is still targeted', () => {
		const now = Date.now();
		// Caster sits at the origin with a zone fixed there.
		addPlayer('caster', {
			x: 0,
			z: 0,
			smokeBombUntil: now + 5000,
			smokeBombRadius: 4,
			smokeBombX: 0,
			smokeBombZ: 0,
		});
		// Target is far outside the zone radius.
		addPlayer('p2', { x: 30, z: 0 });
		const enemy = addEnemy('e1', {
			x: 30 - (ENEMY_ATTACK_RANGE - 1),
			z: 0,
			attackState: 'chasing',
		});

		updateEnemies();

		expect(enemy.attackState).toBe('windup');
		expect(enemy.windupTargetId).toBe('p2');
	});

	it('co-op: a player inside an ally\'s zone is hidden even with no zone of their own', () => {
		const now = Date.now();
		// Ally cast the smoke far away; its fixed zone covers p2's position.
		addPlayer('ally', {
			x: 50,
			z: 50,
			smokeBombUntil: now + 5000,
			smokeBombRadius: 4,
			smokeBombX: 30,
			smokeBombZ: 0,
		});
		// p2 has no zone of its own but stands inside the ally's zone.
		addPlayer('p2', { x: 30, z: 0, smokeBombUntil: 0 });
		const enemy = addEnemy('e1', {
			x: 30 - (ENEMY_ATTACK_RANGE - 1),
			z: 0,
			attackState: 'chasing',
		});

		updateEnemies();

		expect(enemy.attackState).not.toBe('windup');
		expect(enemy.windupTargetId).toBeUndefined();
	});
});
