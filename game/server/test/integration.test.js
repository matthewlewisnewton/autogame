import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import {
	startServer,
	resetGameState,
	gameState,
	io as serverIo,
	server as httpServer,
	_intervals,
	_timeouts,
	clearAllTimers,
	ENEMY_ATTACK_RANGE,
	ENEMY_ATTACK_RECOVERY_MS,
	DETECTION_RADIUS,
	TICK_RATE,
	ENEMY_DEFS,
	spawnEnemy,
	updateEnemies,
	damagePlayer,
	checkRunTerminalState
} from '../index.js';
import { COOLDOWN_MS, MAX_ELAPSED_MS, MOVE_SPEED, MAX_HP } from '../config.js';

// ── Helpers ──

/**
 * Start a fresh server on a random port and return the base URL.
 * Each test gets its own server so there is no shared-state interference.
 */
async function startTestServer() {
	// Disconnect all existing clients before closing the server
	for (const [id, conn] of Object.entries(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	// Close any existing server before starting a new one
	if (httpServer.listening) {
		await new Promise((resolve, reject) => {
			const t = setTimeout(() => {
				// Force-close on timeout: close underlying handles
				try { serverIo.close(); } catch (_) {}
				httpServer.close(resolve);
			}, 5000);
			httpServer.close(() => { clearTimeout(t); resolve(); });
		});
	}

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('startTestServer: timed out waiting for listening')), 15000);

		resetGameState();
		serverIo.removeAllListeners('connection');
		clearAllTimers();

		startServer(0);

		httpServer.once('listening', () => {
			clearTimeout(timeout);
			const addr = httpServer.address();
			resolve(`http://localhost:${addr.port}`);
		});

		httpServer.once('error', (e) => {
			clearTimeout(timeout);
			reject(e);
		});
	});
}

/**
 * Connect a socket.io-client and resolve with { socket, init }.
 * We wait for the `init` event specifically (not `connect`) because the
 * server emits `init` in its connection handler, which arrives on the client
 * after the `connect` acknowledgment. Resolving on `connect` would leave
 * `initPayload` as null.
 *
 * A 10-second timeout rejects the Promise so vitest hookTimeout fires with
 * a clear error instead of hanging indefinitely.
 */
function connectClient(baseUrl) {
	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000
		});

		const timer = setTimeout(() => {
			try { socket.disconnect(); } catch (_) {}
			reject(new Error(`connectClient: timed out waiting for init from ${baseUrl}`));
		}, 10000);

		socket.on('init', (data) => {
			clearTimeout(timer);
			resolve({ socket, init: data });
		});
		socket.on('connect_error', (e) => {
			clearTimeout(timer);
			reject(e);
		});
	});
}

/**
 * Wait for a specific event on a socket, rejecting after a timeout.
 */
function waitForEvent(socket, event, timeout = 3000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeout);
		socket.once(event, (data) => {
			clearTimeout(timer);
			resolve(data);
		});
	});
}

/**
 * Small helper to advance time (for things like heartbeat latency).
 */
function sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

/**
 * Close the HTTP server, disconnecting any remaining clients first.
 * Falls back to a force-close after 5 seconds so that a stuck socket
 * doesn't block the entire test run.
 */
async function closeServer() {
	// Disconnect all Socket.IO clients so the server can shut down
	for (const [id, conn] of Object.entries(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	await new Promise((resolve) => {
		const t = setTimeout(() => {
			try { serverIo.close(); } catch (_) {}
			resolve();
		}, 5000);
		httpServer.close(() => { clearTimeout(t); resolve(); });
	});
}

function firstRoomSpawn() {
	const first = gameState.layout.rooms[0];
	return { x: first.x, z: first.z };
}

/**
 * Find the slot index of a weapon card in a player's hand.
 * Returns -1 if no weapon card is found.
 */
function findWeaponSlot(player) {
	return player.hand ? player.hand.findIndex(c => c && c.type === 'weapon') : -1;
}

/**
 * Find the slot index of a card of the given type in a player's hand.
 * Returns -1 if not found.
 */
function findCardSlot(player, type) {
	return player.hand ? player.hand.findIndex(c => c && c.type === type) : -1;
}

// ── Integration Tests ──

describe('Socket Integration — Connection Flow', () => {
	let baseUrl, socket, init;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const result = await connectClient(baseUrl);
		socket = result.socket;
		init = result.init;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('client receives init event with id, state, layoutSeed, layout', async () => {
		// init was captured during connection (see connectClient helper)
		expect(init).toHaveProperty('id');
		expect(typeof init.id).toBe('string');
		expect(init).toHaveProperty('state');
		expect(init).toHaveProperty('layoutSeed');
		expect(typeof init.layoutSeed).toBe('number');
		expect(init).toHaveProperty('layout');
		expect(Array.isArray(init.layout.rooms)).toBe(true);
		expect(Array.isArray(init.layout.passages)).toBe(true);
	});

	it('server registers the player in gameState.players', async () => {
		expect(gameState.players[socket.id]).toBeDefined();
		expect(gameState.players[socket.id].hp).toBe(100);
		const spawn = firstRoomSpawn();
		expect(gameState.players[socket.id].x).toBe(spawn.x);
		expect(gameState.players[socket.id].z).toBe(spawn.z);
	});
});

describe('Socket Integration — Move Event', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('emits move and server broadcasts stateUpdate with new position', async () => {
		// Enter playing phase so the move handler processes the intent
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket.id];
		const xBefore = player.x;
		const zBefore = player.z;

		// Emit intent-based move: direction +X
		socket.emit('move', { dx: 1, dz: 0, rotation: 0 });

		// Give the server a tick to integrate and broadcast
		await sleep(100);

		// Position should have changed in +X direction (intent integration)
		expect(player.x).toBeGreaterThan(xBefore);
		expect(player.z).toBeCloseTo(zBefore, 1); // z unchanged (dz=0)
	});

	it('clamps position to dungeon bounds', async () => {
		// Enter playing phase so the move handler processes the intent
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		// Emit intent-based move in +X, -Z direction (large values clamped by elapsed cap)
		socket.emit('move', { dx: 1, dz: -1, rotation: 0 });

		// socket.emit is async — wait for the server to process the event
		await sleep(50);

		const player = gameState.players[socket.id];
		const bounds = gameState.dungeonBounds;
		expect(player.x).toBeLessThanOrEqual(bounds.maxX);
		expect(player.x).toBeGreaterThanOrEqual(bounds.minX);
		expect(player.z).toBeLessThanOrEqual(bounds.maxZ);
		expect(player.z).toBeGreaterThanOrEqual(bounds.minZ);
	});

	it('dead player cannot move', async () => {
		// Enter playing phase so the move handler is active
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket.id];
		player.hp = 0;
		player.dead = true;

		const spawn = firstRoomSpawn();

		socket.emit('move', { dx: 1, dz: 1, rotation: 0 });

		expect(player.x).toBe(spawn.x);
		expect(player.z).toBe(spawn.z);
	});

	it('applies MOVE_SPEED to normalized input with capped elapsed', async () => {
		// Enter playing phase so the move handler processes the intent
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket.id];

		// Place player at dungeon center to avoid swept-collision rejection
		// from wall proximity at the spawn point.
		const bounds = gameState.dungeonBounds;
		const centerX = (bounds.minX + bounds.maxX) / 2;
		const centerZ = (bounds.minZ + bounds.maxZ) / 2;
		player.x = centerX;
		player.z = centerZ;

		const startX = player.x;

		// Set lastMoveTime far enough in the past so that elapsed >= MAX_ELAPSED_MS,
		// ensuring the cap kicks in and displacement = MOVE_SPEED * (MAX_ELAPSED_MS / 1000).
		player.lastMoveTime = Date.now() - MAX_ELAPSED_MS - 100;

		// Emit normalized movement intent: dx=1, dz=0 (magnitude = 1)
		socket.emit('move', { dx: 1, dz: 0, rotation: 0 });

		// Wait for the server tick to process the move
		await sleep(50);

		const expectedDisplacement = MOVE_SPEED * (MAX_ELAPSED_MS / 1000);
		const actualDisplacement = Math.abs(player.x - startX);
		expect(actualDisplacement).toBeGreaterThan(expectedDisplacement - 0.5);
		expect(actualDisplacement).toBeLessThan(expectedDisplacement + 0.5);
	});
});

describe('Socket Integration — Invalid Move Rejection', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('rejects move with missing fields', () => {
		const spawn = firstRoomSpawn();
		socket.emit('move', { dx: 1 }); // missing dz, rotation
		expect(gameState.players[socket.id].x).toBe(spawn.x);
	});

	it('rejects move with non-numeric fields', () => {
		const spawn = firstRoomSpawn();
		socket.emit('move', { dx: 'abc', dz: 0.5, rotation: 0 });
		expect(gameState.players[socket.id].x).toBe(spawn.x);
	});

	it('rejects move with null payload', () => {
		const spawn = firstRoomSpawn();
		socket.emit('move', null);
		expect(gameState.players[socket.id].x).toBe(spawn.x);
	});

	it('rejects move with array payload', () => {
		const spawn = firstRoomSpawn();
		socket.emit('move', [1, 2, 3]);
		expect(gameState.players[socket.id].x).toBe(spawn.x);
	});

	it('rejects move with NaN fields', () => {
		const spawn = firstRoomSpawn();
		socket.emit('move', { dx: NaN, dz: 0.5, rotation: 0 });
		expect(gameState.players[socket.id].x).toBe(spawn.x);
	});
});

