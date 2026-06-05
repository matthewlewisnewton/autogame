import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	HUB_LAYOUT,
	isInsideDungeon,
	PLAYER_RADIUS,
	wallAABB,
} from '../index.js';
import {
	computeDungeonBounds,
	computeWalkableAABBs,
	buildHubMovementContext,
	hubSpawnPosition,
	checkWallCollision,
} from '../simulation.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	testGameState,
} from './helpers.js';

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function hubMovementContext() {
	return buildHubMovementContext(HUB_LAYOUT);
}

function hubSpawn() {
	return hubSpawnPosition(HUB_LAYOUT);
}

function assertPlayerWithinHub(player) {
	const bounds = computeDungeonBounds(HUB_LAYOUT);
	const ctx = hubMovementContext();
	expect(player.x).toBeGreaterThanOrEqual(bounds.minX);
	expect(player.x).toBeLessThanOrEqual(bounds.maxX);
	expect(player.z).toBeGreaterThanOrEqual(bounds.minZ);
	expect(player.z).toBeLessThanOrEqual(bounds.maxZ);
	expect(isInsideDungeon(player.x, player.z, ctx)).toBe(true);
}

function assertPlayerNotInHubWall(player) {
	const ctx = hubMovementContext();
	expect(checkWallCollision(player.x, player.z, ctx.colliders, PLAYER_RADIUS)).toBe(false);
}

function findHubWallProbe() {
	for (const room of HUB_LAYOUT.rooms) {
		for (const wall of room.walls) {
			if (wall.axis !== 'z') continue;

			const aabb = wallAABB(wall, 0.2);
			const insideDirection = wall.x < room.x ? 1 : -1;
			const floorEdgeX = insideDirection > 0
				? aabb.maxX + PLAYER_RADIUS
				: aabb.minX - PLAYER_RADIUS;

			return {
				x: floorEdgeX + insideDirection * 0.4,
				z: wall.z,
				dx: -insideDirection,
				floorEdgeX,
				insideDirection,
			};
		}
	}
	return null;
}

describe('lobby hub movement', () => {
	let baseUrl;
	let socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
		expect(testGameState().gamePhase).toBe('lobby');
	});

	afterEach(async () => {
		if (socket?.connected) socket.disconnect();
		await closeServer();
	});

	it('accepts lobby move and updates position after a tick', async () => {
		const player = testGameState().players[socket._playerId];
		const spawn = hubSpawn();
		expect(player.x).toBeCloseTo(spawn.x, 1);
		expect(player.z).toBeCloseTo(spawn.z, 1);

		const xBefore = player.x;
		socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 1 });
		await sleep(120);

		expect(player.inputDx).toBe(1);
		expect(player.inputActive).toBe(true);
		expect(player.x).toBeGreaterThan(xBefore);
		assertPlayerWithinHub(player);
		assertPlayerNotInHubWall(player);
	});

	describe('invalid lobby moves are rejected', () => {
		it('rejects non-object payloads without changing position', async () => {
			const player = testGameState().players[socket._playerId];
			const spawn = hubSpawn();
			const seqBefore = player.lastInputSequence || 0;

			socket.emit('move', null);
			socket.emit('move', [1, 0, 0]);
			socket.emit('move', 'forward');
			await sleep(50);

			expect(player.x).toBeCloseTo(spawn.x, 5);
			expect(player.z).toBeCloseTo(spawn.z, 5);
			expect(player.lastInputSequence || 0).toBe(seqBefore);
		});

		it('rejects non-finite dx/dz/rotation without changing position', async () => {
			const player = testGameState().players[socket._playerId];
			const xBefore = player.x;
			const zBefore = player.z;
			const seqBefore = player.lastInputSequence || 0;

			socket.emit('move', { dx: NaN, dz: 0, rotation: 0 });
			socket.emit('move', { dx: 1, dz: Infinity, rotation: 0 });
			socket.emit('move', { dx: 0, dz: 0, rotation: Number.POSITIVE_INFINITY });
			socket.emit('move', { dx: 'left', dz: 0, rotation: 0 });
			await sleep(50);

			expect(player.x).toBeCloseTo(xBefore, 5);
			expect(player.z).toBeCloseTo(zBefore, 5);
			expect(player.lastInputSequence || 0).toBe(seqBefore);
		});

		it('rejects stale sequence numbers without advancing lastInputSequence', async () => {
			const player = testGameState().players[socket._playerId];

			socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 2 });
			await sleep(50);
			expect(player.lastInputSequence).toBe(2);

			socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 1 });
			await sleep(50);
			expect(player.lastInputSequence).toBe(2);

			socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 3 });
			await sleep(50);
			expect(player.lastInputSequence).toBe(3);
		});
	});

	it('clamps sustained lobby movement inside hub dungeonBounds and walkableAABBs', async () => {
		const player = testGameState().players[socket._playerId];
		const aabbs = computeWalkableAABBs(HUB_LAYOUT);
		const leftmost = aabbs.reduce((best, a) => (a.minX < best.minX ? a : best), aabbs[0]);

		player.x = leftmost.minX + PLAYER_RADIUS + 0.2;
		player.z = leftmost.minZ + (leftmost.maxZ - leftmost.minZ) / 2;
		player.lastMoveTime = Date.now() - 80;

		let seq = 1;
		for (let i = 0; i < 8; i++) {
			socket.emit('move', { dx: -1, dz: 0, rotation: 0, sequence: seq++ });
			await sleep(60);
		}

		assertPlayerWithinHub(player);
		assertPlayerNotInHubWall(player);
	});

	it('resolves lobby movement into a hub wall back to valid floor space', async () => {
		const probe = findHubWallProbe();
		expect(probe).toBeTruthy();

		const player = testGameState().players[socket._playerId];
		player.x = probe.x;
		player.z = probe.z;
		player.lastMoveTime = Date.now() - 80;

		socket.emit('move', { dx: probe.dx, dz: 0, rotation: 0, sequence: 1 });
		await sleep(120);

		if (probe.insideDirection > 0) {
			expect(player.x).toBeLessThan(probe.x);
			expect(player.x).toBeGreaterThanOrEqual(probe.floorEdgeX - 1e-6);
		} else {
			expect(player.x).toBeGreaterThan(probe.x);
			expect(player.x).toBeLessThanOrEqual(probe.floorEdgeX + 1e-6);
		}
		expect(player.x).toBeCloseTo(probe.floorEdgeX, 5);
		expect(player.z).toBeCloseTo(probe.z, 5);
		assertPlayerWithinHub(player);
		assertPlayerNotInHubWall(player);
	});
});
