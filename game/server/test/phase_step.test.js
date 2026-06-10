import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	KEY_ITEM_DEFS,
	getWallColliders,
	isEntityPositionBlocked,
	isInsideDungeon,
	PLAYER_RADIUS,
} from '../index.js';
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

	it('wall-overlapping ally endpoint fails with invalid_position and does NOT burn cooldown', async () => {
		// Find an (x, z) that is inside the dungeon (isInsideDungeon true) but still
		// overlaps a wall collider (isEntityPositionBlocked true), robust against the
		// procedural layout: probe a fine grid around each wall collider, expanded by
		// PLAYER_RADIUS. Then find a nearby caster spot that is in-dungeon, unblocked,
		// and within 6 m of the wall point so out_of_range does NOT trip first.
		function findWallOverlapAndCaster() {
			const colliders = getWallColliders();
			const step = 0.25;
			for (const w of colliders) {
				const cx = (w.minX + w.maxX) / 2;
				const cz = (w.minZ + w.maxZ) / 2;
				const halfX = (w.maxX - w.minX) / 2 + PLAYER_RADIUS;
				const halfZ = (w.maxZ - w.minZ) / 2 + PLAYER_RADIUS;
				for (let ox = -halfX; ox <= halfX; ox += step) {
					for (let oz = -halfZ; oz <= halfZ; oz += step) {
						const wx = cx + ox;
						const wz = cz + oz;
						if (!isInsideDungeon(wx, wz)) continue;
						if (!isEntityPositionBlocked(wx, wz, PLAYER_RADIUS)) continue;
						// Found a wall-overlap point inside the dungeon. Now find a valid
						// caster spot within 6 m that is in-dungeon and NOT blocked.
						for (let dx = -5.5; dx <= 5.5; dx += step) {
							for (let dz = -5.5; dz <= 5.5; dz += step) {
								const px = wx + dx;
								const pz = wz + dz;
								const dist = Math.hypot(px - wx, pz - wz);
								if (dist > 5.8 || dist < 0.5) continue;
								if (!isInsideDungeon(px, pz)) continue;
								if (isEntityPositionBlocked(px, pz, PLAYER_RADIUS)) continue;
								return { wall: { x: wx, z: wz }, caster: { x: px, z: pz } };
							}
						}
					}
				}
			}
			return null;
		}

		// Connect first so the dungeon (and its wall colliders) is active before probing.
		const players = await connectTwoAndStartRun();
		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		const spot = findWallOverlapAndCaster();
		// Fail loudly if the layout exposes no such configuration.
		expect(spot, 'no in-dungeon wall-overlap + valid caster point found').not.toBeNull();
		// Preconditions: ally point is in-dungeon yet blocked; caster point is clear.
		expect(isInsideDungeon(spot.wall.x, spot.wall.z)).toBe(true);
		expect(isEntityPositionBlocked(spot.wall.x, spot.wall.z, PLAYER_RADIUS)).toBe(true);
		expect(isInsideDungeon(spot.caster.x, spot.caster.z)).toBe(true);
		expect(isEntityPositionBlocked(spot.caster.x, spot.caster.z, PLAYER_RADIUS)).toBe(false);

		// Caster at the clear in-room spot, ally at the wall-overlap point within range.
		p1.x = spot.caster.x; p1.z = spot.caster.z;
		p2.x = spot.wall.x; p2.z = spot.wall.z;

		// Sanity: ally is within the 6 m range so out_of_range does not trip first.
		expect(Math.hypot(p2.x - p1.x, p2.z - p1.z)).toBeLessThanOrEqual(6);

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

	it('same XZ with ally elevated within vertical range swaps successfully', async () => {
		const players = await connectTwoAndStartRun();
		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		const baseY = p1.y ?? 0.5;
		p2.x = p1.x;
		p2.z = p1.z;
		p2.y = baseY + 3;

		const p1Before = { x: p1.x, y: p1.y, z: p1.z };
		const p2Before = { x: p2.x, y: p2.y, z: p2.z };
		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'phase_step' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.targetPlayerId).toBe(p2.id);

		const p1After = playerForSocket(players[0].socket);
		const p2After = playerForSocket(players[1].socket);
		expect(p1After.x).toBeCloseTo(p2Before.x, 5);
		expect(p1After.y).toBeCloseTo(p2Before.y, 5);
		expect(p1After.z).toBeCloseTo(p2Before.z, 5);
		expect(p2After.x).toBeCloseTo(p1Before.x, 5);
		expect(p2After.y).toBeCloseTo(p1Before.y, 5);
		expect(p2After.z).toBeCloseTo(p1Before.z, 5);
		expect(p1After.keyItemCooldownUntil).toBeGreaterThan(Date.now());
	});

	it('same XZ with ally elevated beyond vertical range fails out_of_range without burning cooldown', async () => {
		const players = await connectTwoAndStartRun();
		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		const baseY = p1.y ?? 0.5;
		p2.x = p1.x;
		p2.z = p1.z;
		p2.y = baseY + 8;

		const p1Before = { x: p1.x, y: p1.y, z: p1.z };
		const p2Before = { x: p2.x, y: p2.y, z: p2.z };
		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'phase_step' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('out_of_range');

		const p1After = playerForSocket(players[0].socket);
		const p2After = playerForSocket(players[1].socket);
		expect(p1After.x).toBeCloseTo(p1Before.x, 5);
		expect(p1After.y).toBeCloseTo(p1Before.y, 5);
		expect(p1After.z).toBeCloseTo(p1Before.z, 5);
		expect(p2After.x).toBeCloseTo(p2Before.x, 5);
		expect(p2After.y).toBeCloseTo(p2Before.y, 5);
		expect(p2After.z).toBeCloseTo(p2Before.z, 5);
		expect(p1After.keyItemCooldownUntil || 0).toBe(0);
	});

	it('explicit targetPlayerId beyond vertical range fails out_of_range without burning cooldown', async () => {
		const players = await connectTwoAndStartRun();
		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		const baseY = p1.y ?? 0.5;
		p2.x = p1.x;
		p2.z = p1.z;
		p2.y = baseY + 8;
		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'phase_step', targetPlayerId: p2.id });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('out_of_range');
		expect(playerForSocket(players[0].socket).keyItemCooldownUntil || 0).toBe(0);
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