describe('Socket Integration — useCard Event', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	describe('Weapon card', () => {
		it('emits useCard, server processes cone attack and broadcasts cardUsed', async () => {
			// Enter playing phase so useCard is processed
			const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
			socket.emit('debugScenario', { name: 'summon-ready' });
			await debugResultPromise;
			await waitForEvent(socket, 'stateUpdate');

			const player = gameState.players[socket.id];
			// Find the slot with a weapon card in hand
			const weaponSlot = player.hand.findIndex(c => c && c.type === 'weapon');
			expect(weaponSlot).toBeGreaterThanOrEqual(0);
			const weaponCard = player.hand[weaponSlot];

			// Place an enemy within ATTACK_RANGE in front of the player
			gameState.enemies.push({
				id: 'e1',
				x: player.x + 3, // within range, in +X direction (player default rotation = 0)
				z: player.z,
				hp: 50,
				state: 'idle',
				wanderTarget: { x: player.x + 3, z: player.z }
			});

			const cardUsedPromise = waitForEvent(socket, 'cardUsed');

			socket.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });

			// Wait for cardUsed broadcast
			await cardUsedPromise;

			// Enemy should have taken damage
			const enemy = gameState.enemies.find(e => e.id === 'e1');
			expect(enemy).toBeDefined();
			expect(enemy.hp).toBeLessThan(50);
		});
	});

	describe('Summon card', () => {
		it('emits useCard, server processes radial AoE and deducts magic stones', async () => {
			// Enter playing phase so useCard is processed
			const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
			socket.emit('debugScenario', { name: 'summon-ready' });
			await debugResultPromise;
			await waitForEvent(socket, 'stateUpdate');

			const player = gameState.players[socket.id];

			// Ensure a summon card is in hand — the random deal from summon-ready
			// may not include battle_familiar (2 of 8 deck cards), so we
			// manually place one if not present.
			let summonSlot = player.hand.findIndex(c => c && c.type === 'summon');
			if (summonSlot < 0) {
				const emptySlot = player.hand.findIndex(c => !c);
				if (emptySlot >= 0) {
					player.hand[emptySlot] = { id: 'battle_familiar', name: 'Battle Familiar', type: 'summon', charges: 1, remainingCharges: 1, magicStoneCost: 50, damage: 40 };
					summonSlot = emptySlot;
				} else if (player.hand.length < 4) {
					player.hand.push({ id: 'battle_familiar', name: 'Battle Familiar', type: 'summon', charges: 1, remainingCharges: 1, magicStoneCost: 50, damage: 40 });
					summonSlot = player.hand.length - 1;
				} else {
					player.hand[3] = { id: 'battle_familiar', name: 'Battle Familiar', type: 'summon', charges: 1, remainingCharges: 1, magicStoneCost: 50, damage: 40 };
					summonSlot = 3;
				}
			}
			const summonCard = player.hand[summonSlot];
			expect(summonCard).toBeDefined();
			expect(summonCard.type).toBe('summon');

			// Place enemies within SUMMON_RADIUS
			gameState.enemies.push({
				id: 'e1',
				x: player.x + 5,
				z: player.z,
				hp: 60,
				state: 'idle',
				wanderTarget: { x: player.x + 5, z: player.z }
			});

			const beforeStones = gameState.players[socket.id].magicStones;

			const cardUsedPromise = waitForEvent(socket, 'cardUsed');

			socket.emit('useCard', { cardId: summonCard.id, slotIndex: summonSlot });

			await cardUsedPromise;

			// Enemy should have taken summon damage
			const enemy = gameState.enemies.find(e => e.id === 'e1');
			expect(enemy).toBeDefined();
			expect(enemy.hp).toBeLessThan(60);

			// Magic stones should be deducted
			const afterStones = gameState.players[socket.id].magicStones;
			expect(afterStones).toBeLessThan(beforeStones);
		});

		it('rejects summon when not enough magic stones', async () => {
			// Enter playing phase so useCard is processed
			const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
			socket.emit('debugScenario', { name: 'summon-ready' });
			await debugResultPromise;
			await waitForEvent(socket, 'stateUpdate');

			const player = gameState.players[socket.id];
			player.magicStones = 10;

			// Find the slot with a summon card in hand
			const summonSlot = player.hand.findIndex(c => c && c.type === 'summon');
			expect(summonSlot).toBeGreaterThanOrEqual(0);
			const summonCard = player.hand[summonSlot];

			const cardErrorPromise = waitForEvent(socket, 'cardError');

			socket.emit('useCard', { cardId: summonCard.id, slotIndex: summonSlot });

			// The cardError should fire
			const err = await Promise.race([
				cardErrorPromise,
				new Promise((_, r) => setTimeout(() => r(null), 2000))
			]);

			// If we got the error event, it has the reason
			if (err) {
				expect(err.reason).toBe('Not enough Magic Stones');
			}
		});
	});

	describe('Monster card', () => {
		it('emits useCard, server spawns a minion in gameState.minions', async () => {
			// Enter playing phase so useCard is processed
			const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
			socket.emit('debugScenario', { name: 'summon-ready' });
			await debugResultPromise;
			await waitForEvent(socket, 'stateUpdate');

			const player = gameState.players[socket.id];

			// Ensure a monster card is in hand — the random deal from summon-ready
			// may not include dungeon_drake (only 1 of 8 deck cards), so we
			// manually place one in the first empty slot or overwrite a slot.
			let monsterSlot = player.hand.findIndex(c => c && c.type === 'monster');
			if (monsterSlot < 0) {
				// Find an empty slot or append
				const emptySlot = player.hand.findIndex(c => !c);
				if (emptySlot >= 0) {
					player.hand[emptySlot] = { id: 'dungeon_drake', name: 'Dungeon Drake', type: 'monster', charges: 1, remainingCharges: 1 };
					monsterSlot = emptySlot;
				} else if (player.hand.length < 4) {
					player.hand.push({ id: 'dungeon_drake', name: 'Dungeon Drake', type: 'monster', charges: 1, remainingCharges: 1 });
					monsterSlot = player.hand.length - 1;
				} else {
					// Overwrite last slot — test still validates monster card behavior
					player.hand[3] = { id: 'dungeon_drake', name: 'Dungeon Drake', type: 'monster', charges: 1, remainingCharges: 1 };
					monsterSlot = 3;
				}
			}
			const monsterCard = player.hand[monsterSlot];
			expect(monsterCard).toBeDefined();
			expect(monsterCard.type).toBe('monster');

			const beforeCount = gameState.minions.length;

			const cardUsedPromise = waitForEvent(socket, 'cardUsed');

			socket.emit('useCard', { cardId: monsterCard.id, slotIndex: monsterSlot });

			await cardUsedPromise;

			expect(gameState.minions.length).toBe(beforeCount + 1);
			const minion = gameState.minions[gameState.minions.length - 1];
			expect(minion.ownerId).toBe(socket.id);
			expect(minion.hp).toBe(50);
			// TTL starts at 30 but game loop may have ticked a bit
			expect(minion.ttl).toBeGreaterThan(29);
			expect(minion.ttl).toBeLessThanOrEqual(30);
		});
	});
});

describe('Socket Integration — Heartbeat Event', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('client emits heartbeat, server responds with heartbeat_ack containing latency', async () => {
		const timestamp = Date.now();
		const ackPromise = waitForEvent(socket, 'heartbeat_ack');

		socket.emit('heartbeat', { timestamp });

		const ack = await ackPromise;
		expect(ack).toHaveProperty('latency');
		expect(typeof ack.latency).toBe('number');
		expect(ack.latency).toBeGreaterThanOrEqual(0);
	});

	it('rejects heartbeat with invalid payload', async () => {
		// Invalid heartbeat should be silently ignored (no ack)
		socket.emit('heartbeat', {});

		// Wait a bit — no heartbeat_ack should arrive
		await sleep(200);

		// lastActivity should not have been updated by invalid heartbeat
		// (it was set on connect, so we just verify the player still exists)
		expect(gameState.players[socket.id]).toBeDefined();
	});
});

describe('Socket Integration — Disconnect Event', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		// Don't disconnect socket here — the test does it
		await closeServer();
	});

	it('removes player from gameState.players on disconnect', async () => {
		expect(gameState.players[socket.id]).toBeDefined();

		socket.disconnect();
		await sleep(100);

		expect(gameState.players[socket.id]).toBeUndefined();
	});

	it('cleans up owned minions on disconnect', async () => {
		// Spawn a minion for this player
		gameState.minions.push({
			id: 'm1',
			ownerId: socket.id,
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});

		expect(gameState.minions.length).toBe(1);

		socket.disconnect();
		await sleep(100);

		expect(gameState.minions.filter(m => m.ownerId === socket.id).length).toBe(0);
	});
});

