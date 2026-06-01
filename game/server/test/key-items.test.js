import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	resetGameState,
	gameState,
	extractPersistentData,
	setTestProvider,
	KEY_ITEM_DEFS,
	getKeyItemDef,
	getUnlockedKeyItems,
	isEntityPositionBlocked,
	ENTITY_RADIUS,
	wallAABB,
} from '../index.js';
import { InMemoryProvider } from '../providers.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
	testGameState,
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

	it('does not persist invulnerableUntil (transient field)', () => {
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
			equippedKeyItemId: 'dodge_roll',
			invulnerableUntil: Date.now() + 99999,
		};
		gameState.players['p3'] = player;

		const persistent = extractPersistentData(player);

		expect(persistent).not.toHaveProperty('invulnerableUntil');
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

	it('useKeyItem for dodge_roll sets invulnerableUntil (i-frames)', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		// Ensure clean state
		player.keyItemCooldownUntil = 0;
		player.invulnerableUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'dodge_roll' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.invulnerableUntil).toBeGreaterThan(Date.now());
		// dodge_roll has 300ms invincibleDurationMs
		expect(player.invulnerableUntil).toBeGreaterThan(Date.now());
		expect(result.invulnerableUntil).toBe(player.invulnerableUntil);
	});

	it('useKeyItem for non-implemented items returns not_implemented', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		// Ensure no existing cooldown
		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'guard_block' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('not_implemented');

		// Cooldown should NOT have been set for not_implemented items
		expect(player.keyItemCooldownUntil).toBe(0);
	});
});

// ── summon_recall tests ──

