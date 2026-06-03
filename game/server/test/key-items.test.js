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
	MAX_MAGIC_STONES,
} from '../index.js';
import { setGameState as setSimGameState, processPendingEchoes, updateMinions } from '../simulation.js';
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

	it('useKeyItem is rejected when player is dead with dead reason', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.dead = true;
		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'dodge_roll' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('dead');
		expect(player.keyItemCooldownUntil).toBe(0);
	});

	it('useKeyItem is rejected when player is extracted with extracted reason', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.extracted = true;
		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'dodge_roll' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('extracted');
		expect(player.keyItemCooldownUntil).toBe(0);
	});

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
		socket.emit('useKeyItem', { keyItemId: 'ground_anchor' });
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

// ── flare_beacon tests ──

describe('useKeyItem — flare_beacon', () => {
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
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		return { socket };
	}

	it('KEY_ITEM_DEFS.flare_beacon has correct parameters', () => {
		const def = KEY_ITEM_DEFS.flare_beacon;
		expect(def).toBeDefined();
		expect(def.id).toBe('flare_beacon');
		expect(def.cooldownMs).toBe(10000);
		expect(def.revealRadius).toBe(25);
		expect(def.revealDurationMs).toBe(3000);
		expect(def.type).toBe('utility');
	});

	it('reveals living enemies within radius and sets revealedUntil', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const state = testGameState();

		// Ensure clean state
		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;

		// Add test enemies: one within radius, one outside
		const nearEnemy = {
			id: 'near-enemy',
			type: 'grunt',
			x: player.x + 5,
			z: player.z + 5,
			y: 0.5,
			hp: 50,
			maxHp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: player.x + 5, z: player.z + 5 },
		};
		const farEnemy = {
			id: 'far-enemy',
			type: 'grunt',
			x: player.x + 30,
			z: player.z + 30,
			y: 0.5,
			hp: 50,
			maxHp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: player.x + 30, z: player.z + 30 },
		};
		state.enemies.push(nearEnemy, farEnemy);

		const before = Date.now();
		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result = await resultPromise;
		const after = Date.now();

		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('flare_beacon');
		expect(result.revealed).toBe(1);
		expect(result.cooldownUntil).toBeGreaterThan(Date.now());

		// Near enemy should have revealedUntil set
		expect(nearEnemy.revealedUntil).toBeDefined();
		expect(nearEnemy.revealedUntil).toBeGreaterThanOrEqual(before + 3000);
		expect(nearEnemy.revealedUntil).toBeLessThanOrEqual(after + 3000);

		// Far enemy should NOT have revealedUntil
		expect(farEnemy.revealedUntil).toBeUndefined();

		// Cooldown should be set
		expect(player.keyItemCooldownUntil).toBeGreaterThan(Date.now());
	});

	it('does not reveal dead enemies', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;

		// Add a dead enemy within radius
		const deadEnemy = {
			id: 'dead-enemy',
			type: 'grunt',
			x: player.x + 3,
			z: player.z + 3,
			y: 0.5,
			hp: 0,
			maxHp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z + 3 },
		};
		state.enemies.push(deadEnemy);

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.revealed).toBe(0);
		expect(deadEnemy.revealedUntil).toBeUndefined();
	});

	it('cooldown enforced: second use within 10s returns on_cooldown', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;

		// Add an enemy to reveal
		state.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: player.x + 5,
			z: player.z + 5,
			y: 0.5,
			hp: 50,
			maxHp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: player.x + 5, z: player.z + 5 },
		});

		// First use
		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result1 = await result1Promise;

		expect(result1.ok).toBe(true);

		// Immediate second use
		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);
		// flare_beacon has 10000ms cooldown
		expect(result2.remainingMs).toBeCloseTo(10000, -1); // within factor of 10
	});

	it('emits stateUpdate with revealedUntil in enemy data', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;

		state.enemies.push({
			id: 'reveal-me',
			type: 'grunt',
			x: player.x + 10,
			z: player.z + 10,
			y: 0.5,
			hp: 50,
			maxHp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: player.x + 10, z: player.z + 10 },
		});

		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		const keyItemPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		await keyItemPromise;
		const snapshot = await stateUpdatePromise;

		// Snapshot should contain the enemy with revealedUntil
		const enemyInSnapshot = snapshot.enemies.find(e => e.id === 'reveal-me');
		expect(enemyInSnapshot).toBeDefined();
		expect(enemyInSnapshot.revealedUntil).toBeGreaterThan(Date.now() - 1000); // within 1s tolerance
	});

	it('reveals all living enemies within radius', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;

		// Add multiple enemies within radius at various distances
		const enemies = [];
		for (let i = 0; i < 5; i++) {
			const angle = (2 * Math.PI * i) / 5;
			const dist = 5 + i * 4; // 5, 9, 13, 17, 21 — all within 25
			const ex = player.x + Math.cos(angle) * dist;
			const ez = player.z + Math.sin(angle) * dist;
			enemies.push({
				id: `enemy-${i}`,
				type: 'grunt',
				x: ex,
				z: ez,
				y: 0.5,
				hp: 50,
				maxHp: 50,
				state: 'idle',
				attackState: 'idle',
				wanderTarget: { x: ex, z: ez },
			});
		}
		state.enemies.push(...enemies);

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.revealed).toBe(5);

		// All enemies should have revealedUntil
		for (const e of enemies) {
			expect(e.revealedUntil).toBeDefined();
			expect(e.revealedUntil).toBeGreaterThan(Date.now() - 1000);
		}
	});

	it('enemies exactly at radius boundary are revealed', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.enemies.length = 0;

		// Enemy exactly at 25m distance
		const boundaryEnemy = {
			id: 'boundary-enemy',
			type: 'grunt',
			x: player.x + 25,
			z: player.z,
			y: 0.5,
			hp: 50,
			maxHp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: player.x + 25, z: player.z },
		};
		state.enemies.push(boundaryEnemy);

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'flare_beacon' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.revealed).toBe(1);
		expect(boundaryEnemy.revealedUntil).toBeDefined();
	});

	describe('revealedUntil tick cleanup (updateMinions)', () => {
		afterEach(() => {
			setSimGameState(null, null);
		});

		it('clears revealedUntil when the timestamp is in the past', () => {
			const expiredEnemy = {
				id: 'expired-enemy',
				type: 'grunt',
				x: 0,
				z: 0,
				hp: 50,
				revealedUntil: Date.now() - 1000,
			};
			const state = { enemies: [expiredEnemy], minions: [], players: {} };
			setSimGameState(state, {});

			updateMinions();

			expect(expiredEnemy.revealedUntil).toBeUndefined();
		});

		it('retains revealedUntil when the timestamp is still in the future', () => {
			const futureUntil = Date.now() + 5000;
			const activeEnemy = {
				id: 'active-enemy',
				type: 'grunt',
				x: 0,
				z: 0,
				hp: 50,
				revealedUntil: futureUntil,
			};
			const state = { enemies: [activeEnemy], minions: [], players: {} };
			setSimGameState(state, {});

			updateMinions();

			expect(activeEnemy.revealedUntil).toBe(futureUntil);
		});
	});
});