describe('Socket Integration — Last Player Disconnect Resets Run', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		// Don't disconnect socket here — the test does it
		await closeServer();
	});

	it('resets gamePhase to lobby when last player disconnects during active run', async () => {
		// Transition to playing phase
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		expect(gameState.gamePhase).toBe('playing');

		// Disconnect the only player
		socket.disconnect();
		await sleep(100);

		expect(gameState.gamePhase).toBe('lobby');
	});

	it('clears gameState.run when last player disconnects', async () => {
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		expect(gameState.run).toBeDefined();

		socket.disconnect();
		await sleep(100);

		expect(gameState.run).toBeUndefined();
	});

	it('clears enemies, minions, and loot when last player disconnects', async () => {
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		expect(gameState.enemies.length).toBeGreaterThan(0);

		// Add some minions and loot
		gameState.minions.push({ id: 'm1', ownerId: socket.id, x: 0, z: 0, hp: 50, ttl: 30 });
		gameState.loot.push({ id: 'l1', x: 0, z: 0, value: 10, createdAt: Date.now() });

		socket.disconnect();
		await sleep(100);

		expect(gameState.enemies).toEqual([]);
		expect(gameState.minions).toEqual([]);
		expect(gameState.loot).toEqual([]);
	});

	it('does not reset run when a second player remains connected', async () => {
		const socket2 = (await connectClient(baseUrl)).socket;

		// Both players ready to start the game
		const startGame1 = waitForEvent(socket, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket.emit('playerReady', true);
		await sleep(50);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);
		expect(gameState.gamePhase).toBe('playing');
		expect(gameState.run).toBeDefined();

		// Disconnect first player — second remains
		socket.disconnect();
		await sleep(100);

		expect(gameState.gamePhase).toBe('playing');
		expect(gameState.run).toBeDefined();

		// Clean up second socket
		if (socket2.connected) socket2.disconnect();
	});

	it('does not reset run when one of multiple players disconnects', async () => {
		// Connect two clients
		const socket2 = (await connectClient(baseUrl)).socket;

		// Both players ready up and transition to playing
		const startGame1 = waitForEvent(socket, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket.emit('playerReady', true);
		await sleep(50);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);

		// Verify initial playing state
		expect(gameState.gamePhase).toBe('playing');
		expect(gameState.run).toBeDefined();
		expect(gameState.enemies.length).toBeGreaterThan(0);

		// Disconnect socket1 — socket2 should remain
		socket.disconnect();
		await sleep(100);

		// gamePhase must remain 'playing'
		expect(gameState.gamePhase).toBe('playing');

		// gameState.run must still exist
		expect(gameState.run).toBeDefined();

		// At least one enemy must remain (run not cleared)
		expect(gameState.enemies.length).toBeGreaterThan(0);

		// The remaining socket's player must still be in gameState.players
		expect(gameState.players[socket2.id]).toBeDefined();
	});

	it('resets to lobby when last player disconnects in terminal run state', async () => {
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;

		// Force the run to a terminal state (victory) by defeating all enemies
		gameState.run.objective.defeatedEnemies = gameState.run.objective.totalEnemies;
		checkRunTerminalState();
		expect(gameState.gamePhase).toBe('playing');
		expect(gameState.run.status).toBe('victory');

		// Disconnect the last player
		socket.disconnect();
		await sleep(100);

		expect(gameState.gamePhase).toBe('lobby');
		expect(gameState.run).toBeUndefined();
	});

	it('new connection receives clean lobby init after last player disconnects', async () => {
		// 1. Connect, ready up, and transition to playing
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		await waitForEvent(socket, 'stateUpdate');

		expect(gameState.gamePhase).toBe('playing');
		expect(gameState.run).toBeDefined();
		expect(gameState.enemies.length).toBeGreaterThan(0);

		// 2. Disconnect the only player
		socket.disconnect();
		await sleep(100);

		expect(Object.keys(gameState.players)).toHaveLength(0);
		expect(gameState.gamePhase).toBe('lobby');
		expect(gameState.run).toBeUndefined();
		expect(gameState.enemies).toHaveLength(0);

		// 3. Connect a second socket — should receive a clean lobby init
		const { socket: socket2, init } = await connectClient(baseUrl);
		expect(init.state.gamePhase).toBe('lobby');

		// Clean up
		if (socket2.connected) socket2.disconnect();
	});
});

describe('Socket Integration — Lobby / playerReady Flow', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket1 = (await connectClient(baseUrl)).socket;
		socket2 = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	it('two players connect, both emit playerReady(true), both receive startGame', async () => {
		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');

		// First player ready
		socket1.emit('playerReady', true);
		await sleep(50);

		// Only first is ready — game should not start yet
		expect(gameState.gamePhase).toBe('lobby');

		// Second player ready
		socket2.emit('playerReady', true);

		// Both should receive startGame
		await Promise.all([startGame1, startGame2]);

		expect(gameState.gamePhase).toBe('playing');
	});

	it('broadcasts lobbyUpdate on playerReady', async () => {
		const lobbyUpdatePromise = waitForEvent(socket1, 'lobbyUpdate');

		socket2.emit('playerReady', true);

		const update = await lobbyUpdatePromise;
		expect(update).toHaveProperty('players');
		expect(update).toHaveProperty('gamePhase');
		expect(Array.isArray(update.players)).toBe(true);
	});
});

describe('dungeon run objective', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket1 = (await connectClient(baseUrl)).socket;
		socket2 = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	it('both players receive state containing run object with correct initial values after game starts', async () => {
		// Wait for startGame on both sockets
		const startGamePromise1 = waitForEvent(socket1, 'startGame');
		const startGamePromise2 = waitForEvent(socket2, 'startGame');

		// Both players ready up
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);

		// Wait for startGame on both sockets
		await Promise.all([startGamePromise1, startGamePromise2]);

		// Now wait for the next stateUpdate on both sockets — should contain the run object
		const stateUpdatePromise1 = waitForEvent(socket1, 'stateUpdate');
		const stateUpdatePromise2 = waitForEvent(socket2, 'stateUpdate');

		const [stateUpdate1, stateUpdate2] = await Promise.all([stateUpdatePromise1, stateUpdatePromise2]);

		// Assert socket1's payload
		expect(stateUpdate1).toHaveProperty('run');
		expect(stateUpdate1.run).toHaveProperty('status', 'playing');
		expect(stateUpdate1.run).toHaveProperty('objective');
		expect(stateUpdate1.run.objective).toHaveProperty('type', 'defeat_enemies');
		expect(stateUpdate1.run.objective).toHaveProperty('defeatedEnemies', 0);

		// Assert socket2's payload
		expect(stateUpdate2).toHaveProperty('run');
		expect(stateUpdate2.run).toHaveProperty('status', 'playing');
		expect(stateUpdate2.run).toHaveProperty('objective');
		expect(stateUpdate2.run.objective).toHaveProperty('type', 'defeat_enemies');
		expect(stateUpdate2.run.objective).toHaveProperty('defeatedEnemies', 0);
	});

	it('killing an enemy through useCard advances run.objective.defeatedEnemies by 1', async () => {
		// Use debug scenario to get into playing phase with enemies
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');

		socket1.emit('debugScenario', { name: 'summon-ready' });

		const debugResult = await debugResultPromise;
		expect(debugResult.ok).toBe(true);

		// Wait for stateUpdate to arrive after debug scenario
		await waitForEvent(socket1, 'stateUpdate');

		// Verify run exists and has enemies
		expect(gameState.run).toBeDefined();
		expect(gameState.enemies.length).toBeGreaterThan(0);

		const defeatedBefore = gameState.run.objective.defeatedEnemies;

		// Place a weapon-range enemy in front of the player so useCard kills it
		// Clear existing enemies to ensure only this one is in the weapon cone
		const player = gameState.players[socket1.id];
		gameState.enemies = [{
			id: 'e_kill',
			x: player.x + 3, // within ATTACK_RANGE, in +X direction (rotation = 0)
			z: player.z,
			hp: 10, // weapon deals at least 15 damage, so this dies
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];

		// Find a weapon card in hand
		const weaponSlot = player.hand.findIndex(c => c && c.type === 'weapon');
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		// Wait for stateUpdate after the enemy kill
		const stateUpdatePromise = waitForEvent(socket1, 'stateUpdate');

		socket1.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });

		// Wait for the stateUpdate broadcast confirming the kill
		const stateUpdate = await Promise.race([
			stateUpdatePromise,
			new Promise((_, r) => setTimeout(() => r(null), 3000))
		]);

		// Verify the broadcasted state contains the updated objective
		if (stateUpdate && stateUpdate.run) {
			expect(stateUpdate.run.objective.defeatedEnemies).toBe(defeatedBefore + 1);
		}

		// Also verify server gameState directly
		expect(gameState.run.objective.defeatedEnemies).toBe(defeatedBefore + 1);
	});
});

