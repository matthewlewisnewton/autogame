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

describe('Barrier Dome — definition', () => {
	it('barrier_dome def is re-tuned to 1s/3m/14s and has no stale fields', () => {
		const def = KEY_ITEM_DEFS.barrier_dome;
		expect(def).toBeDefined();
		expect(def.id).toBe('barrier_dome');
		expect(def.name).toBe('Barrier Dome');
		expect(def.type).toBe('defensive');
		expect(def.cooldownMs).toBe(14000);
		expect(def.durationMs).toBe(1000);
		expect(def.radius).toBe(3);
		// Description should still mention blocking projectiles
		expect(def.description.toLowerCase()).toContain('projectile');
		// No stray legacy values
		expect(def.absorbedDamage).toBeUndefined();
		expect(def.radius).not.toBe(5);
		expect(def.durationMs).not.toBe(8000);
	});
});

// ── Socket integration ──

describe('useKeyItem — barrier_dome (socket integration)', () => {
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

	it('casting sets barrierDomeUntil/radius/center and cooldown on the caster', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const def = KEY_ITEM_DEFS.barrier_dome;

		// Clean state
		player.keyItemCooldownUntil = 0;
		player.barrierDomeUntil = 0;
		player.x = 4;
		player.z = -2;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'barrier_dome' });
		const result = await resultPromise;

		const now = Date.now();
		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('barrier_dome');
		expect(result.barrierDomeUntil).toBeGreaterThan(now);
		expect(result.cooldownUntil).toBeGreaterThan(now);

		// Player transient state
		expect(player.barrierDomeUntil).toBeGreaterThan(now);
		expect(player.barrierDomeRadius).toBe(def.radius);
		expect(player.barrierDomeX).toBe(4);
		expect(player.barrierDomeZ).toBe(-2);
		expect(player.keyItemCooldownUntil).toBeGreaterThan(now);

		// Duration roughly matches def
		expect(player.barrierDomeUntil - now).toBeCloseTo(def.durationMs, -1);
	});

	it('cooldown enforced: immediate re-cast returns on_cooldown and does not refresh the dome', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;

		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'barrier_dome' });
		const result1 = await result1Promise;
		expect(result1.ok).toBe(true);

		const firstDomeUntil = player.barrierDomeUntil;

		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'barrier_dome' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);

		// Dome window was not refreshed by the rejected re-cast
		expect(player.barrierDomeUntil).toBe(firstDomeUntil);
	});
});