describe('useKeyItem — summon_recall', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	/**
	 * Connect a client, enter playing phase, and set up minions for recall testing.
	 */
	async function connectWithMinions() {
		const { socket } = await connectClient(baseUrl);
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-recall' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');
		return { socket };
	}

	it('recalls two minions to new coords near the player', async () => {
		const { socket } = await connectWithMinions();
		const player = playerForSocket(socket);
		const state = testGameState();

		// Ensure cooldown is clear
		player.keyItemCooldownUntil = 0;

		// Record original minion positions (they should be far from player)
		const myMinions = state.minions.filter(m => m.ownerId === socket._playerId);
		expect(myMinions.length).toBe(2);
		const origPositions = myMinions.map(m => ({ x: m.x, z: m.z }));
		const origDistances = origPositions.map(p => Math.hypot(p.x - player.x, p.z - player.z));
		expect(origDistances[0]).toBeGreaterThan(5);
		expect(origDistances[1]).toBeGreaterThan(5);

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'summon_recall' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('summon_recall');
		expect(result.recalled).toBe(2);

		// Verify cooldown was set
		expect(player.keyItemCooldownUntil).toBeGreaterThan(Date.now());

		// Verify minions moved near the player
		const recalledMinions = state.minions.filter(m => m.ownerId === socket._playerId);
		expect(recalledMinions.length).toBe(2);
		const newDistances = recalledMinions.map(m => Math.hypot(m.x - player.x, m.z - player.z));
		for (const d of newDistances) {
			expect(d).toBeGreaterThanOrEqual(1); // at least ring radius minus tolerance
			expect(d).toBeLessThanOrEqual(5); // within a reasonable ring + fallback range
		}

		// Verify positions actually changed
		for (let i = 0; i < 2; i++) {
			expect(Math.hypot(recalledMinions[i].x - origPositions[i].x, recalledMinions[i].z - origPositions[i].z)).toBeGreaterThan(1);
		}
	});

	it('soft-fails with no_minions reason when player has no minions', async () => {
		const { socket } = await connectClient(baseUrl);
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;

		const player = playerForSocket(socket);
		player.keyItemCooldownUntil = 0;

		const state = testGameState();
		state.minions = [];

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'summon_recall' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no_minions');

		// Cooldown should NOT be burned on soft-fail
		expect(player.keyItemCooldownUntil).toBe(0);
	});

	it('only recalls own minions; other players minions are untouched', async () => {
		const { socket } = await connectWithMinions();
		const player = playerForSocket(socket);
		const state = testGameState();

		// Simulate a second player with a minion
		const otherPlayerId = 'other-player-' + Date.now();
		const otherMinion = {
			id: 'other-minion',
			ownerId: otherPlayerId,
			type: 'astral_guardian',
			x: player.x + 20,
			z: player.z + 20,
			hp: 30,
			maxHp: 30,
			maxTtl: 60,
			ttl: 60,
		};
		state.minions.push(otherMinion);

		// Record other minion position
		const otherOrigX = otherMinion.x;
		const otherOrigZ = otherMinion.z;

		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'summon_recall' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.recalled).toBe(2); // only own minions

		// Verify other player's minion is untouched
		const otherMinionAfter = state.minions.find(m => m.id === 'other-minion');
		expect(otherMinionAfter).toBeDefined();
		expect(otherMinionAfter.x).toBe(otherOrigX);
		expect(otherMinionAfter.z).toBe(otherOrigZ);
	});

	it('minions retain HP, TTL, and AI state after recall', async () => {
		const { socket } = await connectWithMinions();
		const player = playerForSocket(socket);
		const state = testGameState();

		const myMinions = state.minions.filter(m => m.ownerId === socket._playerId);
		const hpBefore = myMinions.map(m => m.hp);
		const ttlBefore = myMinions.map(m => m.ttl);

		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'summon_recall' });
		await resultPromise;

		const myMinionsAfter = state.minions.filter(m => m.ownerId === socket._playerId);
		for (let i = 0; i < myMinionsAfter.length; i++) {
			expect(myMinionsAfter[i].hp).toBe(hpBefore[i]);
			expect(myMinionsAfter[i].ttl).toBe(ttlBefore[i]);
		}
	});

	it('emits stateUpdate so clients see the teleport', async () => {
		const { socket } = await connectWithMinions();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;

		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		const keyItemPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'summon_recall' });
		await keyItemPromise;
		const snapshot = await stateUpdatePromise;

		// Snapshot should contain updated minion positions
		expect(snapshot.minions).toBeDefined();
		expect(Array.isArray(snapshot.minions)).toBe(true);
		expect(snapshot.minions.length).toBe(2);

		// Minions should be near player in the snapshot
		const snapshotPlayer = snapshot.players[socket._playerId];
		for (const m of snapshot.minions) {
			if (m.ownerId === socket._playerId) {
				const dist = Math.hypot(m.x - snapshotPlayer.x, m.z - snapshotPlayer.z);
				expect(dist).toBeLessThanOrEqual(5);
			}
		}
	});

	it('clamps minion positions away from walls when ring placement would be blocked', async () => {
		const { socket } = await connectWithMinions();
		const player = playerForSocket(socket);
		const state = testGameState();

		// Find a wall and its room in the dungeon layout
		let wall = null;
		let room = null;
		for (const r of state.layout.rooms) {
			for (const w of r.walls) {
				wall = w;
				room = r;
				break;
			}
			if (wall) break;
		}
		expect(wall).toBeTruthy();
		expect(room).toBeTruthy();

		// Record original minion positions by ID
		const myMinionsBefore = state.minions.filter(m => m.ownerId === socket._playerId);
		expect(myMinionsBefore.length).toBe(2);
		const origPositions = new Map(myMinionsBefore.map(m => [m.id, { x: m.x, z: m.z }]));

		// Position the player right next to the wall so ring positions would fall into it
		const aabb = wallAABB(wall, 0.2);
		// Determine direction from wall toward room center
		if (wall.axis === 'z') {
			const insideDir = wall.x < room.x ? 1 : -1;
			const wallEdge = insideDir > 0 ? aabb.maxX : aabb.minX;
			player.x = wallEdge + insideDir * ENTITY_RADIUS;
			player.z = wall.z;
		} else {
			const insideDir = wall.z < room.z ? 1 : -1;
			const wallEdge = insideDir > 0 ? aabb.maxZ : aabb.minZ;
			player.z = wallEdge + insideDir * ENTITY_RADIUS;
			player.x = wall.x;
		}

		// Ensure cooldown is clear
		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'summon_recall' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.recalled).toBe(2);

		// Verify all recalled minions moved and are at valid positions
		const myMinions = state.minions.filter(m => m.ownerId === socket._playerId);
		expect(myMinions.length).toBe(2);

		for (const m of myMinions) {
			const orig = origPositions.get(m.id);
			expect(orig).toBeTruthy();
			// Minion should have moved from original position
			expect(Math.hypot(m.x - orig.x, m.z - orig.z)).toBeGreaterThan(1);
			// Minion should be near player (within ring radius + fallback range)
			const dist = Math.hypot(m.x - player.x, m.z - player.z);
			expect(dist).toBeGreaterThanOrEqual(1);
			expect(dist).toBeLessThanOrEqual(7);
			// Position should not be blocked by walls
			expect(isEntityPositionBlocked(m.x, m.z, ENTITY_RADIUS)).toBe(false);
		}
	});
});