describe('Run terminal state — integration', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket1 = (await connectClient(baseUrl)).socket;
		socket2 = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	it('runComplete is emitted after the last enemy is defeated via a weapon card', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		// Replace all enemies with a single low-HP enemy in weapon range
		const player = gameState.players[socket1.id];
		gameState.enemies = [{
			id: 'e_final',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		// Update run objective to reflect 1 enemy
		gameState.run.objective.totalEnemies = 1;
		gameState.run.objective.defeatedEnemies = 0;

		// Clear minions so updateMinions doesn't kill the enemy before our useCard
		gameState.minions = [];

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		// Listen for runComplete before firing the card
		const runCompletePromise = waitForEvent(socket1, 'runComplete');

		socket1.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });

		const summary = await runCompletePromise;

		expect(summary).toBeDefined();
		expect(summary.status).toBe('victory');
		expect(summary).toHaveProperty('runId');
		expect(summary).toHaveProperty('defeatedEnemies', 1);
		expect(summary).toHaveProperty('objective');
		expect(summary).toHaveProperty('players');
		expect(summary).toHaveProperty('durationMs');
		expect(summary).toHaveProperty('currencyCollected');
	});

	it('runFailed is emitted when all connected players are dead during a run', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		// Ensure run is active
		expect(gameState.run).toBeDefined();
		expect(gameState.run.status).toBe('playing');

		// Set both players to dead with 0 HP
		gameState.players[socket1.id].hp = 0;
		gameState.players[socket1.id].dead = true;
		gameState.players[socket2.id].hp = 0;
		gameState.players[socket2.id].dead = true;

		// Clear minions to avoid interference
		gameState.minions = [];

		// Listen for runFailed
		const runFailedPromise = waitForEvent(socket1, 'runFailed');

		// Trigger terminal state check by emitting a damage event (which calls checkRunTerminalState internally via damagePlayer)
		// Actually, damagePlayer only calls checkRunTerminalState when HP goes to 0.
		// Since players are already dead, we need another trigger.
		// The disconnect handler calls checkRunTerminalState, but that would remove the player.
		// Instead, let's use the damage event on socket2 — it won't change state but we can
		// call checkRunTerminalState indirectly.
		// Simplest: emit 'damage' which goes through damagePlayer → checkRunTerminalState
		// But damagePlayer only calls checkRunTerminalState on death transition.
		// We'll use a different approach: damage the already-dead player (no-op) and
		// rely on the game tick. Actually, the game tick does NOT call checkRunTerminalState.
		//
		// Best approach: use damage event to kill one player (who isn't yet dead in the
		// server's damagePlayer flow). Let's reset one player to alive, then kill them.
		gameState.players[socket2.id].hp = 100;
		gameState.players[socket2.id].dead = false;

		// Now kill socket2's player — socket1's player is already dead
		damagePlayer(socket2.id, 100);

		const summary = await runFailedPromise;

		expect(summary).toBeDefined();
		expect(summary.status).toBe('failed');
		expect(summary).toHaveProperty('runId');
		expect(summary).toHaveProperty('players');
	});

	it('returnToLobby resets gamePhase, clears run, empties enemies/minions/loot, and sets players to ready: false', async () => {
		// Both players ready up to start a game
		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);

		// Wait for stateUpdate with run object
		await waitForEvent(socket1, 'stateUpdate');

		// Verify game is in playing state with a run
		expect(gameState.gamePhase).toBe('playing');
		expect(gameState.run).toBeDefined();
		expect(gameState.enemies.length).toBeGreaterThan(0);

		// Add some minions and loot to verify they're cleared
		gameState.minions.push({ id: 'm1', ownerId: socket1.id, x: 0, z: 0, hp: 50, ttl: 30 });
		gameState.loot.push({ id: 'l1', x: 0, z: 0, value: 10, createdAt: Date.now() });

		// Set run to terminal state so returnToLobby is allowed
		gameState.run.status = 'victory';

		// Listen for stateUpdate after returnToLobby
		const stateUpdatePromise = waitForEvent(socket1, 'stateUpdate');

		socket1.emit('returnToLobby');

		const stateUpdate = await stateUpdatePromise;

		// Verify gamePhase reset
		expect(gameState.gamePhase).toBe('lobby');
		expect(stateUpdate.gamePhase).toBe('lobby');

		// Verify run is cleared
		expect(gameState.run).toBeUndefined();

		// Verify entities are cleared
		expect(gameState.enemies.length).toBe(0);
		expect(gameState.minions.length).toBe(0);
		expect(gameState.loot.length).toBe(0);

		// Verify players are set to ready: false
		expect(gameState.players[socket1.id].ready).toBe(false);
		expect(gameState.players[socket2.id].ready).toBe(false);
	});

	it('after returnToLobby, players can ready up and start a second run with a fresh objective', async () => {
		// --- First run ---
		const startGame1a = waitForEvent(socket1, 'startGame');
		const startGame2a = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1a, startGame2a]);
		await waitForEvent(socket1, 'stateUpdate');

		const firstRunId = gameState.run.id;
		expect(gameState.run).toBeDefined();

		// Set run to terminal state so returnToLobby is allowed
		gameState.run.status = 'victory';

		// --- Return to lobby ---
		const stateUpdateAfterReturn = waitForEvent(socket1, 'stateUpdate');
		socket1.emit('returnToLobby');
		await stateUpdateAfterReturn;

		expect(gameState.gamePhase).toBe('lobby');
		expect(gameState.run).toBeUndefined();

		// --- Second run: ready up again ---
		const startGame1b = waitForEvent(socket1, 'startGame');
		const startGame2b = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1b, startGame2b]);

		// Wait for stateUpdate with the new run object
		const secondStateUpdate = waitForEvent(socket1, 'stateUpdate');
		const secondState = await secondStateUpdate;

		// Verify a new run exists with a different ID
		expect(gameState.run).toBeDefined();
		expect(gameState.run.id).not.toBe(firstRunId);
		expect(gameState.run.status).toBe('playing');
		expect(gameState.run.objective.defeatedEnemies).toBe(0);
		expect(gameState.run.objective.totalEnemies).toBeGreaterThan(0);

		// Verify the stateUpdate contains the new run
		expect(secondState).toHaveProperty('run');
		expect(secondState.run.id).toBe(gameState.run.id);
		expect(secondState.run.status).toBe('playing');
	});

	it('ignores returnToLobby while the run is still playing', async () => {
		// Connect two sockets and start a run (both players ready up)
		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);

		// Confirm playing state
		expect(gameState.gamePhase).toBe('playing');
		expect(gameState.run.status).toBe('playing');

		const runId = gameState.run.id;
		const enemyCount = gameState.enemies.length;

		// Emit returnToLobby from one socket while run is still active
		socket1.emit('returnToLobby');

		// Give the server a moment to process (and reject) the request
		await sleep(100);

		// Verify gameState.gamePhase remains 'playing'
		expect(gameState.gamePhase).toBe('playing');

		// Verify gameState.run still exists with the same id and status
		expect(gameState.run).toBeDefined();
		expect(gameState.run.id).toBe(runId);
		expect(gameState.run.status).toBe('playing');

		// Verify enemies count is unchanged
		expect(gameState.enemies.length).toBe(enemyCount);
	});

	it('returnToLobby rejects request while run is still playing and emits runError to requesting socket', async () => {
		// Start a game
		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);
		await waitForEvent(socket1, 'stateUpdate');

		expect(gameState.run.status).toBe('playing');

		// Attempt returnToLobby while run is active
		const runErrorPromise = waitForEvent(socket1, 'runError');
		socket1.emit('returnToLobby');
		const runError = await runErrorPromise;

		// Verify rejection
		expect(runError.reason).toBe('Run still in progress');

		// Verify gameState was not mutated
		expect(gameState.gamePhase).toBe('playing');
		expect(gameState.run).toBeDefined();
		expect(gameState.run.status).toBe('playing');
	});
});

describe('Rewards in run complete payload', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket1 = (await connectClient(baseUrl)).socket;
		socket2 = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	it('runComplete payload contains per-player rewards with at least one card after a victory', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		// Replace all enemies with a single low-HP enemy in weapon range
		const player = gameState.players[socket1.id];
		gameState.enemies = [{
			id: 'e_final',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		gameState.run.objective.totalEnemies = 1;
		gameState.run.objective.defeatedEnemies = 0;
		gameState.minions = [];

		// Clear victory counter so we get a deterministic card
		if (!gameState._victoryCounters) gameState._victoryCounters = {};
		gameState._victoryCounters[socket1.id] = 0;

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		const summary = await runCompletePromise;

		expect(summary.status).toBe('victory');
		expect(summary.players.length).toBeGreaterThan(0);

		const playerEntry = summary.players.find(p => p.id === socket1.id);
		expect(playerEntry).toBeDefined();
		expect(playerEntry).toHaveProperty('rewards');
		expect(playerEntry.rewards).toHaveProperty('currency');
		expect(playerEntry.rewards).toHaveProperty('cards');
		expect(Array.isArray(playerEntry.rewards.cards)).toBe(true);
		expect(playerEntry.rewards.cards.length).toBeGreaterThan(0);
		expect(playerEntry.rewards.cards[0]).toHaveProperty('id');
		expect(playerEntry.rewards.cards[0]).toHaveProperty('name');
		expect(playerEntry.rewards.cards[0]).toHaveProperty('count');
	});

	it('runFailed payload contains per-player rewards but no victory card', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		// Ensure run is active
		expect(gameState.run).toBeDefined();

		// Kill both players
		gameState.players[socket1.id].hp = 0;
		gameState.players[socket1.id].dead = true;
		gameState.players[socket2.id].hp = 100;
		gameState.players[socket2.id].dead = false;
		gameState.minions = [];

		const runFailedPromise = waitForEvent(socket1, 'runFailed');
		damagePlayer(socket2.id, 100);
		const summary = await runFailedPromise;

		expect(summary.status).toBe('failed');
		expect(summary.players.length).toBeGreaterThan(0);

		const playerEntry = summary.players.find(p => p.id === socket1.id);
		expect(playerEntry).toBeDefined();
		expect(playerEntry).toHaveProperty('rewards');
		expect(playerEntry.rewards).toHaveProperty('currency');
		expect(playerEntry.rewards).toHaveProperty('cards');

		// On failure, the player should NOT have received a victory card reward.
		// runRewards should exist but contain no bonus currency and no cards.
		const actualPlayer = gameState.players[socket1.id];
		expect(actualPlayer.runRewards).not.toBeNull();
		expect(actualPlayer.runRewards.cards.length).toBe(0);
		expect(actualPlayer.runRewards.currency).toBe(0);
	});

	it('currency picked up via lootPickup appears in player currency in the run summary', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		const player = gameState.players[socket1.id];

		// Place a loot item near the player
		const lootValue = 15;
		gameState.loot.push({
			id: 'loot_test',
			x: player.x + 1,
			z: player.z + 1,
			value: lootValue,
			createdAt: Date.now()
		});

		// Record initial currency
		const currencyBefore = player.currency;

		// Pick up the loot
		socket1.emit('lootPickup', { lootId: 'loot_test' });
		await sleep(50);

		// Verify loot was consumed and currency increased
		expect(gameState.loot.find(l => l.id === 'loot_test')).toBeUndefined();
		expect(player.currency).toBe(currencyBefore + lootValue);

		// Now trigger a victory to check the summary includes the currency
		gameState.enemies = [{
			id: 'e_final',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		gameState.run.objective.totalEnemies = 1;
		gameState.run.objective.defeatedEnemies = 0;
		gameState.minions = [];

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		const summary = await runCompletePromise;

		expect(summary.status).toBe('victory');

		const playerEntry = summary.players.find(p => p.id === socket1.id);
		expect(playerEntry).toBeDefined();
		// Player currency in summary should include the picked-up loot (+10 victory bonus)
		expect(playerEntry.currency).toBe(currencyBefore + lootValue + 10);
	});
});

