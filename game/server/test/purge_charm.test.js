import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KEY_ITEM_DEFS } from '../index.js';
import { addDebuff } from '../simulation.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
} from './helpers.js';

// ── Def values ──

describe('Purge Charm — definition', () => {
	it('purge_charm cooldown is ~7s (7000), not 20000', () => {
		const def = KEY_ITEM_DEFS.purge_charm;
		expect(def).toBeDefined();
		expect(def.id).toBe('purge_charm');
		expect(def.cooldownMs).toBe(7000);
		expect(def.cooldownMs).not.toBe(20000);
	});
});

// ── addDebuff helper ──

describe('addDebuff helper', () => {
	it('pushes debuffs in insertion (oldest-first) order', () => {
		const player = { debuffs: [] };
		addDebuff(player, 'slow', 1000);
		addDebuff(player, 'burn', 2000);
		expect(player.debuffs).toHaveLength(2);
		expect(player.debuffs[0].type).toBe('slow');
		expect(player.debuffs[1].type).toBe('burn');
	});

	it('initializes debuffs array if missing', () => {
		const player = {};
		addDebuff(player, 'slow', 1000);
		expect(Array.isArray(player.debuffs)).toBe(true);
		expect(player.debuffs[0].type).toBe('slow');
	});
});

// ── Socket integration ──

describe('useKeyItem — purge_charm (socket integration)', () => {
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

	it('removes only the OLDEST debuff, leaves the newer one, and burns ~7s cooldown', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const def = KEY_ITEM_DEFS.purge_charm;

		// Clean state with two debuffs, oldest-first.
		player.keyItemCooldownUntil = 0;
		player.debuffs = [];
		addDebuff(player, 'slow', Date.now() + 5000);
		addDebuff(player, 'burn', Date.now() + 5000);

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'purge_charm' });
		const result = await resultPromise;

		const now = Date.now();
		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('purge_charm');
		expect(result.cleared).toBe('slow');
		expect(result.cooldownUntil).toBeGreaterThan(now);

		// Only the newer debuff remains.
		expect(player.debuffs).toHaveLength(1);
		expect(player.debuffs[0].type).toBe('burn');

		// Cooldown is set to ~7s.
		expect(player.keyItemCooldownUntil).toBeGreaterThan(now);
		expect(player.keyItemCooldownUntil - now).toBeCloseTo(def.cooldownMs, -2);
	});

	it('with no debuffs, burns cooldown and reports cleared: null (no shield)', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;
		player.debuffs = [];

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'purge_charm' });
		const result = await resultPromise;

		const now = Date.now();
		expect(result.ok).toBe(true);
		expect(result.cleared).toBeNull();
		expect(player.keyItemCooldownUntil).toBeGreaterThan(now);
	});

	it('is no longer rejected as not_implemented', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		player.keyItemCooldownUntil = 0;
		player.debuffs = [];

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'purge_charm' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.reason).not.toBe('not_implemented');
	});

	it('on-cooldown reuse is rejected with reason on_cooldown', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		player.keyItemCooldownUntil = 0;
		player.debuffs = [];

		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'purge_charm' });
		const result1 = await result1Promise;
		expect(result1.ok).toBe(true);

		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'purge_charm' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);
	});
});
