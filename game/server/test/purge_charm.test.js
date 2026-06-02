import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KEY_ITEM_DEFS, damagePlayer, gameState, resetGameState } from '../index.js';
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

	it('with no debuffs, grants a one-hit shield (shieldHitsRemaining = 1) and burns cooldown', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;
		player.debuffs = [];
		player.shieldHitsRemaining = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'purge_charm' });
		const result = await resultPromise;

		const now = Date.now();
		expect(result.ok).toBe(true);
		expect(result.shielded).toBe(true);
		expect(result.cooldownUntil).toBeGreaterThan(now);
		expect(player.shieldHitsRemaining).toBe(1);
		expect(player.keyItemCooldownUntil).toBeGreaterThan(now);
	});

	it('with a debuff, clears it WITHOUT granting a shield', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;
		player.debuffs = [];
		player.shieldHitsRemaining = 0;
		addDebuff(player, 'slow', Date.now() + 5000);

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'purge_charm' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.cleared).toBe('slow');
		expect(result.shielded).toBeUndefined();
		expect(player.shieldHitsRemaining).toBe(0); // no shield granted
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

// ── One-hit shield absorption in damagePlayer ──

describe('damagePlayer — purge_charm one-hit shield (shieldHitsRemaining)', () => {
	beforeEach(() => {
		resetGameState();
	});

	function addShieldedPlayer(overrides = {}) {
		gameState.players['p1'] = {
			x: 0, y: 0.5, z: 0, rotation: 0,
			hp: 100, dead: false,
			lastActivity: Date.now(),
			...overrides,
		};
		return gameState.players['p1'];
	}

	it('fully absorbs the next hit and decrements shieldHitsRemaining to 0', () => {
		const player = addShieldedPlayer({ shieldHitsRemaining: 1 });
		const result = damagePlayer('p1', 40);
		expect(result).toBeNull();
		expect(player.hp).toBe(100); // HP untouched
		expect(player.shieldHitsRemaining).toBe(0); // shield consumed
	});

	it('absorbs the FULL hit regardless of damage amount (hit-based, not HP-based)', () => {
		const player = addShieldedPlayer({ shieldHitsRemaining: 1 });
		damagePlayer('p1', 9999);
		expect(player.hp).toBe(100);
		expect(player.shieldHitsRemaining).toBe(0);
	});

	it('a second hit after the shield is consumed reduces HP normally', () => {
		const player = addShieldedPlayer({ shieldHitsRemaining: 1 });
		damagePlayer('p1', 30); // absorbed
		expect(player.hp).toBe(100);
		damagePlayer('p1', 30); // shield gone → normal damage
		expect(player.hp).toBe(70);
		expect(player.shieldHitsRemaining).toBe(0);
	});

	it('does not interfere with normal damage when shieldHitsRemaining is undefined', () => {
		const player = addShieldedPlayer();
		damagePlayer('p1', 25);
		expect(player.hp).toBe(75);
	});
});