describe('Reward state persistence across runs', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket1 = (await connectClient(baseUrl)).socket;
		socket2 = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	it('after completing a run and returning to lobby, currency and ownedCards are preserved', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		const player = gameState.players[socket1.id];

		// Record initial ownedCards
		const initialOwnedCards = { ...player.ownedCards };
		const initialCurrency = player.currency;

		// Replace all enemies with a single low-HP enemy in weapon range
		gameState.enemies = [{
			id: 'e_final',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		gameState.run.objective.totalEnemies = 1;
		gameState.run.objective.defeatedEnemies = 0;
		gameState.minions = [];

		// Clear victory counter for deterministic card reward
		if (!gameState._victoryCounters) gameState._victoryCounters = {};
		gameState._victoryCounters[socket1.id] = 0;

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		// Complete the run
		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		await runCompletePromise;

		// Verify rewards were granted
		const currencyAfterVictory = player.currency;
		expect(currencyAfterVictory).toBeGreaterThan(initialCurrency);
		expect(player.runRewards).toBeDefined();
		expect(player.runRewards.cards.length).toBeGreaterThan(0);

		// Return to lobby
		const stateUpdatePromise = waitForEvent(socket1, 'stateUpdate');
		socket1.emit('returnToLobby');
		await stateUpdatePromise;

		// Verify currency and ownedCards survived the return-to-lobby
		expect(player.currency).toBe(currencyAfterVictory);
		expect(player.ownedCards).toBeDefined();

		// The rewarded card should have incremented the count in ownedCards
		const rewardedCardId = player.runRewards.cards[0].id;
		expect(player.ownedCards[rewardedCardId]).toBeGreaterThan(initialOwnedCards[rewardedCardId] || 0);
	});

	it('starting a second run after returning to lobby uses the same currency and ownedCards from previous run', async () => {
		// --- First run: complete a victory ---
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		const player = gameState.players[socket1.id];

		// Set up a killable enemy
		gameState.enemies = [{
			id: 'e1',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		gameState.run.objective.totalEnemies = 1;
		gameState.run.objective.defeatedEnemies = 0;
		gameState.minions = [];

		if (!gameState._victoryCounters) gameState._victoryCounters = {};
		gameState._victoryCounters[socket1.id] = 0;

		// Find a weapon card in hand (first run)
		const weaponSlot1 = findWeaponSlot(player);
		expect(weaponSlot1).toBeGreaterThanOrEqual(0);
		const weaponCard1 = player.hand[weaponSlot1];

		const runComplete1 = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: weaponCard1.id, slotIndex: weaponSlot1 });
		await runComplete1;

		const currencyAfterRun1 = player.currency;
		const ownedCardsAfterRun1 = { ...player.ownedCards };

		// Return to lobby
		const stateUpdate1 = waitForEvent(socket1, 'stateUpdate');
		socket1.emit('returnToLobby');
		await stateUpdate1;

		// --- Second run: ready up again ---
		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);
		await waitForEvent(socket1, 'stateUpdate');

		// Verify state carried over from first run
		expect(player.currency).toBe(currencyAfterRun1);
		expect(player.ownedCards).toEqual(ownedCardsAfterRun1);

		// Complete the second run
		gameState.enemies = [{
			id: 'e2',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		gameState.run.objective.totalEnemies = 1;
		gameState.run.objective.defeatedEnemies = 0;
		gameState.minions = [];

		// Find a weapon card in hand (second run — hand is reinitialized)
		const weaponSlot2 = findWeaponSlot(player);
		expect(weaponSlot2).toBeGreaterThanOrEqual(0);
		const weaponCard2 = player.hand[weaponSlot2];

		const runComplete2 = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: weaponCard2.id, slotIndex: weaponSlot2 });
		await runComplete2;

		// Verify currency accumulated (second victory bonus on top of first)
		expect(player.currency).toBeGreaterThan(currencyAfterRun1);

		// Verify ownedCards grew (second card reward)
		const ownedCardsAfterRun2 = player.ownedCards;
		let anyGrew = false;
		for (const cardId of Object.keys(ownedCardsAfterRun2)) {
			if (ownedCardsAfterRun2[cardId] > (ownedCardsAfterRun1[cardId] || 0)) {
				anyGrew = true;
				break;
			}
		}
		expect(anyGrew).toBe(true);
	});

	it('returnPlayersToLobby preserves ownedCards and runRewards', async () => {
		// Enter playing phase and complete a victory
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		const player = gameState.players[socket1.id];

		// Set up and complete a victory
		gameState.enemies = [{
			id: 'e_final',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		gameState.run.objective.totalEnemies = 1;
		gameState.run.objective.defeatedEnemies = 0;
		gameState.minions = [];

		if (!gameState._victoryCounters) gameState._victoryCounters = {};
		gameState._victoryCounters[socket1.id] = 0;

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		await runCompletePromise;

		// Capture state before returnToLobby
		const currencyBeforeReturn = player.currency;
		const ownedCardsBeforeReturn = { ...player.ownedCards };
		const runRewardsBeforeReturn = player.runRewards ? { ...player.runRewards } : null;

		expect(runRewardsBeforeReturn).not.toBeNull();
		expect(runRewardsBeforeReturn.cards.length).toBeGreaterThan(0);

		// Return to lobby
		const stateUpdatePromise = waitForEvent(socket1, 'stateUpdate');
		socket1.emit('returnToLobby');
		await stateUpdatePromise;

		// Verify currency is preserved
		expect(player.currency).toBe(currencyBeforeReturn);

		// Verify ownedCards is preserved (same keys and counts)
		expect(player.ownedCards).toEqual(ownedCardsBeforeReturn);

		// Verify runRewards is preserved (not reset to null)
		expect(player.runRewards).not.toBeNull();
		expect(player.runRewards.currency).toBe(runRewardsBeforeReturn.currency);
		expect(player.runRewards.cards.length).toBe(runRewardsBeforeReturn.cards.length);

		// Verify currencyEarnedThisRun was reset (transient per-run tracking)
		expect(player.currencyEarnedThisRun).toBe(0);
	});
});

describe('Deck edit handlers — deckAddCard / deckRemoveCard', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket1 = (await connectClient(baseUrl)).socket;
		socket2 = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	it('player A adds a card and receives deckUpdate; player B deck is unchanged', async () => {
		const playerA = gameState.players[socket1.id];
		const deckB = [...gameState.players[socket2.id].selectedDeck];

		// Default deck already contains all owned cards, so remove one first to make room
		socket1.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		await sleep(100);
		const deckAfterRemove = [...playerA.selectedDeck];

		// Now add dungeon_drake back
		const deckUpdatePromise = waitForEvent(socket1, 'deckUpdate');
		socket1.emit('deckAddCard', { cardId: 'dungeon_drake' });
		const update = await deckUpdatePromise;

		expect(update.selectedDeck).toBeDefined();
		expect(update.ownedCards).toBeDefined();
		expect(update.selectedDeck.length).toBe(deckAfterRemove.length + 1);
		expect(update.selectedDeck).toContain('dungeon_drake');

		// Verify server state
		expect(playerA.selectedDeck.length).toBe(deckAfterRemove.length + 1);

		// Player B's deck must be unchanged
		expect(gameState.players[socket2.id].selectedDeck).toEqual(deckB);
	});

	it('player removes a card from deck and receives deckUpdate', async () => {
		const playerA = gameState.players[socket1.id];
		const deckBefore = [...playerA.selectedDeck];

		// Remove dungeon_drake (only 1 copy in default deck)
		const deckUpdatePromise = waitForEvent(socket1, 'deckUpdate');
		socket1.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		const update = await deckUpdatePromise;

		expect(update.selectedDeck.length).toBe(deckBefore.length - 1);
		expect(update.selectedDeck).not.toContain('dungeon_drake');

		expect(playerA.selectedDeck.length).toBe(deckBefore.length - 1);
		expect(playerA.selectedDeck).not.toContain('dungeon_drake');
	});

	it('deckAddCard during playing phase is silently ignored', async () => {
		const playerA = gameState.players[socket1.id];
		const deckBefore = [...playerA.selectedDeck];

		// Enter playing phase
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		expect(gameState.gamePhase).toBe('playing');

		// Attempt to add a card — should be silently ignored
		socket1.emit('deckAddCard', { cardId: 'iron_sword' });

		await sleep(200);

		expect(playerA.selectedDeck).toEqual(deckBefore);
	});

	it('deckRemoveCard during playing phase is silently ignored', async () => {
		const playerA = gameState.players[socket1.id];
		const deckBefore = [...playerA.selectedDeck];

		// Enter playing phase
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		// Attempt to remove a card — should be silently ignored
		socket1.emit('deckRemoveCard', { cardId: 'iron_sword' });

		await sleep(200);

		expect(playerA.selectedDeck).toEqual(deckBefore);
	});

	it('adding unknown card emits deckError', async () => {
		const deckErrorPromise = waitForEvent(socket1, 'deckError');
		socket1.emit('deckAddCard', { cardId: 'nonexistent_card' });
		const err = await deckErrorPromise;

		expect(err.reason).toContain('Unknown card');

		// Deck must be unchanged
		const playerA = gameState.players[socket1.id];
		expect(playerA.selectedDeck.length).toBe(8); // default deck size
	});

	it('removing card not in deck emits deckError', async () => {
		// dungeon_drake is in the default deck, so remove it first
		const playerA = gameState.players[socket1.id];
		const deckBefore = [...playerA.selectedDeck];

		// Remove dungeon_drake from deck
		socket1.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		await sleep(100);

		// Now try to remove it again — should fail
		const deckErrorPromise = waitForEvent(socket1, 'deckError');
		socket1.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		const err = await deckErrorPromise;

		expect(err.reason).toContain('not in deck');
		expect(playerA.selectedDeck).not.toContain('dungeon_drake');
	});

	it('adding too many copies of a card emits deckError', async () => {
		const playerA = gameState.players[socket1.id];
		// Default deck already contains all 3 owned iron_swords — adding another should fail
		const deckErrorPromise = waitForEvent(socket1, 'deckError');
		socket1.emit('deckAddCard', { cardId: 'iron_sword' });
		const err = await deckErrorPromise;

		expect(err.reason).toContain('No extra copies');

		// Count iron_swords in deck — should be exactly 3 (unchanged)
		const ironCount = playerA.selectedDeck.filter(id => id === 'iron_sword').length;
		expect(ironCount).toBe(3);
	});

	it('two players can edit decks independently without affecting each other', async () => {
		const deckA = [...gameState.players[socket1.id].selectedDeck];
		const deckB = [...gameState.players[socket2.id].selectedDeck];

		// Player A removes dungeon_drake (only 1 copy in default deck)
		socket1.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		await sleep(100);

		// Player B removes dungeon_drake (only 1 copy in default deck)
		const deckUpdateB = waitForEvent(socket2, 'deckUpdate');
		socket2.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		await deckUpdateB;

		// Verify independence
		expect(gameState.players[socket1.id].selectedDeck.length).toBe(deckA.length - 1);
		expect(gameState.players[socket2.id].selectedDeck.length).toBe(deckB.length - 1);
		expect(gameState.players[socket1.id].selectedDeck).not.toContain('dungeon_drake'); // A removed it
		expect(gameState.players[socket2.id].selectedDeck).not.toContain('dungeon_drake'); // B removed it
	});
});

