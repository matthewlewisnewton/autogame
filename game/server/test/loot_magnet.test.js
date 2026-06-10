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
	lobbyStateForSocket,
} from './helpers.js';

// ── Helpers ──

/** Test loot must include createdAt or runGameLoopTick purges it (NaN lifetime). */
function testLoot(overrides) {
	return {
		y: 0,
		kind: 'gold',
		createdAt: Date.now(),
		...overrides,
	};
}

/**
 * Wait for a loot_magnet keyItemUsed emit. Filters stale/wrong payloads that can
 * arrive when the game loop or parallel suites interleave socket events.
 */
function waitForLootMagnetUsed(socket, timeout = 15000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error('Timed out waiting for loot_magnet keyItemUsed')),
			timeout
		);
		const onUsed = (payload) => {
			if (payload?.keyItemId !== 'loot_magnet') return;
			clearTimeout(timer);
			socket.off('keyItemUsed', onUsed);
			resolve(payload);
		};
		socket.on('keyItemUsed', onUsed);
	});
}

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

	it('loot at 6m within attractRadius (8m) is pulled to the player and auto-collected', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = lobbyStateForSocket(socket);

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		// Loot 6m away — inside attractRadius (8m). useKeyItem (loot_magnet) does an
		// instant full pull to the player (0m separation). That is within
		// LOOT_PICKUP_RADIUS (3.5m), so the server auto-collects and removes the drop.
		// Partial pull without collection (e.g. wall-blocked) is covered below.
		const loot = testLoot({
			id: 'loot-1',
			x: player.x + 6,
			z: player.z,
			value: 10,
		});
		state.loot.push(loot);
		const origCurrency = player.currency;

		let lootCollectedInHandler;
		const resultPromise = new Promise((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error('Timed out waiting for loot_magnet keyItemUsed')),
				15000
			);
			socket.once('keyItemUsed', (payload) => {
				clearTimeout(timer);
				// Capture authoritative state in the emit handler before the next tick.
				lootCollectedInHandler =
					state.loot.find((l) => l.id === 'loot-1') === undefined;
				resolve(payload);
			});
		});
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('loot_magnet');
		expect(result.pulled).toBe(1);
		expect(result.collected).toBe(1);
		expect(lootCollectedInHandler).toBe(true);
		expect(state.loot.find((l) => l.id === 'loot-1')).toBeUndefined();
		expect(player.currency).toBe(origCurrency + 10);
	});

	it('loot within LOOT_PICKUP_RADIUS is auto-collected', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = lobbyStateForSocket(socket);

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		const closeLoot = testLoot({
			id: 'close-loot',
			x: player.x + 2,
			z: player.z,
			value: 50,
		});
		const origCurrency = player.currency;
		state.loot.push(closeLoot);

		const resultPromise = waitForLootMagnetUsed(socket);
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
		const state = lobbyStateForSocket(socket);

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		const farLoot = testLoot({
			id: 'far-loot',
			x: player.x + 15,
			z: player.z,
			value: 100,
		});
		const origX = farLoot.x;
		const origZ = farLoot.z;
		state.loot.push(farLoot);

		const resultPromise = waitForLootMagnetUsed(socket);
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
		const state = lobbyStateForSocket(socket);

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		const closeLoot = testLoot({
			id: 'collect-me',
			x: player.x + 1,
			z: player.z,
			value: 30,
		});
		state.loot.push(closeLoot);

		const result1Promise = waitForLootMagnetUsed(socket);
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result1 = await result1Promise;

		expect(result1.ok).toBe(true);
		expect(result1.collected).toBe(1);
		const currencyAfterFirst = player.currency;

		player.keyItemCooldownUntil = 0;

		const result2Promise = waitForLootMagnetUsed(socket);
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
		const state = lobbyStateForSocket(socket);

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		const result1Promise = waitForLootMagnetUsed(socket);
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result1 = await result1Promise;

		expect(result1.ok).toBe(true);

		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);
		// Allow ~50ms elapsed between the two emits (parallel suite / slow CI).
		expect(result2.remainingMs).toBeCloseTo(8000, -2);
	});

	it('response contains pulled and collected counts matching expected values', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = lobbyStateForSocket(socket);

		player.keyItemCooldownUntil = 0;
		state.loot.length = 0;

		state.loot.push(
			testLoot({ id: 'loot-1m', x: player.x + 1, z: player.z, value: 10 }),
			testLoot({ id: 'loot-4m', x: player.x + 4, z: player.z, value: 20 }),
			testLoot({ id: 'loot-7m', x: player.x + 7, z: player.z, value: 30 }),
			testLoot({ id: 'loot-12m', x: player.x + 12, z: player.z, value: 40 }),
		);

		const resultPromise = waitForLootMagnetUsed(socket);
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
		const state = lobbyStateForSocket(socket);

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

		const loot = testLoot({
			id: 'wall-loot',
			x: 5,
			z: 5,
			value: 10,
		});
		state.loot.length = 0;
		state.loot.push(loot);

		const dist = Math.hypot(loot.x - player.x, loot.z - player.z);
		expect(dist).toBeCloseTo(7.07, 1); // within attractRadius (8m)

		const origLootX = loot.x;
		const origLootZ = loot.z;

		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForLootMagnetUsed(socket);
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

	it('loot at same XZ with small vertical offset within attractRadius is collected', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = lobbyStateForSocket(socket);

		player.keyItemCooldownUntil = 0;
		player.y = 0;
		state.loot.length = 0;

		const loot = testLoot({
			id: 'vertical-close',
			x: player.x,
			z: player.z,
			y: 2,
			value: 42,
		});
		const origCurrency = player.currency;
		state.loot.push(loot);

		const resultPromise = waitForLootMagnetUsed(socket);
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.pulled).toBe(1);
		expect(result.collected).toBe(1);
		expect(state.loot.find((l) => l.id === 'vertical-close')).toBeUndefined();
		expect(player.currency).toBe(origCurrency + 42);
	});

	it('loot at same XZ with large vertical offset outside attractRadius is untouched', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = lobbyStateForSocket(socket);

		player.keyItemCooldownUntil = 0;
		player.y = 0;
		state.loot.length = 0;

		const loot = testLoot({
			id: 'vertical-far',
			x: player.x,
			z: player.z,
			y: 10,
			value: 99,
		});
		const origY = loot.y;
		state.loot.push(loot);

		const resultPromise = waitForLootMagnetUsed(socket);
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.pulled).toBe(0);
		expect(result.collected).toBe(0);
		expect(loot.y).toBe(origY);
		expect(state.loot.find((l) => l.id === 'vertical-far')).toBeDefined();
	});

	it('loot within horizontal attract range but outside 3D attract sphere is untouched', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = lobbyStateForSocket(socket);

		player.keyItemCooldownUntil = 0;
		player.y = 0;
		state.loot.length = 0;

		// XZ distance 7m (inside flat 8m attract), but 3D distance sqrt(7^2 + 4^2) ≈ 8.06m.
		const loot = testLoot({
			id: 'sphere-edge',
			x: player.x + 7,
			z: player.z,
			y: 4,
			value: 55,
		});
		const origX = loot.x;
		const origZ = loot.z;
		state.loot.push(loot);

		const resultPromise = waitForLootMagnetUsed(socket);
		socket.emit('useKeyItem', { keyItemId: 'loot_magnet' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.pulled).toBe(0);
		expect(result.collected).toBe(0);
		expect(loot.x).toBe(origX);
		expect(loot.z).toBe(origZ);
		expect(state.loot.find((l) => l.id === 'sphere-edge')).toBeDefined();
	});
});
