import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KEY_ITEM_DEFS } from '../index.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
} from './helpers.js';

// ── Def values ──

describe('Smoke Bomb — definition', () => {
	it('smoke_bomb def is re-tuned to 2s/4m/8s', () => {
		const def = KEY_ITEM_DEFS.smoke_bomb;
		expect(def).toBeDefined();
		expect(def.id).toBe('smoke_bomb');
		expect(def.name).toBe('Smoke Bomb');
		expect(def.cooldownMs).toBe(8000);
		expect(def.durationMs).toBe(2000);
		expect(def.radius).toBe(4);
		// No stale legacy values
		expect(def.cooldownMs).not.toBe(18000);
		expect(def.durationMs).not.toBe(3000);
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

	it('casting stamps smokeBombUntil/position/radius at the cast point and burns ~8s cooldown', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const def = KEY_ITEM_DEFS.smoke_bomb;

		// Clean state, place the caster at a known position
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

		// Player transient zone state — fixed at the cast position
		expect(player.smokeBombUntil).toBeGreaterThan(now);
		expect(player.smokeBombX).toBe(7);
		expect(player.smokeBombZ).toBe(-3);
		expect(player.smokeBombRadius).toBe(def.radius);

		// Duration roughly matches def (~2s)
		expect(player.smokeBombUntil - now).toBeCloseTo(def.durationMs, -1);

		// Cooldown ~8s out
		expect(player.keyItemCooldownUntil - now).toBeCloseTo(def.cooldownMs, -2);
	});

	it('the zone stays fixed at the cast point even after the player moves', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;
		player.x = 2;
		player.z = 2;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		await resultPromise;

		// Player walks away — the zone must not follow.
		player.x = 50;
		player.z = 50;

		expect(player.smokeBombX).toBe(2);
		expect(player.smokeBombZ).toBe(2);
	});

	it('immediate re-cast returns on_cooldown and does not refresh the zone', async () => {
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