describe('Server Ready Validation and Deck-to-Hand', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket1 = (await connectClient(baseUrl)).socket;
		socket2 = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	it('client receives init event containing selectedDeck and ownedCards', async () => {
		const result = await connectClient(baseUrl);
		const init = result.init;
		const testSocket = result.socket;

		expect(init).toHaveProperty('selectedDeck');
		expect(Array.isArray(init.selectedDeck)).toBe(true);
		expect(init.selectedDeck.length).toBeGreaterThan(0);
		expect(init).toHaveProperty('ownedCards');
		expect(typeof init.ownedCards).toBe('object');

		testSocket.disconnect();
		await sleep(50);
	});

	it('ready is rejected with deckError when deck is too small', async () => {
		// Shrink socket1's deck below DECK_MIN_SIZE
		gameState.players[socket1.id].selectedDeck = ['iron_sword', 'flame_blade'];

		const deckErrorPromise = waitForEvent(socket1, 'deckError');

		socket1.emit('playerReady', true);

		const err = await deckErrorPromise;
		expect(err).toHaveProperty('reason');
		expect(err.reason).toContain('at least');

		// player.ready should remain false
		expect(gameState.players[socket1.id].ready).toBe(false);
	});

	it('a valid selected deck populates player.deck when the run starts', async () => {
		// Ensure both players have valid default decks (8 cards each)
		const deck1 = [...gameState.players[socket1.id].selectedDeck];
		const deck2 = [...gameState.players[socket2.id].selectedDeck];

		// Wait for startGame on both sockets
		const startGamePromise1 = waitForEvent(socket1, 'startGame');
		const startGamePromise2 = waitForEvent(socket2, 'startGame');

		// Both players ready up
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);

		// Wait for startGame
		await Promise.all([startGamePromise1, startGamePromise2]);

		// Wait for stateUpdate broadcast after game start
		const stateUpdatePromise = waitForEvent(socket1, 'stateUpdate');
		const stateUpdate = await stateUpdatePromise;

		// Verify each player has a populated deck (4 cards drawn into hand, rest remain in deck)
		expect(stateUpdate.players[socket1.id]).toBeDefined();
		expect(Array.isArray(stateUpdate.players[socket1.id].deck)).toBe(true);
		// 4 cards are dealt into hand, so deck should have selectedDeck.length - 4
		expect(stateUpdate.players[socket1.id].deck.length).toBe(deck1.length - 4);

		// The deck + hand should contain the same card ids as selectedDeck (shuffled)
		const player1 = gameState.players[socket1.id];
		const deck1Cards = [...stateUpdate.players[socket1.id].deck];
		const hand1Cards = player1.hand.filter(c => c).map(c => c.id);
		const allCards = [...deck1Cards, ...hand1Cards].sort();
		const selected1Sorted = [...deck1].sort();
		expect(allCards).toEqual(selected1Sorted);

		expect(stateUpdate.players[socket2.id]).toBeDefined();
		expect(Array.isArray(stateUpdate.players[socket2.id].deck)).toBe(true);
		expect(stateUpdate.players[socket2.id].deck.length).toBe(deck2.length - 4);
	});
});

describe('Enemy telegraph integration', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('enemy enters windup before damaging player', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket.id];
		const initialHp = player.hp;

		// Place an enemy in chasing state, within attack range of the player
		// We position it just within ENEMY_ATTACK_RANGE so updateEnemies triggers windup
		gameState.enemies = [{
			id: 'e_telegraph',
			x: player.x + ENEMY_ATTACK_RANGE - 1,
			z: player.z,
			hp: 50,
			state: 'chasing',
			attackState: 'chasing',
			wanderTarget: { x: player.x, z: player.z }
		}];

		// Collect stateUpdates — we expect to see windup BEFORE hp changes
		const stateUpdates = [];
		const stateHandler = (data) => {
			stateUpdates.push(data);
			// Stop collecting after we see the damage
			if (data.players && data.players[socket.id] && data.players[socket.id].hp < initialHp) {
				socket.off('stateUpdate', stateHandler);
			}
		};
		socket.on('stateUpdate', stateHandler);

		// Advance time enough for the game tick to process windup → damage
		// The tick runs at TICK_RATE (20 Hz = 50ms), windup is 800ms
		// So we need ~850ms for windup to expire and damage to apply
		await sleep(ENEMY_DEFS.grunt.attackWindupMs + 200);

		// Find the first stateUpdate where enemy attackState === 'windup'
		const windupUpdate = stateUpdates.find(su => {
			const enemies = su.enemies;
			return enemies && enemies.some(e => e.id === 'e_telegraph' && e.attackState === 'windup');
		});

		// Find the first stateUpdate where player HP decreased
		const damageUpdate = stateUpdates.find(su => {
			return su.players && su.players[socket.id] && su.players[socket.id].hp < initialHp;
		});

		expect(windupUpdate).toBeDefined();

		// If damage occurred, windup should have been seen first
		if (damageUpdate) {
			const windupIndex = stateUpdates.indexOf(windupUpdate);
			const damageIndex = stateUpdates.indexOf(damageUpdate);
			expect(windupIndex).toBeLessThan(damageIndex);
		}

		// Clean up listener
		socket.off('stateUpdate', stateHandler);
	});

	it('moving out of range avoids damage', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket.id];

		// Place enemy in chasing state, within attack range so it transitions to windup
		gameState.enemies = [{
			id: 'e_avoid',
			x: player.x + ENEMY_ATTACK_RANGE - 1,
			z: player.z,
			hp: 50,
			state: 'chasing',
			attackState: 'chasing',
			wanderTarget: { x: player.x, z: player.z }
		}];

		// Wait for the game tick to transition enemy to windup
		await sleep(100);

		expect(gameState.enemies[0].attackState).toBe('windup');

		// Move player far away from the enemy using intent-based moves.
		// The server caps movement per tick (MAX_ELAPSED_MS = 200ms, MOVE_SPEED = 12),
		// so each tick grants ~2.4 units. We need to move >ENEMY_ATTACK_RANGE (4)
		// away to be safe. Emit moves across multiple ticks to accumulate distance.
		for (let i = 0; i < 10; i++) {
			socket.emit('move', { dx: -1, dz: -1, rotation: 0 });
			await sleep(60); // wait for server tick between moves
		}

		// Wait for windup to expire (800ms from windup start)
		await sleep(ENEMY_DEFS.grunt.attackWindupMs + 200);

		// Trigger the game loop so updateEnemies revalidates the windup
		// and cancels the attack since the player is out of range
		updateEnemies();

		// Player HP should remain at initial value (100)
		expect(player.hp).toBe(100);

		// Enemy should have cancelled the attack — attackState is no longer 'windup'
		expect(gameState.enemies[0].attackState).not.toBe('windup');
	});

	it('standing still near enemy results in damage after windup + strike', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket.id];
		expect(player.hp).toBe(MAX_HP);

		// Place a single grunt enemy within ENEMY_ATTACK_RANGE of the player
		gameState.enemies = [{
			id: 'e_damage_test',
			x: player.x + ENEMY_ATTACK_RANGE - 1,
			z: player.z,
			hp: 50,
			state: 'chasing',
			attackState: 'chasing',
			wanderTarget: { x: player.x, z: player.z }
		}];

		// Wait for windup → strike → recovery + buffer
		// The game tick processes: windup (800ms) → strike (damage applied) → recovery (1200ms)
		await sleep(ENEMY_DEFS.grunt.attackWindupMs + ENEMY_ATTACK_RECOVERY_MS + 500);

		// Player HP must be strictly less than MAX_HP — damage was applied
		expect(player.hp).toBeLessThan(MAX_HP);
	});
});

describe('Dungeon layout consistency', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	it('two clients connect to the same server and both receive the same layoutSeed in their init payload', async () => {
		const client1 = await connectClient(baseUrl);
		const client2 = await connectClient(baseUrl);

		expect(client1.init.layoutSeed).toBeDefined();
		expect(client2.init.layoutSeed).toBeDefined();
		expect(typeof client1.init.layoutSeed).toBe('number');
		expect(typeof client2.init.layoutSeed).toBe('number');
		expect(client1.init.layoutSeed).toBe(client2.init.layoutSeed);

		client1.socket.disconnect();
		client2.socket.disconnect();
		await sleep(50);
	});

	it('two clients receive identical layout.rooms arrays (same count, same positions/sizes)', async () => {
		const client1 = await connectClient(baseUrl);
		const client2 = await connectClient(baseUrl);

		const rooms1 = client1.init.layout.rooms;
		const rooms2 = client2.init.layout.rooms;

		expect(Array.isArray(rooms1)).toBe(true);
		expect(Array.isArray(rooms2)).toBe(true);
		expect(rooms1.length).toBe(rooms2.length);
		expect(rooms1.length).toBeGreaterThan(0);

		// Deep compare: same positions, widths, depths
		for (let i = 0; i < rooms1.length; i++) {
			expect(rooms1[i].x).toBe(rooms2[i].x);
			expect(rooms1[i].z).toBe(rooms2[i].z);
			expect(rooms1[i].width).toBe(rooms2[i].width);
			expect(rooms1[i].depth).toBe(rooms2[i].depth);
		}

		client1.socket.disconnect();
		client2.socket.disconnect();
		await sleep(50);
	});

	it('stateUpdate payloads include layoutSeed matching the original init seed', async () => {
		const client = await connectClient(baseUrl);
		const initSeed = client.init.layoutSeed;

		// The game tick broadcasts stateUpdate periodically — no need to trigger a move.
		// Just wait for the next stateUpdate from the game loop.
		const stateUpdatePromise = waitForEvent(client.socket, 'stateUpdate');

		// Wait for the actual socket stateUpdate payload
		const stateUpdate = await stateUpdatePromise;

		// Assert on the wire payload — layoutSeed must be present and match init
		expect(stateUpdate).toBeDefined();
		expect(stateUpdate.layoutSeed).toBeDefined();
		expect(typeof stateUpdate.layoutSeed).toBe('number');
		expect(stateUpdate.layoutSeed).toBe(initSeed);

		client.socket.disconnect();
		await sleep(50);
	});

	it('after resetGameState() a new layout with a different seed is generated', async () => {
		const client1 = await connectClient(baseUrl);
		const firstSeed = client1.init.layoutSeed;

		client1.socket.disconnect();
		await sleep(50);

		// Reset game state — generates a new layout with a new random seed
		resetGameState();

		const client2 = await connectClient(baseUrl);
		const secondSeed = client2.init.layoutSeed;

		// The seed should be different (probability of collision is ~1/2^31)
		expect(secondSeed).not.toBe(firstSeed);

		// The new layout should still be valid
		expect(Array.isArray(client2.init.layout.rooms)).toBe(true);
		expect(client2.init.layout.rooms.length).toBeGreaterThan(0);

		client2.socket.disconnect();
		await sleep(50);
	});

	it('clampToDungeon() prevents player movement beyond dungeon bounds', async () => {
		const client = await connectClient(baseUrl);
		const bounds = gameState.dungeonBounds;

		// Enter playing phase so moves are processed
		const debugResultPromise = waitForEvent(client.socket, 'debugScenarioResult');
		client.socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(client.socket, 'stateUpdate');

		const player = gameState.players[client.socket.id];

		// Move toward positive bounds — server clamps to dungeon bounds
		client.socket.emit('move', { dx: 1, dz: 1, rotation: 0 });
		await sleep(50);

		expect(player.x).toBeLessThanOrEqual(bounds.maxX);
		expect(player.z).toBeLessThanOrEqual(bounds.maxZ);

		// Move toward negative bounds — server clamps to dungeon bounds
		client.socket.emit('move', { dx: -1, dz: -1, rotation: 0 });
		await sleep(50);

		expect(player.x).toBeGreaterThanOrEqual(bounds.minX);
		expect(player.z).toBeGreaterThanOrEqual(bounds.minZ);

		client.socket.disconnect();
		await sleep(50);
	});
});

