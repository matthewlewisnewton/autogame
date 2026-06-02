import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	KEY_ITEM_DEFS,
	resetGameState,
	gameState,
	createGameState,
	updateEnemies,
	ENEMY_ATTACK_RANGE,
	ENEMY_DEFS,
	DETECTION_RADIUS,
} from '../index.js';
import { isPlayerInSmokeVeil, setGameState } from '../simulation.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
} from './helpers.js';

// ── Definition ──

describe('Smoke Veil — definition', () => {
	it('smoke_bomb def is tuned for ~2s veil, ~8s cooldown, 4m radius, cast-point zone', () => {
		const def = KEY_ITEM_DEFS.smoke_bomb;
		expect(def).toBeDefined();
		expect(def.id).toBe('smoke_bomb');
		expect(def.name).toBe('Smoke Veil');
		expect(def.type).toBe('stealth');
		expect(def.cooldownMs).toBe(8000);
		expect(def.durationMs).toBe(2000);
		expect(def.radius).toBe(4);
		expect(def.description.toLowerCase()).toMatch(/cast|conceal/);
	});
});

// ── isPlayerInSmokeVeil (unit) ──

describe('isPlayerInSmokeVeil()', () => {
	const FUTURE = () => Date.now() + 5000;
	const PAST = () => Date.now() - 5000;

	function makePlayer(overrides = {}) {
		return {
			id: 'p1',
			x: 0,
			y: 0.5,
			z: 0,
			hp: 100,
			dead: false,
			...overrides,
		};
	}

	function setup(players) {
		setGameState({ players, enemies: [], minions: [] }, []);
	}

	afterEach(() => {
		setGameState(null, null);
	});

	it('returns true when veil is active and player stands inside the fixed disc', () => {
		const player = makePlayer({
			smokeVeilUntil: FUTURE(),
			smokeVeilRadius: 4,
			smokeVeilX: 0,
			smokeVeilZ: 0,
			x: 1,
			z: 0,
		});
		setup({ p1: player });
		expect(isPlayerInSmokeVeil(player)).toBe(true);
	});

	it('returns false when player left the cast-point disc', () => {
		const player = makePlayer({
			smokeVeilUntil: FUTURE(),
			smokeVeilRadius: 4,
			smokeVeilX: 0,
			smokeVeilZ: 0,
			x: 10,
			z: 0,
		});
		setup({ p1: player });
		expect(isPlayerInSmokeVeil(player)).toBe(false);
	});

	it('returns false when smokeVeilUntil has expired', () => {
		const player = makePlayer({
			smokeVeilUntil: PAST(),
			smokeVeilRadius: 4,
			smokeVeilX: 0,
			smokeVeilZ: 0,
			x: 0,
			z: 0,
		});
		setup({ p1: player });
		expect(isPlayerInSmokeVeil(player)).toBe(false);
	});

	it('returns false for null/undefined player', () => {
		setup({});
		expect(isPlayerInSmokeVeil(null)).toBe(false);
		expect(isPlayerInSmokeVeil(undefined)).toBe(false);
	});
});

// ── Socket integration: cast + cooldown ──

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

	it('casting sets smokeVeilUntil/center/radius and keyItemCooldownUntil; keyItemUsed ok', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const def = KEY_ITEM_DEFS.smoke_bomb;

		player.keyItemCooldownUntil = 0;
		player.smokeVeilUntil = 0;
		player.x = 2;
		player.z = -3;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const result = await resultPromise;

		const now = Date.now();
		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('smoke_bomb');
		expect(result.smokeVeilUntil).toBeGreaterThan(now);
		expect(result.cooldownUntil).toBeGreaterThan(now);

		expect(player.smokeVeilUntil).toBeGreaterThan(now);
		expect(player.smokeVeilX).toBe(2);
		expect(player.smokeVeilZ).toBe(-3);
		expect(player.smokeVeilRadius).toBe(def.radius);
		expect(player.smokeVeilUntil - now).toBeCloseTo(def.durationMs, -1);
		expect(player.keyItemCooldownUntil - now).toBeCloseTo(def.cooldownMs, -1);
	});

	it('cooldown enforced: immediate re-cast returns on_cooldown without refreshing veil', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;

		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const result1 = await result1Promise;
		expect(result1.ok).toBe(true);

		const firstVeilUntil = player.smokeVeilUntil;
		const firstVeilX = player.smokeVeilX;

		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(player.smokeVeilUntil).toBe(firstVeilUntil);
		expect(player.smokeVeilX).toBe(firstVeilX);
	});
});

