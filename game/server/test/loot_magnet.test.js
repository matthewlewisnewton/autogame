import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	computeWalkableAABBs,
	wallAABB,
	rebuildWallColliders,
	gameState,
} from '../index.js';
import { LOOT_PICKUP_RADIUS } from '../config.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
	testGameState,
} from './helpers.js';

// ── Helpers ──

async function connectAndStartRun(baseUrl) {
	const { socket } = await connectClient(baseUrl);
	const startGamePromise = waitForEvent(socket, 'startGame');
	socket.emit('playerReady', true);
	await startGamePromise;
	return { socket };
}

function buildWallColliderAABBs(layout) {
	const halfThickness = 0.2;
	const colliders = [];
	for (const room of layout.rooms) {
		for (const w of room.walls) {
			colliders.push(wallAABB(w, halfThickness));
		}
	}
	return colliders;
}

// ── Tests ──

describe('Loot Magnet — pull & collect', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	it('loot within attractRadius moves closer to player after useKeyItem', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		// Place loot 6m from player — within attractRadius (8m).
		// tryPlayerMove pulls the full distance to player (0m).
		// 0m <= LOOT_PICKUP_RADIUS (3.5m), so auto-collected.
		const loot = {
			id: 'loot-1',
			x: player.x + 6,
			z: player.z,
			y: 0,
			kind: 'gold',
			value: 10,
		};
		state.loot.push(loot);

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('loot_magnet');
		expect(result.pulled).toBe(1);
		expect(result.collected).toBe(1);
		expect(state.loot.find((l) => l.id === 'loot-1')).toBeUndefined();
	});

	it('loot within LOOT_PICKUP_RADIUS is auto-collected', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		const closeLoot = {
			id: 'close-loot',
			x: player.x + 2,
			z: player.z,
			y: 0,
			kind: 'gold',
			value: 50,
		};
		const origCurrency = player.currency;
		state.loot.push(closeLoot);

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.collected).toBe(1);
		expect(state.loot.find((l) => l.id === 'close-loot')).toBeUndefined();
		expect(player.currency).toBe(origCurrency + 50);
	});

	it('loot outside attractRadius is untouched', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		const farLoot = {
			id: 'far-loot',
			x: player.x + 15,
			z: player.z,
			y: 0,
			kind: 'gold',
			value: 100,
		};
		const origX = farLoot.x;
		const origZ = farLoot.z;
		state.loot.push(farLoot);

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(farLoot.x).toBe(origX);
		expect(farLoot.z).toBe(origZ);
		expect(state.loot.find((l) => l.id === 'far-loot')).toBeDefined();
	});

	it('already-collected loot does not error or double-credit', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		const closeLoot = {
			id: 'collect-me',
			x: player.x + 1,
			z: player.z,
			y: 0,
			kind: 'gold',
			value: 30,
		};
		state.loot.push(closeLoot);

		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result1 = await result1Promise;

		expect(result1.ok).toBe(true);
		expect(result1.collected).toBe(1);
		const currencyAfterFirst = player.currency;

		player.keyItemCooldownUntil = 0;

		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(true);
		expect(result2.pulled).toBe(0);
		expect(result2.collected).toBe(0);
		expect(player.currency).toBe(currencyAfterFirst);
	});

	it('second use within cooldown returns on_cooldown', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result1 = await result1Promise;

		expect(result1.ok).toBe(true);

		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);
		expect(result2.remainingMs).toBeCloseTo(8000, -1);
	});

	it('response contains pulled and collected counts matching expected values', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		state.loot.push(
			{ id: 'loot-1m', x: player.x + 1, z: player.z, y: 0, kind: 'gold', value: 10 },
			{ id: 'loot-4m', x: player.x + 4, z: player.z, y: 0, kind: 'gold', value: 20 },
			{ id: 'loot-7m', x: player.x + 7, z: player.z, y: 0, kind: 'gold', value: 30 },
			{ id: 'loot-12m', x: player.x + 12, z: player.z, y: 0, kind: 'gold', value: 40 },
		);

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.pulled).toBe(3);
		expect(result.collected).toBe(3);
		expect(state.loot.find((l) => l.id === 'loot-12m')).toBeDefined();
	});

	it('loot pulled through a wall stops at the wall boundary', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		// Custom layout: single room with a horizontal wall between player and loot.
		// Room: center=(0,0), width=20, depth=12. Interior: x in [-10, 10], z in [-6, 6].
		// Inner wall: axis='x', x=5, z=3, length=8. Spans x in [1, 9] at z=3.
		// Wall AABB (halfThickness=0.2): minX=0.8, maxX=9.2, minZ=2.8, maxZ=3.2.
		//
		// Player at (0, 0). Loot at (5, 5). Distance ~ 7.07 <= 8 (attractRadius).
		// Wall at z=3 is between player and loot (in z).
		//
		// tryPlayerMove uses axis-separated sliding:
		// - Direct (5,5)->(0,0): crosses wall at z=3, blocked
		// - X-slide (5,5)->(0,5): z=5 clears wall (wall maxZ=3.2), succeeds
		// - Loot moves to (0, 5). Did NOT cross wall line z=3.
		// - Final distance: 5 > LOOT_PICKUP_RADIUS (3.5). Not collected.

		const layout = {
			rooms: [{
				x: 0, z: 0, width: 20, depth: 12,
				walls: [
					{ x: 0, z: -6, length: 20, axis: 'x' },
					{ x: 0, z: 6, length: 20, axis: 'x' },
					{ x: -10, z: 0, length: 12, axis: 'z' },
					{ x: 10, z: 0, length: 12, axis: 'z' },
					{ x: 5, z: 3, length: 8, axis: 'x' }, // inner wall between player and loot
				],
			}],
			passages: [],
		};

		state.layout = layout;
		state.walkableAABBs = computeWalkableAABBs(layout);
		state.dungeonBounds = { minX: -11, maxX: 11, minZ: -7, maxZ: 7 };
		gameState.dungeonBounds = state.dungeonBounds;
		rebuildWallColliders();

		// Verify inner wall collider exists at z=3
		const colliders = buildWallColliderAABBs(layout);
		const innerWall = colliders.find((c) => c.minZ === 2.8);
		expect(innerWall).toBeDefined();

		// Position player and loot
		player.x = 0;
		player.z = 0;

		const loot = {
			id: 'wall-loot',
			x: 5,
			z: 5,
			y: 0,
			kind: 'gold',
			value: 10,
		};
		state.loot.length = 0;
		state.loot.push(loot);

		const dist = Math.hypot(loot.x - player.x, loot.z - player.z);
		expect(dist).toBeCloseTo(7.07, 1); // within attractRadius (8m)

		const origLootX = loot.x;
		const origLootZ = loot.z;

		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.pulled).toBe(1);

		// Loot moved toward player (x went from 5 toward 0)
		expect(loot.x).toBeLessThan(origLootX);

		// Loot did NOT cross wall line (wall maxZ=3.2)
		expect(loot.z).toBeGreaterThan(3.2);

		// Loot NOT collected — beyond pickup radius from player
		const finalDist = Math.hypot(loot.x - player.x, loot.z - player.z);
		expect(finalDist).toBeGreaterThan(LOOT_PICKUP_RADIUS);
		expect(state.loot.find((l) => l.id === 'wall-loot')).toBeDefined();
		expect(result.collected).toBe(0);
	});
});