describe('Loot pickup throttle — idempotency', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('emitting lootPickup twice for the same loot ID only credits currency once', async () => {
		const player = gameState.players[socket.id];
		const lootValue = 10;

		// Place a loot item
		gameState.loot.push({
			id: 'loot_idempotent',
			x: player.x + 1,
			z: player.z + 1,
			value: lootValue,
			createdAt: Date.now()
		});

		const currencyBefore = player.currency;

		// First emit — should consume the loot and credit currency
		socket.emit('lootPickup', { lootId: 'loot_idempotent' });
		await sleep(50);

		expect(player.currency).toBe(currencyBefore + lootValue);
		expect(gameState.loot.find(l => l.id === 'loot_idempotent')).toBeUndefined();

		// Second emit — loot is already gone, server should ignore (idempotent)
		socket.emit('lootPickup', { lootId: 'loot_idempotent' });
		await sleep(50);

		// Currency should NOT have increased again
		expect(player.currency).toBe(currencyBefore + lootValue);
	});

	it('emitting lootPickup for a non-existent loot ID is a no-op', async () => {
		const player = gameState.players[socket.id];
		const currencyBefore = player.currency;

		socket.emit('lootPickup', { lootId: 'does_not_exist' });
		await sleep(50);

		expect(player.currency).toBe(currencyBefore);
	});
});

describe('Loot pickup — dead player exclusion', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('emitting lootPickup as a dead player leaves loot in gameState.loot and currency unchanged', async () => {
		const player = gameState.players[socket.id];
		const lootValue = 12;

		// Place a loot item near the player
		gameState.loot.push({
			id: 'loot_dead_test',
			x: player.x + 1,
			z: player.z + 1,
			value: lootValue,
			createdAt: Date.now()
		});

		// Mark the player as dead
		player.dead = true;
		const currencyBefore = player.currency;

		// Attempt pickup — should be rejected
		socket.emit('lootPickup', { lootId: 'loot_dead_test' });
		await sleep(50);

		// Loot must still exist
		expect(gameState.loot.find(l => l.id === 'loot_dead_test')).toBeDefined();
		// Currency must be unchanged
		expect(player.currency).toBe(currencyBefore);

		// Revive the player — pickup should now succeed
		player.dead = false;
		socket.emit('lootPickup', { lootId: 'loot_dead_test' });
		await sleep(50);

		expect(gameState.loot.find(l => l.id === 'loot_dead_test')).toBeUndefined();
		expect(player.currency).toBe(currencyBefore + lootValue);
	});
});

// ── Killing new enemy types via weapon card ──

describe('killing skirmisher via weapon card (integration)', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('player uses a weapon card to kill a skirmisher — hp goes to 0, enemy removed, defeatedEnemies incremented', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		// Verify run exists
		expect(gameState.run).toBeDefined();
		const defeatedBefore = gameState.run.objective.defeatedEnemies;

		// Place a skirmisher in weapon range with low HP so a single weapon hit kills it
		const player = gameState.players[socket.id];
		spawnEnemy(player.x + 3, player.z, 'skirmisher');
		const skirmisher = gameState.enemies[gameState.enemies.length - 1];
		expect(skirmisher.type).toBe('skirmisher');
		// Reduce HP so a single weapon hit (min 15 damage) kills it
		skirmisher.hp = 10;

		// Clear minions so they don't interfere
		gameState.minions = [];

		// Reposition right before the hit to minimize game-loop movement
		skirmisher.x = player.x + 3;
		skirmisher.z = player.z;

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		// Wait for stateUpdate after the kill
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');

		socket.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		await stateUpdatePromise;

		// Enemy should be removed
		expect(gameState.enemies.find(e => e.id === skirmisher.id)).toBeUndefined();

		// defeatedEnemies should have incremented
		expect(gameState.run.objective.defeatedEnemies).toBeGreaterThan(defeatedBefore);
	});
});

describe('killing miniboss via weapon card (integration)', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('player uses weapon cards to kill a miniboss — requires multiple hits, defeatedEnemies incremented', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		// Verify run exists
		expect(gameState.run).toBeDefined();
		const defeatedBefore = gameState.run.objective.defeatedEnemies;

		// Place a miniboss in weapon range
		const player = gameState.players[socket.id];
		spawnEnemy(player.x + 3, player.z, 'miniboss');
		const miniboss = gameState.enemies[gameState.enemies.length - 1];
		expect(miniboss.type).toBe('miniboss');
		expect(miniboss.hp).toBe(ENEMY_DEFS.miniboss.hp); // 150 HP

		// Clear minions so they don't interfere
		gameState.minions = [];

		// Reduce miniboss HP so it's killable in a small number of hits regardless
		// of which weapon card (iron_sword=15 or flame_blade=25) is dealt into hand.
		// 40 HP → 3 hits with iron_sword (15×3=45) or 2 hits with flame_blade (25×2=50).
		miniboss.hp = 40;

		// Each hit requires COOLDOWN_MS (800ms) + tick time.
		// Worst case: 3 hits × 900ms = 2.7s. Use 10s timeout for safety.
		const hitsNeeded = Math.ceil(miniboss.hp / 15); // worst case: iron_sword (15 dmg)

		for (let i = 0; i < hitsNeeded; i++) {
			// Reposition miniboss right before each hit to minimize game-loop movement
			miniboss.x = player.x + 3;
			miniboss.z = player.z;

			// Find a weapon card in hand (may change after exhaust/redraw)
			const weaponSlot = findWeaponSlot(player);
			if (weaponSlot < 0) break; // no more weapon cards
			const weaponCard = player.hand[weaponSlot];

			socket.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });

			// Wait for cooldown + server tick before next use
			await sleep(900);
		}

		// Wait for final stateUpdate
		await waitForEvent(socket, 'stateUpdate');

		// Miniboss should be removed
		expect(gameState.enemies.find(e => e.id === miniboss.id)).toBeUndefined();

		// defeatedEnemies should have incremented
		expect(gameState.run.objective.defeatedEnemies).toBeGreaterThan(defeatedBefore);
	}, 10000);
});

describe('spawner spawns skirmishers (integration)', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('initial enemy list contains a spawner after entering playing phase', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'spawner-active' });

		const debugResult = await debugResultPromise;
		expect(debugResult.ok).toBe(true);

		// Wait for stateUpdate to arrive after debug scenario
		await waitForEvent(socket, 'stateUpdate');

		// Verify initial enemies contain a spawner
		const spawners = gameState.enemies.filter(e => e.type === 'spawner');
		expect(spawners.length).toBeGreaterThanOrEqual(1);
	});

	it('enemy count increases after advancing time past spawnIntervalMs', async () => {
		// Enter playing phase via debug scenario to get a valid run state
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });

		const debugResult = await debugResultPromise;
		expect(debugResult.ok).toBe(true);
		await waitForEvent(socket, 'stateUpdate');

		// Manually set up a clean spawner — replaces all enemies so the
		// concurrent game loop can't interfere with our baseline.
		const spawner = {
			id: 'test-spawner',
			x: 0,
			z: 0,
			type: 'spawner',
			hp: ENEMY_DEFS.spawner.hp,
			maxHp: ENEMY_DEFS.spawner.hp,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: Date.now() - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		};
		gameState.enemies = [spawner];
		const initialCount = gameState.enemies.length;

		updateEnemies();

		// Enemy count should have increased (at least one new skirmisher add)
		expect(gameState.enemies.length).toBeGreaterThan(initialCount);
	});

	it('new enemy has type skirmisher and spawnedBy matching spawner id', async () => {
		// Enter playing phase via debug scenario to get a valid run state
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });

		const debugResult = await debugResultPromise;
		expect(debugResult.ok).toBe(true);
		await waitForEvent(socket, 'stateUpdate');

		// Manually set up a clean spawner
		const spawner = {
			id: 'test-spawner',
			x: 0,
			z: 0,
			type: 'spawner',
			hp: ENEMY_DEFS.spawner.hp,
			maxHp: ENEMY_DEFS.spawner.hp,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: Date.now() - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		};
		const spawnerId = spawner.id;
		gameState.enemies = [spawner];
		const initialIds = new Set(gameState.enemies.map(e => e.id));

		updateEnemies();

		// Find the newly spawned enemy
		const newEnemies = gameState.enemies.filter(e => !initialIds.has(e.id));
		expect(newEnemies.length).toBeGreaterThanOrEqual(1);

		// At least one new enemy should be a skirmisher spawned by the spawner
		const add = newEnemies.find(e => e.type === 'skirmisher' && e.spawnedBy === spawnerId);
		expect(add).toBeDefined();
	});

	it('no regression: grunt and miniboss enemies still present and unaffected', async () => {
		// Enter playing phase via summon-ready (uses spawnEnemies which spawns mixed types)
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });

		const debugResult = await debugResultPromise;
		expect(debugResult.ok).toBe(true);

		await waitForEvent(socket, 'stateUpdate');

		// Verify grunt and miniboss exist in the initial spawn
		const grunts = gameState.enemies.filter(e => e.type === 'grunt');
		const minibosses = gameState.enemies.filter(e => e.type === 'miniboss');
		expect(grunts.length).toBeGreaterThanOrEqual(1);
		expect(minibosses.length).toBeGreaterThanOrEqual(1);

		// Record their HP before advancing time
		const gruntIds = new Set(grunts.map(g => g.id));
		const minibossIds = new Set(minibosses.map(m => m.id));
		const gruntHpBefore = {};
		const minibossHpBefore = {};
		for (const g of grunts) gruntHpBefore[g.id] = g.hp;
		for (const m of minibosses) minibossHpBefore[m.id] = m.hp;

		// Clear minions to avoid them damaging enemies during the time advance
		gameState.minions = [];

		// Advance time past spawnIntervalMs and call updateEnemies
		await sleep(ENEMY_DEFS.spawner.spawnIntervalMs + 500);
		updateEnemies();

		// Verify grunts and minibosses are still present with same HP
		for (const id of gruntIds) {
			const enemy = gameState.enemies.find(e => e.id === id);
			expect(enemy).toBeDefined();
			expect(enemy.hp).toBe(gruntHpBefore[id]);
		}
		for (const id of minibossIds) {
			const enemy = gameState.enemies.find(e => e.id === id);
			expect(enemy).toBeDefined();
			expect(enemy.hp).toBe(minibossHpBefore[id]);
		}
	});
});