// ── updateEnemies targeting suppression ──

describe('updateEnemies() — Smoke Veil targeting', () => {
	function resetState() {
		Object.assign(gameState, createGameState());
	}

	function addPlayer(id, overrides = {}) {
		gameState.players[id] = {
			id,
			x: 0,
			y: 0.5,
			z: 0,
			rotation: 0,
			hp: 100,
			dead: false,
			lastActivity: Date.now(),
			ready: false,
			magicStones: 5,
			...overrides,
		};
	}

	beforeEach(() => {
		resetGameState();
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2000, 0, 1));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('does not enter windup on a player standing inside their active veil', () => {
		const veilUntil = Date.now() + 5000;
		addPlayer('p1', {
			id: 'p1',
			x: 0,
			z: 0,
			smokeVeilUntil: veilUntil,
			smokeVeilRadius: 4,
			smokeVeilX: 0,
			smokeVeilZ: 0,
		});

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: ENEMY_ATTACK_RANGE - 0.5,
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'chasing',
			wanderTarget: { x: 0, z: 0 },
		});

		updateEnemies();

		expect(gameState.enemies[0].attackState).not.toBe('windup');
		expect(gameState.enemies[0].windupTargetId).toBeUndefined();
	});

	it('cancels in-progress windup strike with no damage when target is inside veil at resolve', () => {
		const veilUntil = Date.now() + 5000;
		addPlayer('p1', { id: 'p1', x: 0, z: 0, hp: 100, smokeVeilUntil: veilUntil, smokeVeilRadius: 4, smokeVeilX: 0, smokeVeilZ: 0 });
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 0,
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.grunt.attackWindupMs - 100,
			wanderTarget: { x: 0, z: 0 },
		});

		updateEnemies();

		expect(gameState.players['p1'].hp).toBe(100);
		expect(gameState.enemies[0].attackState).toBe('chasing');
	});

	it('targets and damages player normally after leaving the veil disc', () => {
		const veilUntil = Date.now() + 5000;
		addPlayer('p1', {
			id: 'p1',
			x: 10,
			z: 0,
			hp: 100,
			smokeVeilUntil: veilUntil,
			smokeVeilRadius: 4,
			smokeVeilX: 0,
			smokeVeilZ: 0,
		});
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 10,
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.grunt.attackWindupMs - 100,
			wanderTarget: { x: 10, z: 0 },
		});

		updateEnemies();

		expect(gameState.players['p1'].hp).toBe(100 - ENEMY_DEFS.grunt.attackDamage);
	});

	it('can target player again after smokeVeilUntil expires', () => {
		addPlayer('p1', {
			id: 'p1',
			x: 0,
			z: 0,
			smokeVeilUntil: Date.now() - 1,
			smokeVeilRadius: 4,
			smokeVeilX: 0,
			smokeVeilZ: 0,
		});

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: ENEMY_ATTACK_RANGE - 0.5,
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'chasing',
			wanderTarget: { x: 0, z: 0 },
		});

		updateEnemies();

		expect(gameState.enemies[0].attackState).toBe('windup');
		expect(gameState.enemies[0].windupTargetId).toBe('p1');
	});

	it('ignores veiled player for nearest-target selection when another player is in range', () => {
		const veilUntil = Date.now() + 5000;
		addPlayer('veiled', {
			id: 'veiled',
			x: 0,
			z: 0,
			smokeVeilUntil: veilUntil,
			smokeVeilRadius: 4,
			smokeVeilX: 0,
			smokeVeilZ: 0,
		});
		addPlayer('exposed', {
			id: 'exposed',
			x: DETECTION_RADIUS - 1,
			z: 0,
		});

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: DETECTION_RADIUS,
			z: 0,
			hp: 50,
			state: 'idle',
			attackState: 'chasing',
			wanderTarget: { x: 0, z: 0 },
		});

		updateEnemies();

		expect(gameState.enemies[0].windupTargetId).toBe('exposed');
	});
});
