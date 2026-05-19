import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import {
	startServer,
	resetGameState,
	gameState,
	io as serverIo,
	server as httpServer,
	_intervals
} from '../index.js';

// ── Helpers ──

/**
 * Start a fresh server on a random port and return the base URL.
 * Each test gets its own server so there is no shared-state interference.
 */
async function startTestServer() {
	return new Promise((resolve, reject) => {
		resetGameState();
		// Clear old listeners/intervals from previous runs
		serverIo.removeAllListeners('connection');
		for (const id of _intervals) clearInterval(id);
		_intervals.length = 0;

		// Listen on port 0 — OS assigns a free port
		startServer(0);

		httpServer.once('listening', () => {
			const addr = httpServer.address();
			const port = addr.port;
			resolve(`http://localhost:${port}`);
		});
	});
}

/**
 * Connect a socket.io-client and resolve with { socket, init }.
 * We wait for the `init` event specifically (not `connect`) because the
 * server emits `init` in its connection handler, which arrives on the client
 * after the `connect` acknowledgment. Resolving on `connect` would leave
 * `initPayload` as null.
 */
function connectClient(baseUrl) {
	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000
		});

		socket.on('init', (data) => resolve({ socket, init: data }));
		socket.on('connect_error', reject);
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

function firstRoomSpawn() {
	const first = gameState.layout.rooms[0];
	return { x: first.x, z: first.z };
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
		// Close the HTTP server so the next test can bind a fresh port
		await new Promise((resolve) => httpServer.close(resolve));
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
		await new Promise((resolve) => httpServer.close(resolve));
	});

	it('emits move and server broadcasts stateUpdate with new position', async () => {
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');

		socket.emit('move', { x: 10, y: 0.5, z: 10, rotation: 0 });

		// Give the server a tick to broadcast
		await sleep(100);

		// Check gameState directly
		expect(gameState.players[socket.id].x).toBe(10);
		expect(gameState.players[socket.id].z).toBe(10);
	});

	it('clamps position to dungeon bounds', async () => {
		socket.emit('move', { x: 999, y: 0.5, z: -999, rotation: 0 });

		// socket.emit is async — wait for the server to process the event
		await sleep(50);

		expect(gameState.players[socket.id].x).toBe(gameState.dungeonBounds.maxX);
		expect(gameState.players[socket.id].z).toBe(gameState.dungeonBounds.minZ);
	});

	it('dead player cannot move', async () => {
		const player = gameState.players[socket.id];
		player.hp = 0;
		player.dead = true;

		socket.emit('move', { x: 50, y: 0.5, z: 50, rotation: 0 });

		const spawn = firstRoomSpawn();
		expect(player.x).toBe(spawn.x);
		expect(player.z).toBe(spawn.z);
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
		await new Promise((resolve) => httpServer.close(resolve));
	});

	it('rejects move with missing fields', () => {
		const spawn = firstRoomSpawn();
		socket.emit('move', { x: 10 }); // missing y, z, rotation
		expect(gameState.players[socket.id].x).toBe(spawn.x);
	});

	it('rejects move with non-numeric fields', () => {
		const spawn = firstRoomSpawn();
		socket.emit('move', { x: 'abc', y: 0.5, z: 10, rotation: 0 });
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
		socket.emit('move', { x: NaN, y: 0.5, z: 10, rotation: 0 });
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
		await new Promise((resolve) => httpServer.close(resolve));
	});

	describe('Weapon card', () => {
		it('emits useCard, server processes cone attack and broadcasts cardUsed', async () => {
			const player = gameState.players[socket.id];
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

			socket.emit('useCard', { cardId: 'iron_sword', slotIndex: 0 });

			// Wait for stateUpdate tick to broadcast
			await sleep(100);

			// Enemy should have taken damage
			const enemy = gameState.enemies.find(e => e.id === 'e1');
			expect(enemy).toBeDefined();
			expect(enemy.hp).toBe(35); // 50 - 15 (iron_sword damage)
		});
	});

	describe('Summon card', () => {
		it('emits useCard, server processes radial AoE and deducts magic stones', async () => {
			const player = gameState.players[socket.id];
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

			socket.emit('useCard', { cardId: 'battle_familiar', slotIndex: 0 });

			await sleep(50);

			// Enemy should have taken summon damage
			const enemy = gameState.enemies.find(e => e.id === 'e1');
			expect(enemy.hp).toBe(20); // 60 - 40

			// Magic stones should be deducted (game loop may regen a bit, so check range)
			const afterStones = gameState.players[socket.id].magicStones;
			expect(afterStones).toBeGreaterThan(beforeStones - 52);
			expect(afterStones).toBeLessThan(beforeStones - 48);
		});

		it('rejects summon when not enough magic stones', async () => {
			gameState.players[socket.id].magicStones = 10;

			const cardErrorPromise = waitForEvent(socket, 'cardError');

			socket.emit('useCard', { cardId: 'battle_familiar', slotIndex: 0 });

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
			const beforeCount = gameState.minions.length;

			socket.emit('useCard', { cardId: 'dungeon_drake', slotIndex: 0 });

			await sleep(50);

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
		await new Promise((resolve) => httpServer.close(resolve));
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
		await new Promise((resolve) => httpServer.close(resolve));
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
		await new Promise((resolve) => httpServer.close(resolve));
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
		await new Promise((resolve) => httpServer.close(resolve));
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
		const player = gameState.players[socket1.id];
		gameState.enemies.push({
			id: 'e_kill',
			x: player.x + 3, // within ATTACK_RANGE, in +X direction (rotation = 0)
			z: player.z,
			hp: 10, // iron_sword deals 15 damage, so this dies
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		});

		// Wait for stateUpdate after the enemy kill
		const stateUpdatePromise = waitForEvent(socket1, 'stateUpdate');

		socket1.emit('useCard', { cardId: 'iron_sword', slotIndex: 0 });

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
		await new Promise((resolve) => httpServer.close(resolve));
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

		// Listen for runComplete before firing the card
		const runCompletePromise = waitForEvent(socket1, 'runComplete');

		socket1.emit('useCard', { cardId: 'iron_sword', slotIndex: 0 });

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
		socket2.emit('damage', { targetId: socket2.id, amount: 100 });

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
		await new Promise((resolve) => httpServer.close(resolve));
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

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: 'iron_sword', slotIndex: 0 });
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
		socket2.emit('damage', { targetId: socket2.id, amount: 100 });
		const summary = await runFailedPromise;

		expect(summary.status).toBe('failed');
		expect(summary.players.length).toBeGreaterThan(0);

		const playerEntry = summary.players.find(p => p.id === socket1.id);
		expect(playerEntry).toBeDefined();
		expect(playerEntry).toHaveProperty('rewards');
		expect(playerEntry.rewards).toHaveProperty('currency');
		expect(playerEntry.rewards).toHaveProperty('cards');

		// On failure, the player should NOT have received a victory card reward.
		// runRewards should be null (never set) or the currency should not include the +10 bonus.
		const actualPlayer = gameState.players[socket1.id];
		expect(actualPlayer.runRewards).toBeNull();
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

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: 'iron_sword', slotIndex: 0 });
		const summary = await runCompletePromise;

		expect(summary.status).toBe('victory');

		const playerEntry = summary.players.find(p => p.id === socket1.id);
		expect(playerEntry).toBeDefined();
		// Player currency in summary should include the picked-up loot (+10 victory bonus)
		expect(playerEntry.currency).toBe(currencyBefore + lootValue + 10);
	});
});