// ── echo_strike tests ──

describe('useKeyItem — echo_strike', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	async function connectAndStartRun() {
		const { socket } = await connectClient(baseUrl);
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		return { socket };
	}

	it('KEY_ITEM_DEFS.echo_strike has 10s cooldown and echoFraction', () => {
		const def = KEY_ITEM_DEFS.echo_strike;
		expect(def).toBeDefined();
		expect(def.id).toBe('echo_strike');
		expect(def.name).toBe('Echo Strike');
		expect(def.cooldownMs).toBe(10000);
		expect(def.echoFraction).toBe(0.5);
		expect(def.type).toBe('offensive');
		// Old radial-burst fields should be gone
		expect(def.radius).toBeUndefined();
		expect(def.damage).toBeUndefined();
		// Description reflects the new echo behaviour, not a radial burst
		expect(def.description).not.toMatch(/radial|burst/i);
		expect(def.description).toMatch(/echo|second/i);
	});

	it('activation arms echoStrikePending and burns the 10s cooldown', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;
		player.echoStrikePending = false;

		const before = Date.now();
		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'echo_strike' });
		const result = await resultPromise;
		const after = Date.now();

		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('echo_strike');
		expect(result.echoStrikePending).toBe(true);
		expect(result.cooldownUntil).toBeGreaterThan(Date.now());

		// Player state mutated as expected
		expect(player.echoStrikePending).toBe(true);
		expect(player.keyItemCooldownUntil).toBe(result.cooldownUntil);
		// cooldownUntil ≈ now + 10000
		expect(player.keyItemCooldownUntil).toBeGreaterThanOrEqual(before + 10000);
		expect(player.keyItemCooldownUntil).toBeLessThanOrEqual(after + 10000);
	});

	it('second immediate use returns on_cooldown with remainingMs > 0', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;

		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'echo_strike' });
		const result1 = await result1Promise;
		expect(result1.ok).toBe(true);

		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'echo_strike' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);
		expect(result2.remainingMs).toBeCloseTo(10000, -1);
	});

	it('emits stateUpdate after a successful activation', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;

		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		const keyItemPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'echo_strike' });
		await keyItemPromise;
		const snapshot = await stateUpdatePromise;

		expect(snapshot).toBeDefined();
		expect(snapshot.players).toBeDefined();
	});

	it('echoStrikePending is transient — excluded from extractPersistentData', () => {
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
			equippedKeyItemId: 'echo_strike',
			echoStrikePending: true,
		};
		gameState.players['echo-p1'] = player;

		const persistent = extractPersistentData(player);

		expect(persistent).not.toHaveProperty('echoStrikePending');
	});
});

