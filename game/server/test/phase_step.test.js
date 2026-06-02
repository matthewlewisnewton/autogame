import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KEY_ITEM_DEFS } from '../index.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
} from './helpers.js';

/**
 * Integration tests for the `phase_step` key item.
 * phase_step swaps the caster's position with a targeted (or nearest) living
 * ally within range, on a cooldown, and fails gracefully (without burning the
 * cooldown) when there is no ally or the ally is out of range.
 */
describe('useKeyItem — phase_step', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	}, 20000);

	afterEach(async () => {
		await closeServer();
	}, 20000);

	/**
	 * Connect a single client and enter the 'playing' phase via ready-up.
	 */
	async function connectAndStartRun(accountId) {
		const { socket } = await connectClient(baseUrl, accountId);
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		return { socket };
	}

	/**
	 * Connect two clients to the same lobby and enter 'playing' phase.
	 */
	async function connectTwoAndStartRun() {
		const { socket: s1 } = await connectClient(baseUrl, `p1-${Date.now()}`);
		const { socket: s2 } = await connectClient(
			baseUrl,
			`p2-${Date.now()}`,
			{ joinLobbyId: s1._lobbyId }
		);

		const start1 = waitForEvent(s1, 'startGame');
		const start2 = waitForEvent(s2, 'startGame');
		s1.emit('playerReady', true);
		s2.emit('playerReady', true);
		await start1;
		await start2;

		return [{ socket: s1 }, { socket: s2 }];
	}

	it('def reflects swap semantics (12s cooldown, 6m range)', () => {
		const def = KEY_ITEM_DEFS.phase_step;
		expect(def).toBeDefined();
		expect(def.cooldownMs).toBe(12000);
		expect(def.range).toBe(6);
		expect(def.maxDistance).toBeUndefined();
		expect(def.name).toBe('Phase Step');
		expect(def.description.toLowerCase()).toContain('swap');
	});

	it('two players within range swap coordinates (nearest-ally auto-target)', async () => {
		const players = await connectTwoAndStartRun();
		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		// Place both within 6 m of each other (both inside the start room).
		p1.x = p1.x; p1.z = p1.z;
		p2.x = p1.x + 3; p2.z = p1.z;

		const p1Before = { x: p1.x, y: p1.y, z: p1.z };
		const p2Before = { x: p2.x, y: p2.y, z: p2.z };

		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'phase_step' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('phase_step');
		expect(result.targetPlayerId).toBe(p2.id);

		// Caster now sits where the ally was, and vice versa.
		const p1After = playerForSocket(players[0].socket);
		const p2After = playerForSocket(players[1].socket);
		expect(p1After.x).toBeCloseTo(p2Before.x, 5);
		expect(p1After.y).toBeCloseTo(p2Before.y, 5);
		expect(p1After.z).toBeCloseTo(p2Before.z, 5);
		expect(p2After.x).toBeCloseTo(p1Before.x, 5);
		expect(p2After.y).toBeCloseTo(p1Before.y, 5);
		expect(p2After.z).toBeCloseTo(p1Before.z, 5);

		// Cooldown is now set on the caster.
		expect(p1After.keyItemCooldownUntil).toBeGreaterThan(Date.now());
		expect(result.cooldownUntil).toBeGreaterThan(Date.now());
	});

	it('explicit targetPlayerId swaps with that player', async () => {
		const players = await connectTwoAndStartRun();
		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		p2.x = p1.x + 2; p2.z = p1.z + 1;
		const p1Before = { x: p1.x, y: p1.y, z: p1.z };
		const p2Before = { x: p2.x, y: p2.y, z: p2.z };
		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'phase_step', targetPlayerId: p2.id });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.targetPlayerId).toBe(p2.id);
		expect(playerForSocket(players[0].socket).x).toBeCloseTo(p2Before.x, 5);
		expect(playerForSocket(players[1].socket).x).toBeCloseTo(p1Before.x, 5);
	});

	it('out-of-range ally fails with out_of_range and does NOT burn cooldown', async () => {
		const players = await connectTwoAndStartRun();
		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		// Place ally well beyond the 6 m range.
		p2.x = p1.x + 20; p2.z = p1.z;
		const p1Before = { x: p1.x, y: p1.y, z: p1.z };
		const p2Before = { x: p2.x, y: p2.y, z: p2.z };
		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'phase_step' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('out_of_range');

		// Positions unchanged.
		expect(playerForSocket(players[0].socket).x).toBeCloseTo(p1Before.x, 5);
		expect(playerForSocket(players[1].socket).x).toBeCloseTo(p2Before.x, 5);

		// Cooldown NOT burned.
		expect(playerForSocket(players[0].socket).keyItemCooldownUntil || 0).toBe(0);
	});

	it('off-map endpoints fail with invalid_position and do NOT burn cooldown', async () => {
		const players = await connectTwoAndStartRun();
		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		// Move both players to an off-map coordinate that lies outside every
		// walkableAABB, but keep the ally within the 6 m range so the
		// out_of_range guard does NOT trip before invalid_position.
		p1.x = 99999; p1.z = 99999;
		p2.x = p1.x + 1; p2.z = p1.z;
		const p1Before = { x: p1.x, y: p1.y, z: p1.z };
		const p2Before = { x: p2.x, y: p2.y, z: p2.z };
		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'phase_step' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('invalid_position');

		// Neither player's position changed (no swap occurred).
		const p1After = playerForSocket(players[0].socket);
		const p2After = playerForSocket(players[1].socket);
		expect(p1After.x).toBeCloseTo(p1Before.x, 5);
		expect(p1After.z).toBeCloseTo(p1Before.z, 5);
		expect(p2After.x).toBeCloseTo(p2Before.x, 5);
		expect(p2After.z).toBeCloseTo(p2Before.z, 5);

		// Cooldown NOT burned.
		expect(p1After.keyItemCooldownUntil || 0).toBe(0);
	});

	it('solo caster (no ally) fails with no_ally and does NOT burn cooldown', async () => {
		const { socket } = await connectAndStartRun(`solo-${Date.now()}`);
		const player = playerForSocket(socket);
		const before = { x: player.x, y: player.y, z: player.z };
		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'phase_step' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no_ally');

		const after = playerForSocket(socket);
		expect(after.x).toBeCloseTo(before.x, 5);
		expect(after.z).toBeCloseTo(before.z, 5);
		expect(after.keyItemCooldownUntil || 0).toBe(0);
	});

	it('cooldown enforced: second use within 12s returns on_cooldown', async () => {
		const players = await connectTwoAndStartRun();
		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		p2.x = p1.x + 2; p2.z = p1.z;
		p1.keyItemCooldownUntil = 0;

		const r1Promise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'phase_step' });
		const r1 = await r1Promise;
		expect(r1.ok).toBe(true);

		const r2Promise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'phase_step' });
		const r2 = await r2Promise;
		expect(r2.ok).toBe(false);
		expect(r2.reason).toBe('on_cooldown');
		expect(r2.remainingMs).toBeGreaterThan(0);
	});
});
