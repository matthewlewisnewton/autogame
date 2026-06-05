import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	runGameLoopTick,
	computeWalkableAABBs,
} from '../index.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	testGameState,
} from './helpers.js';

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstRoomSpawn(state) {
	const first = state.layout.rooms[0];
	return { x: first.x, z: first.z };
}

function isInsideWalkableAABBs(x, z, aabbs) {
	if (!aabbs || aabbs.length === 0) return false;
	for (const a of aabbs) {
		if (x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ) {
			return true;
		}
	}
	return false;
}

function findExteriorProbe(aabbs) {
	for (const aabb of aabbs) {
		const z = (aabb.minZ + aabb.maxZ) / 2;
		for (const [edge, x, dx] of [
			['maxX', aabb.maxX - 0.3, 1],
			['minX', aabb.minX + 0.3, -1],
		]) {
			if (isInsideWalkableAABBs(x, z, aabbs)) {
				return { x, z, dx, edge, aabb };
			}
		}
	}
	return null;
}

describe('Lobby phase movement (server)', () => {
	let baseUrl;
	let socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket?.connected) socket.disconnect();
		await closeServer();
	});

	it('accepts lobby-phase move and updates player position after a tick', async () => {
		const state = testGameState();
		expect(state.gamePhase).toBe('lobby');

		const player = state.players[socket._playerId];
		const xBefore = player.x;
		const zBefore = player.z;

		socket.emit('move', { dx: 1, dz: 0, rotation: 0 });
		await sleep(50);
		runGameLoopTick();

		expect(player.x).toBeGreaterThan(xBefore);
		expect(player.z).toBeCloseTo(zBefore, 1);
		expect(isInsideWalkableAABBs(player.x, player.z, state.walkableAABBs)).toBe(true);
	});

	it('rejects invalid payload and stale sequence in lobby phase', async () => {
		const state = testGameState();
		const player = state.players[socket._playerId];
		const spawn = firstRoomSpawn(state);

		socket.emit('move', { dx: 1 });
		expect(player.x).toBe(spawn.x);

		socket.emit('move', { dx: NaN, dz: 0, rotation: 0 });
		expect(player.x).toBe(spawn.x);

		socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 2 });
		await sleep(20);
		expect(player.lastInputSequence).toBe(2);

		socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 1 });
		await sleep(20);
		expect(player.lastInputSequence).toBe(2);

		socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 3 });
		await sleep(20);
		expect(player.lastInputSequence).toBe(3);
	});

	it('keeps player inside walkableAABBs when moving toward hub exterior', async () => {
		const state = testGameState();
		expect(state.layout.profile).toBe('hub');
		expect(state.walkableAABBs?.length).toBeGreaterThan(0);

		const aabbs = state.walkableAABBs ?? computeWalkableAABBs(state.layout);
		const probe = findExteriorProbe(aabbs);
		expect(probe).toBeTruthy();

		const player = state.players[socket._playerId];
		player.x = probe.x;
		player.z = probe.z;

		for (let i = 0; i < 12; i++) {
			socket.emit('move', { dx: probe.dx, dz: 0, rotation: 0, sequence: i + 1 });
			await sleep(20);
			runGameLoopTick();
			expect(isInsideWalkableAABBs(player.x, player.z, aabbs)).toBe(true);
		}
	});
});