// ── echo_strike — delayed weapon echo (sub-ticket 02) ──

describe('echo_strike — weapon echo', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	async function connectAndStartRun() {
		const { socket } = await connectClient(baseUrl);
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		return { socket };
	}

	/**
	 * Put the player at the origin facing +x with a fresh weapon card in slot 0
	 * and a single tanky enemy 2m straight ahead (within attack range).
	 */
	function setupWeaponAndEnemy(socket, { hp = 500 } = {}) {
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		player.slotCooldowns = new Array(player.hand.length).fill(null);
		player.x = 0;
		player.z = 0;
		player.rotation = 0;
		player.hand[0] = {
			id: 'iron_sword',
			name: 'Rust-Forged Saber',
			type: 'weapon',
			damage: 17,
			charges: 5,
			remainingCharges: 5,
		};

		state.enemies.length = 0;
		state.pendingEchoes = [];
		const enemy = {
			id: 'echo-target',
			type: 'grunt',
			x: 2,
			z: 0,
			y: 0.5,
			hp,
			maxHp: hp,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 2, z: 0 },
		};
		state.enemies.push(enemy);
		return { player, state, enemy };
	}

	it('armed weapon hit deals primary damage immediately and enqueues a 50% echo', async () => {
		const { socket } = await connectAndStartRun();
		const { player, state, enemy } = setupWeaponAndEnemy(socket);

		player.echoStrikePending = true;

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { slotIndex: 0, cardId: 'iron_sword', rotation: 0 });
		await cardUsedPromise;

		// Primary hit applied synchronously (17 damage).
		expect(enemy.hp).toBe(500 - 17);
		// Flag consumed by the one weapon use.
		expect(player.echoStrikePending).toBe(false);
		// One pending echo enqueued for the struck enemy at 50% (round(17*0.5)=9).
		expect(state.pendingEchoes).toHaveLength(1);
		const echo = state.pendingEchoes[0];
		expect(echo.attackerId).toBe(socket._playerId);
		expect(echo.targets).toEqual([{ enemyId: 'echo-target', damage: 9 }]);
		expect(echo.applyAt).toBeGreaterThan(Date.now());
	});

	it('processPendingEchoes applies the delayed second packet to the same enemy', async () => {
		const { socket } = await connectAndStartRun();
		const { player, state, enemy } = setupWeaponAndEnemy(socket);

		player.echoStrikePending = true;

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { slotIndex: 0, cardId: 'iron_sword', rotation: 0 });
		await cardUsedPromise;

		expect(enemy.hp).toBe(500 - 17);
		expect(state.pendingEchoes).toHaveLength(1);

		// Point the exported tick helper at this lobby's state (the live game loop
		// restores _gameState to the global state between ticks). Pin the echo far
		// out so the running loop can't apply it under us while we assert the no-op.
		setSimGameState(state, {});
		state.pendingEchoes[0].applyAt = Date.now() + 100000;
		processPendingEchoes();
		expect(enemy.hp).toBe(500 - 17);
		expect(state.pendingEchoes).toHaveLength(1);

		// Drive the delay: make it due, then process.
		state.pendingEchoes[0].applyAt = Date.now() - 1;
		processPendingEchoes();

		// Second packet (9) landed → two total damage events on the target.
		expect(enemy.hp).toBe(500 - 17 - 9);
		expect(enemy.lastDamagedBy).toBe(socket._playerId);
		// Applied entry dropped.
		expect(state.pendingEchoes).toHaveLength(0);
	});

	it('a second weapon use is not re-armed and produces only one packet', async () => {
		const { socket } = await connectAndStartRun();
		const { player, state, enemy } = setupWeaponAndEnemy(socket);

		player.echoStrikePending = true;

		// First (armed) use.
		const firstPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { slotIndex: 0, cardId: 'iron_sword', rotation: 0 });
		await firstPromise;
		expect(state.pendingEchoes).toHaveLength(1);
		expect(player.echoStrikePending).toBe(false);

		// Flush the first echo via the exported tick helper (pointed at this lobby).
		setSimGameState(state, {});
		state.pendingEchoes[0].applyAt = Date.now() - 1;
		processPendingEchoes();
		expect(state.pendingEchoes).toHaveLength(0);
		const hpAfterFirst = enemy.hp; // 500 - 17 - 9 = 474

		// Clear slot cooldown for the second swing.
		player.slotCooldowns = new Array(player.hand.length).fill(null);

		const secondPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { slotIndex: 0, cardId: 'iron_sword', rotation: 0 });
		await secondPromise;

		// Only the primary packet — no new echo enqueued.
		expect(enemy.hp).toBe(hpAfterFirst - 17);
		expect(state.pendingEchoes).toHaveLength(0);

		// Even after processing, no echo lands.
		processPendingEchoes();
		expect(enemy.hp).toBe(hpAfterFirst - 17);
	});

	it('a spell use leaves the flag armed and enqueues no echo', async () => {
		const { socket } = await connectAndStartRun();
		const { player, state, enemy } = setupWeaponAndEnemy(socket);

		player.echoStrikePending = true;
		player.magicStones = MAX_MAGIC_STONES;
		// Put a damage spell in slot 0.
		player.hand[0] = {
			id: 'frost_nova',
			name: 'Cryo Burst',
			type: 'spell',
			charges: 1,
			remainingCharges: 1,
			magicStoneCost: 35,
		};

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { slotIndex: 0, cardId: 'frost_nova', rotation: 0 });
		await cardUsedPromise;

		// Spell damaged the enemy but did NOT consume the flag or enqueue an echo.
		expect(player.echoStrikePending).toBe(true);
		expect(state.pendingEchoes).toHaveLength(0);

		processPendingEchoes();
		expect(state.pendingEchoes).toHaveLength(0);
	});

	it('echo is consumed even when the armed swing hits nothing', async () => {
		const { socket } = await connectAndStartRun();
		const { player, state } = setupWeaponAndEnemy(socket);

		// Move the lone enemy far out of range so the swing misses.
		state.enemies[0].x = 100;
		state.enemies[0].z = 100;
		state.enemies[0].wanderTarget = { x: 100, z: 100 };

		player.echoStrikePending = true;

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { slotIndex: 0, cardId: 'iron_sword', rotation: 0 });
		await cardUsedPromise;

		// Flag consumed, but nothing was struck so no echo is enqueued.
		expect(player.echoStrikePending).toBe(false);
		expect(state.pendingEchoes).toHaveLength(0);
	});
});
