import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	resetGameState,
	gameState,
	extractPersistentData,
	setTestProvider,
	KEY_ITEM_DEFS,
	getKeyItemDef,
	getUnlockedKeyItems,
} from '../index.js';
import { InMemoryProvider } from '../providers.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
} from './helpers.js';

describe('getUnlockedKeyItems()', () => {
	it('returns all 14 key item definitions', () => {
		const items = getUnlockedKeyItems();
		expect(items).toHaveLength(14);
		expect(items.map((item) => item.id)).toEqual(expect.arrayContaining([
			'dodge_roll',
			'summon_recall',
			'field_medic_kit',
			'guard_block',
			'flare_beacon',
			'loot_magnet',
			'overclock',
			'smoke_bomb',
			'ground_anchor',
			'phase_step',
			'purge_charm',
			'echo_strike',
			'barrier_dome',
			'rally_cry',
		]));
	});
});

describe('getKeyItemDef()', () => {
	it('returns the definition for a known key item ID', () => {
		const def = getKeyItemDef('dodge_roll');
		expect(def).toBeDefined();
		expect(def.id).toBe('dodge_roll');
		expect(def.cooldownMs).toBe(800);
		expect(def.type).toBe('movement');
	});

	it('returns undefined for an unknown key item ID', () => {
		expect(getKeyItemDef('nonexistent_item')).toBeUndefined();
	});
});

describe('extractPersistentData — key item persistence', () => {
	beforeEach(() => {
		resetGameState();
	});

	it('equipped key item persists through extractPersistentData / restore cycle', () => {
		const player = {
			x: 0,
			y: 0.5,
			z: 0,
			rotation: 0,
			currency: 0,
			inventory: [],
			ownedCards: {},
			selectedDeck: [],
			hp: 100,
			dead: false,
			equippedKeyItemId: 'summon_recall',
			keyItemCooldownUntil: Date.now() + 99999, // transient, should NOT persist
		};
		gameState.players['p1'] = player;

		const persistent = extractPersistentData(player);

		expect(persistent.equippedKeyItemId).toBe('summon_recall');
		expect(persistent).not.toHaveProperty('keyItemCooldownUntil');
	});

	it('defaults equippedKeyItemId to dodge_roll when missing', () => {
		const player = {
			x: 0,
			y: 0.5,
			z: 0,
			rotation: 0,
			currency: 0,
			inventory: [],
			ownedCards: {},
			selectedDeck: [],
		};
		gameState.players['p2'] = player;

		const persistent = extractPersistentData(player);

		expect(persistent.equippedKeyItemId).toBe('dodge_roll');
	});
});

// ── Socket handler tests ──

describe('equipKeyItem socket handler', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	it('equipping a valid key item sets player.equippedKeyItemId', async () => {
		const { socket } = await connectClient(baseUrl);

		const equippedPromise = waitForEvent(socket, 'keyItemEquipped');
		socket.emit('equipKeyItem', { keyItemId: 'dodge_roll' });
		const equipped = await equippedPromise;

		expect(equipped.keyItemId).toBe('dodge_roll');
		const player = playerForSocket(socket);
		expect(player.equippedKeyItemId).toBe('dodge_roll');
	});

	it('equipping an unknown key item ID is rejected with keyItemError', async () => {
		const { socket } = await connectClient(baseUrl);

		const errorPromise = waitForEvent(socket, 'keyItemError');
		socket.emit('equipKeyItem', { keyItemId: 'nonexistent_item' });
		const error = await errorPromise;

		expect(error.reason).toBe('unknown_item');
		const player = playerForSocket(socket);
		// equippedKeyItemId should remain at default, not change
		expect(player.equippedKeyItemId).not.toBe('nonexistent_item');
	});
});

describe('useKeyItem socket handler', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	/**
	 * Connect a client and start a dungeon run so we're in 'playing' phase.
	 */
	async function connectAndStartRun() {
		const { socket } = await connectClient(baseUrl);
		// Single player ready-up triggers checkAllReady → playing phase
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		return { socket };
	}

	it('useKeyItem is rejected when on cooldown with on_cooldown reason', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		// Manually set cooldown to simulate active cooldown
		player.keyItemCooldownUntil = Date.now() + 10000;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'dodge_roll' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('on_cooldown');
		expect(result.remainingMs).toBeGreaterThan(0);
	});

	it('useKeyItem is rejected for unknown key item ID with unknown_item reason', async () => {
		const { socket } = await connectAndStartRun();

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'nonexistent_item' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('unknown_item');
	});

	it('useKeyItem for dodge_roll sets keyItemCooldownUntil to a future timestamp', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		// Ensure no existing cooldown
		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'dodge_roll' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('dodge_roll');
		expect(result.cooldownUntil).toBeGreaterThan(Date.now());

		// Verify the player's cooldown was actually set
		expect(player.keyItemCooldownUntil).toBeGreaterThan(Date.now());
		// dodge_roll has 800ms cooldown
		expect(player.keyItemCooldownUntil - result.cooldownUntil).toBe(0);
	});

	it('useKeyItem for non-dodge_roll items returns not_implemented', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		// Ensure no existing cooldown
		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'summon_recall' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('not_implemented');

		// Cooldown should NOT have been set for not_implemented items
		expect(player.keyItemCooldownUntil).toBe(0);
	});
});