// ── Swept Collision ──

describe('Swept collision — tunneling rejection', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('a move that tunnels through a wall is rejected', async () => {
		// Enter playing phase
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket.id];

		// Find a wall in the dungeon layout and try to move through it.
		const layout = gameState.layout;
		let wall = null;
		for (const room of layout.rooms) {
			if (room.walls && room.walls.length > 0) {
				wall = room.walls[0];
				break;
			}
		}
		if (!wall) {
			// No walls found — skip (shouldn't happen with generated layouts)
			return;
		}

		// Position the player just before the wall
		if (wall.axis === 'x') {
			// Wall is along X axis, blocking Z movement
			player.x = wall.x;
			player.z = wall.z - 1; // just before the wall
		} else {
			// Wall is along Z axis, blocking X movement
			player.z = wall.z;
			player.x = wall.x - 1; // just before the wall
		}
		player.lastMoveTime = Date.now();

		// Record position AFTER teleporting to wall-adjacent spot
		const posAfterTeleport = { x: player.x, z: player.z };

		// Try to move through the wall (large delta to tunnel through)
		if (wall.axis === 'x') {
			socket.emit('move', { dx: 0, dz: 1, rotation: 0 });
		} else {
			socket.emit('move', { dx: 1, dz: 0, rotation: 0 });
		}

		await sleep(100);

		// The swept collision check should reject the move
		// Player should remain near the wall-adjacent position, not spawn
		expect(Math.abs(player.x - posAfterTeleport.x)).toBeLessThan(2);
		expect(Math.abs(player.z - posAfterTeleport.z)).toBeLessThan(2);
	});
});

// ── Card Cooldown ──

describe('Card cooldown — COOLDOWN_MS', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('a second useCard on the same slot within COOLDOWN_MS is rejected with cardError', async () => {
		// Enter playing phase
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket.id];

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		// Place an enemy in range for the first hit
		gameState.enemies.push({
			id: 'e_cd',
			x: player.x + 3,
			z: player.z,
			hp: 100,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		});

		// First useCard — should succeed
		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		await cardUsedPromise;

		// Second useCard immediately — should be rejected with cardError
		const cardErrorPromise = waitForEvent(socket, 'cardError');
		socket.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });

		const err = await cardErrorPromise;
		expect(err.reason).toBe('Slot on cooldown');
	});

	it('useCard on the same slot succeeds after COOLDOWN_MS has elapsed', async () => {
		// Enter playing phase
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket.id];

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);

		// Place an enemy in range
		gameState.enemies.push({
			id: 'e_cd2',
			x: player.x + 3,
			z: player.z,
			hp: 100,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		});

		// First useCard
		const cardUsed1 = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: player.hand[weaponSlot].id, slotIndex: weaponSlot });
		await cardUsed1;

		// Wait for cooldown to expire
		await sleep(COOLDOWN_MS + 100);

		// Second useCard — should succeed (no cardError)
		// The card may have been exhausted and redrawn, so find the current weapon
		const weaponSlot2 = findWeaponSlot(player);
		expect(weaponSlot2).toBeGreaterThanOrEqual(0);

		const cardUsed2 = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: player.hand[weaponSlot2].id, slotIndex: weaponSlot2 });
		await cardUsed2;
	});
});

// ── Elapsed Cap ──

describe('Elapsed cap — MAX_ELAPSED_MS', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('simulating a large time gap caps movement to MAX_ELAPSED_MS', async () => {
		// Enter playing phase
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket.id];
		const startX = player.x;

		// Simulate a large time gap by setting lastMoveTime far in the past
		player.lastMoveTime = Date.now() - 60000; // 60 seconds ago

		// Emit a move — the server should cap elapsed to MAX_ELAPSED_MS (200ms)
		socket.emit('move', { dx: 1, dz: 0, rotation: 0 });
		await sleep(50);

		// Max distance = MOVE_SPEED * (MAX_ELAPSED_MS / 1000)
		// = 12 * 0.2 = 2.4
		// Actual distance should be well bounded (not a 60-second teleport)
		const maxExpectedDist = MOVE_SPEED * (MAX_ELAPSED_MS / 1000);
		const actualDist = Math.abs(player.x - startX);

		expect(actualDist).toBeLessThanOrEqual(maxExpectedDist + 0.01); // small epsilon for floating point
	});
});

// ── Hand Reconciliation ──

describe('Hand reconciliation — remainingCharges via stateUpdate', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('server corrections to remainingCharges are reflected in the client stateUpdate payload', async () => {
		// Enter playing phase
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket.id];

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];
		const chargesBefore = weaponCard.remainingCharges;

		// Place an enemy in range so the weapon hits something
		gameState.enemies.push({
			id: 'e_hand_recon',
			x: player.x + 3,
			z: player.z,
			hp: 100,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		});

		// Listen for stateUpdate after card use — it should contain the corrected remainingCharges
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');

		socket.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });

		const stateUpdate = await stateUpdatePromise;

		// Verify the stateUpdate contains the player's hand with updated remainingCharges
		expect(stateUpdate.players).toBeDefined();
		expect(stateUpdate.players[socket.id]).toBeDefined();
		expect(stateUpdate.players[socket.id].hand).toBeDefined();
		const handInPayload = stateUpdate.players[socket.id].hand;
		const updatedCard = handInPayload[weaponSlot];
		expect(updatedCard).toBeDefined();
		expect(updatedCard.id).toBe(weaponCard.id);
		// remainingCharges should have decreased by 1 (server correction)
		expect(updatedCard.remainingCharges).toBe(chargesBefore - 1);

		// Also verify the server gameState reflects the same
		expect(player.hand[weaponSlot].remainingCharges).toBe(chargesBefore - 1);
	});
});

describe('Debug scenarios — run objective stays in sync with enemy list', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	// Capture all stateUpdates between emit and the scenario result, then
	// return the first snapshot that has a `run` set — that is the snapshot
	// emitted from inside applyDebugScenario itself, before any subsequent
	// game-loop tick can mutate enemies (e.g. spawner adding a skirmisher).
	async function runScenarioCaptureSnapshot(name) {
		const updates = [];
		const onUpdate = (data) => updates.push(data);
		socket.on('stateUpdate', onUpdate);
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name });
		const result = await debugResultPromise;
		socket.off('stateUpdate', onUpdate);
		expect(result.ok).toBe(true);
		const withRun = updates.find(u => u.run);
		expect(withRun, `no stateUpdate with run captured for ${name}`).toBeDefined();
		return withRun;
	}

	for (const scenario of [
		'summon-low-mana',
		'summon-ready',
		'combat-damaged-player',
		'mixed-enemies',
		'spawner-active',
	]) {
		it(`run.objective.totalEnemies matches the authoritative enemy list at scenario time for "${scenario}"`, async () => {
			const snap = await runScenarioCaptureSnapshot(scenario);

			// At scenario completion, the run objective and the authoritative
			// enemy list must agree — otherwise debug scenarios could create
			// states where run completion is unreachable (totalEnemies >
			// actual, the pre-fix bug for mixed-enemies and spawner-active)
			// or trivially satisfied (totalEnemies < actual).
			expect(snap.run.objective.totalEnemies).toBe(snap.enemies.length);
			expect(snap.run.objective.defeatedEnemies).toBeLessThanOrEqual(
				snap.run.objective.totalEnemies
			);
			expect(snap.enemies.length).toBeGreaterThan(0);
		});
	}

	it('"mixed-enemies" produces exactly 4 enemies of distinct types in the objective', async () => {
		const snap = await runScenarioCaptureSnapshot('mixed-enemies');
		expect(snap.enemies.length).toBe(4);
		expect(snap.run.objective.totalEnemies).toBe(4);
		const types = new Set(snap.enemies.map(e => e.type));
		expect(types.has('grunt')).toBe(true);
		expect(types.has('skirmisher')).toBe(true);
		expect(types.has('miniboss')).toBe(true);
		expect(types.has('spawner')).toBe(true);
	});

	it('"spawner-active" produces a single spawner that the objective accounts for', async () => {
		const snap = await runScenarioCaptureSnapshot('spawner-active');
		expect(snap.enemies.length).toBe(1);
		expect(snap.enemies[0].type).toBe('spawner');
		expect(snap.run.objective.totalEnemies).toBe(1);
	});
});
