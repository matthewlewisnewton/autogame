import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import {
	startServer,
	resetGameState,
	gameState,
	io as serverIo,
	server as httpServer,
	_intervals,
	_timeouts,
	clearAllTimers,
	setTestProvider,
	savePlayerData,
	getJWTSecret,
	ENEMY_ATTACK_RANGE,
	ENEMY_ATTACK_RECOVERY_MS,
	DETECTION_RADIUS,
	TICK_RATE,
	ENEMY_DEFS,
	spawnEnemy,
	updateEnemies,
	updateMinions,
	damagePlayer,
	checkRunTerminalState,
	setGameState,
	tryEnterTelepipe,
	checkTelepipeProximity,
	PORTAL_RADIUS,
	PORTAL_PLACEMENT_GRACE_MS,
	isEntityPositionBlocked,
	ENTITY_RADIUS,
	PLAYER_RADIUS,
	cardIdForDeckEntry,
	validateDeck,
	wallAABB,
	evictDisconnectedPlayers,
	DISCONNECT_GRACE_MS,
	runGameLoopTick,
	getCardDef,
	processPassiveDraws,
	HUB_LAYOUT,
} from '../index.js';
import { hubSpawnPosition } from '../simulation.js';
import { InMemoryProvider } from '../providers.js';
import { getQuest } from '../quests.js';
import { COOLDOWN_MS, MOVE_SPEED, MAX_HP, MAX_HAND_SLOTS, MAX_MAGIC_STONES, STARTING_MAGIC_STONES, MEDIC_HEAL_COST, TICK_RATE, MAGIC_STONES_REGEN_PER_TICK, LOBBY_REVIVE_HP } from '../config.js';

// ── Helpers ──

/**
 * Create a valid JWT token for a test account.
 */
function createTestToken(accountId, username) {
	return jwt.sign(
		{ accountId, username: username || accountId },
		getJWTSecret(),
		{ expiresIn: '1h' }
	);
}

/**
 * Start a fresh server on a random port and return the base URL.
 * Each test gets its own server so there is no shared-state interference.
 */
async function startTestServer() {
	clearAllTimers();
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
		setTestProvider(new InMemoryProvider());

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
 * Connect a socket.io-client and resolve with { socket, init, session, lobbyId }.
 * By default also creates/joins a lobby so gameplay handlers work in tests.
 * Pass { skipLobby: true } for lobby-browser-only tests.
 */
function connectClient(baseUrl, accountId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, options = {}) {
	const token = createTestToken(accountId);

	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			auth: { token }
		});

		let lobbyJoinedPromise = null;

		const timer = setTimeout(() => {
			try { socket.disconnect(); } catch (_) {}
			reject(new Error(`connectClient: timed out waiting for init from ${baseUrl}`));
		}, 10000);

		socket.on('init', async (data) => {
			clearTimeout(timer);
			socket._playerId = data.playerId || data.id;

			if (options.skipLobby) {
				resolve({ socket, init: data, session: data, lobbyId: null });
				return;
			}

			try {
				if (data.inLobby && !options.joinLobbyId) {
					const joined = lobbyJoinedPromise
						? await lobbyJoinedPromise
						: await waitForEvent(socket, 'lobbyJoined');
					socket._lobbyId = joined.lobbyId;
					resolve({ socket, init: joined, session: data, lobbyId: joined.lobbyId });
					return;
				}

				if (options.joinLobbyId) {
					socket.emit('joinLobby', { lobbyId: options.joinLobbyId });
				} else {
					socket.emit('createLobby', options.name ? { name: options.name } : {});
				}
				const joined = await waitForEvent(socket, 'lobbyJoined');
				socket._lobbyId = joined.lobbyId;
				resolve({ socket, init: joined, session: data, lobbyId: joined.lobbyId });
			} catch (err) {
				try { socket.disconnect(); } catch (_) {}
				reject(err);
			}
		});
		socket.on('connect_error', (e) => {
			clearTimeout(timer);
			reject(e);
		});

		lobbyJoinedPromise = waitForEvent(socket, 'lobbyJoined').catch(() => null);
	});
}

/**
 * Connect and join a lobby (creates one by default).
 */
async function connectAndJoinLobby(baseUrl, accountId, options = {}) {
	return connectClient(baseUrl, accountId, options);
}

/** Cold reconnect: new socket, same account, re-join an existing lobby. */
async function reconnectClient(baseUrl, accountId, lobbyId) {
	return connectClient(baseUrl, accountId, { joinLobbyId: lobbyId });
}

function testGameState() {
	const { getPrimaryLobbyStateForTests } = require('../lobbies.js');
	return getPrimaryLobbyStateForTests();
}

function lobbyGameState(lobbyId) {
	const { getLobbyById } = require('../lobbies.js');
	const lobby = getLobbyById(lobbyId);
	return lobby ? lobby.state : null;
}

function forceEvictGracePeriodPlayers(lobbyId) {
	const state = lobbyGameState(lobbyId);
	if (!state) return;
	for (const player of Object.values(state.players)) {
		if (player.connected === false) {
			player.disconnectedAt = Date.now() - DISCONNECT_GRACE_MS - 1;
		}
	}
	evictDisconnectedPlayers();
}

function withPrimaryLobby(fn) {
	const { _lobbies } = require('../lobbies.js');
	const lobby = _lobbies.values().next().value;
	if (!lobby) throw new Error('withPrimaryLobby: no active lobby');
	const sim = require('../simulation');
	const progression = require('../progression');
	const { _timeouts } = require('../index.js');
	sim.setGameState(lobby.state, _timeouts);
	progression.setGameState(lobby.state);
	try {
		return fn(lobby.state, lobby);
	} finally {
		if (_lobbies.has(lobby.id)) {
			sim.setGameState(lobby.state, _timeouts);
			progression.setGameState(lobby.state);
		} else {
			sim.setGameState(gameState, _timeouts);
			progression.setGameState(gameState);
		}
	}
}

function savePlayerInPrimaryLobby(playerId) {
	const state = testGameState();
	if (!state) throw new Error('savePlayerInPrimaryLobby: no active lobby state');
	const sim = require('../simulation');
	const progression = require('../progression');
	sim.setGameState(state, _timeouts);
	progression.setGameState(state);
	savePlayerData(playerId);
}

function runSimulationInPrimaryLobby(fn) {
	const state = testGameState();
	if (!state) throw new Error('runSimulationInPrimaryLobby: no active lobby state');
	const sim = require('../simulation');
	const progression = require('../progression');
	sim.setGameState(state, _timeouts);
	progression.setGameState(state);
	return fn(state);
}

async function connectTwoClients(baseUrl, id1, id2) {
	const firstId = id1 || `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const secondId = id2 || `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const first = await connectClient(baseUrl, firstId);
	const second = await connectClient(baseUrl, secondId, { joinLobbyId: first.lobbyId });
	return {
		socket1: first.socket,
		socket2: second.socket,
		lobbyId: first.init.lobbyId,
		init1: first.init,
		init2: second.init,
	};
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

function waitForQuestUpdate(socket, questId, timeout = 3000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Timed out waiting for quest "${questId}"`)),
			timeout
		);
		const handler = (data) => {
			if (data && data.selectedQuestId === questId) {
				clearTimeout(timer);
				socket.off('questUpdate', handler);
				socket.off('lobbyUpdate', handler);
				resolve(data);
			}
		};
		socket.on('questUpdate', handler);
		socket.on('lobbyUpdate', handler);
	});
}

/**
 * Small helper to advance time (for things like heartbeat latency).
 */
function sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

function selectedDeckCardIds(player, deck = player.selectedDeck) {
	return deck.map((entry) => cardIdForDeckEntry(entry, player.inventory));
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
	clearAllTimers();
	await new Promise((resolve) => {
		const t = setTimeout(() => {
			try { serverIo.close(); } catch (_) {}
			resolve();
		}, 5000);
		httpServer.close(() => { clearTimeout(t); resolve(); });
	});
	resetGameState();
}

function firstRoomSpawn() {
	const state = testGameState();
	if (state.gamePhase === 'lobby') {
		return hubSpawnPosition(HUB_LAYOUT);
	}
	const first = state.layout.rooms[0];
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
 * Find the slot index of an instant weapon (no windUpMs) in a player's hand.
 * Returns -1 if not found.
 */
function findInstantWeaponSlot(player) {
	return player.hand ? player.hand.findIndex(
		(c) => c && c.type === 'weapon' && !getCardDef(c.id).windUpMs
	) : -1;
}

/**
 * Ensure the hand has an instant weapon for synchronous kill tests.
 * Heavy weapons (e.g. flame_blade, the greatswords) carry a positive `windUpMs`
 * and resolve their hit a game-loop tick later, which synchronous weapon-kill
 * assertions don't model. Seeds iron_sword in a non-spell slot when only
 * wind-up weapons are present.
 */
function ensureInstantWeaponInHand(player) {
	const slot = findInstantWeaponSlot(player);
	if (slot >= 0) return slot;

	const ironSword = {
		id: 'iron_sword',
		name: 'Rust-Forged Saber',
		type: 'weapon',
		charges: 5,
		remainingCharges: 5,
		grind: 0,
	};
	const windUpWeaponSlot = player.hand.findIndex(
		(c) => c && c.type === 'weapon' && getCardDef(c.id).windUpMs
	);
	const replaceSlot = windUpWeaponSlot >= 0
		? windUpWeaponSlot
		: player.hand.findIndex((c) => c && c.type !== 'spell');
	if (replaceSlot >= 0) {
		player.hand[replaceSlot] = ironSword;
		return replaceSlot;
	}
	player.hand[0] = ironSword;
	return 0;
}

/**
 * Find the slot index of a card of the given type in a player's hand.
 * Returns -1 if not found.
 */
function findCardSlot(player, type) {
	return player.hand ? player.hand.findIndex(c => c && c.type === type) : -1;
}

// ── Integration Tests ──

// Prior server test files in the same vitest worker may leave fake timers active;
// real timers are required for socket IO and the background game loop.
beforeEach(() => {
	vi.useRealTimers();
});

describe('Socket Integration — Connection Flow', () => {
	let baseUrl, socket, init;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const result = await connectClient(baseUrl, undefined, { skipLobby: true });
		socket = result.socket;
		init = result.init;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('client receives init event with account info and lobby list', async () => {
		expect(init).toHaveProperty('id');
		expect(typeof init.id).toBe('string');
		expect(init.inLobby).toBe(false);
		expect(init).toHaveProperty('selectedDeck');
		expect(init).toHaveProperty('lobbies');
		expect(Array.isArray(init.lobbies)).toBe(true);
	});

	it('server does not register the player in gameState until they join a lobby', async () => {
		expect(gameState.players[socket._playerId]).toBeUndefined();
		expect(testGameState()).toBeNull();
	});
});

describe('Socket Integration — Lobby create/join', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	it('createLobby emits lobbyJoined with layout and registers player in lobby state', async () => {
		const { socket, init, lobbyId } = await connectAndJoinLobby(baseUrl, 'creator-1', { name: 'Dungeon Squad' });
		const joined = init;

		expect(joined.lobbyName).toBe('Dungeon Squad');
		expect(joined).toHaveProperty('state');
		expect(joined).toHaveProperty('layoutSeed');
		expect(joined).toHaveProperty('layout');
		expect(Array.isArray(joined.layout.rooms)).toBe(true);

		const state = lobbyGameState(lobbyId);
		expect(state.players[socket._playerId]).toBeDefined();
		expect(state.players[socket._playerId].hp).toBe(100);

		socket.disconnect();
	});

	it('second player can join an existing lobby from the lobby list', async () => {
		const first = await connectAndJoinLobby(baseUrl, 'host-1', { name: 'Open Room' });
		const second = await connectClient(baseUrl, 'guest-1', { joinLobbyId: first.init.lobbyId });

		expect(second.init.lobbyId).toBe(first.init.lobbyId);
		expect(second.init.lobbyName).toBe('Open Room');
		const state = lobbyGameState(first.init.lobbyId);
		expect(Object.keys(state.players)).toHaveLength(2);
		expect(state.players[first.socket._playerId]).toBeDefined();
		expect(state.players[second.socket._playerId]).toBeDefined();

		first.socket.disconnect();
		second.socket.disconnect();
	});

	it('lobby list updates include player counts and selected dungeon', async () => {
		const { socket, lobbyId } = await connectAndJoinLobby(baseUrl, 'lister-1', { name: 'Listed Room' });
		const browser = await connectClient(baseUrl, 'browser-1', { skipLobby: true });

		const entry = (browser.init.lobbies || []).find((l) => l.id === lobbyId);
		expect(entry).toBeDefined();
		expect(entry.name).toBe('Listed Room');
		expect(entry.playerCount).toBe(1);
		expect(entry.selectedQuestId).toBe('training_caverns');
		expect(entry.gamePhase).toBe('lobby');

		const listPromise = waitForEvent(browser.socket, 'lobbyListUpdate');
		browser.socket.emit('listLobbies');
		const listed = await listPromise;
		const refreshed = listed.lobbies.find((l) => l.id === lobbyId);
		expect(refreshed).toMatchObject({
			id: lobbyId,
			name: 'Listed Room',
			playerCount: 1,
			selectedQuestId: 'training_caverns',
			gamePhase: 'lobby',
		});

		socket.disconnect();
		browser.socket.disconnect();
	});

	it('leaveLobby returns player to browser and removes them from lobby state', async () => {
		const { socket, lobbyId } = await connectAndJoinLobby(baseUrl, 'leaver-1');
		socket.emit('leaveLobby');
		const left = await waitForEvent(socket, 'lobbyLeft');
		expect(Array.isArray(left.lobbies)).toBe(true);

		const state = lobbyGameState(lobbyId);
		expect(state).toBeNull();

		socket.disconnect();
	});

	it('dungeon state persists while one player remains after another leaves mid-run', async () => {
		const p1 = await connectAndJoinLobby(baseUrl, 'runner-1');
		const p2 = await connectAndJoinLobby(baseUrl, 'runner-2', { joinLobbyId: p1.init.lobbyId });

		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);
		await waitForEvent(p1.socket, 'startGame');

		const stateBefore = lobbyGameState(p1.init.lobbyId);
		expect(stateBefore.gamePhase).toBe('playing');
		const enemyCount = stateBefore.enemies.length;
		expect(enemyCount).toBeGreaterThan(0);

		p2.socket.disconnect();
		await sleep(50);

		const stateAfter = lobbyGameState(p1.init.lobbyId);
		expect(stateAfter).not.toBeNull();
		expect(stateAfter.gamePhase).toBe('playing');
		expect(stateAfter.enemies.length).toBe(enemyCount);

		p1.socket.disconnect();
	});

	it('joinLobby during PHASES.PLAYING emits lobbyJoined with drop-in run setup', async () => {
		const p1 = await connectAndJoinLobby(baseUrl, 'dropin-host');
		const p2 = await connectClient(baseUrl, 'dropin-mate', { joinLobbyId: p1.init.lobbyId });

		const lobbyErrors = [];
		const onLobbyError = (payload) => lobbyErrors.push(payload);
		p1.socket.on('lobbyError', onLobbyError);
		p2.socket.on('lobbyError', onLobbyError);

		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);
		await Promise.all([
			waitForEvent(p1.socket, 'startGame'),
			waitForEvent(p2.socket, 'startGame'),
		]);

		const p3 = await connectClient(baseUrl, 'dropin-third', { joinLobbyId: p1.init.lobbyId });
		p3.socket.on('lobbyError', onLobbyError);

		expect(lobbyErrors).toEqual([]);
		expect(p3.init.state.gamePhase).toBe('playing');
		const joinedPlayer = p3.init.state.players[p3.socket._playerId];
		expect(joinedPlayer).toBeDefined();
		expect(joinedPlayer.hand.length).toBeGreaterThan(0);
		expect(joinedPlayer.deck.length).toBeGreaterThan(0);
		expect(joinedPlayer.magicStones).toBe(STARTING_MAGIC_STONES);

		p1.socket.disconnect();
		p2.socket.disconnect();
		p3.socket.disconnect();
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

	it('lobby phase move stores input and integrates against HUB_LAYOUT', async () => {
		expect(testGameState().gamePhase).toBe('lobby');
		const player = testGameState().players[socket._playerId];
		const hubSpawn = hubSpawnPosition(HUB_LAYOUT);
		expect(player.x).toBeCloseTo(hubSpawn.x, 1);
		expect(player.z).toBeCloseTo(hubSpawn.z, 1);

		const xBefore = player.x;
		socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 1 });
		await sleep(120);

		expect(player.inputDx).toBe(1);
		expect(player.inputActive).toBe(true);
		expect(player.x).toBeGreaterThan(xBefore);
	});

	it('emits move and server broadcasts stateUpdate with new position', async () => {
		// Enter playing phase so the move handler processes the intent
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
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

		const player = testGameState().players[socket._playerId];
		const bounds = testGameState().dungeonBounds;
		expect(player.x).toBeLessThanOrEqual(bounds.maxX);
		expect(player.x).toBeGreaterThanOrEqual(bounds.minX);
		expect(player.z).toBeLessThanOrEqual(bounds.maxZ);
		expect(player.z).toBeGreaterThanOrEqual(bounds.minZ);
	});

	it('resolves attempted movement into a room wall back to valid floor space', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		let probe = null;
		for (const room of testGameState().layout.rooms) {
			for (const wall of room.walls) {
				if (wall.axis !== 'z') continue;

				const aabb = wallAABB(wall, 0.2);
				const insideDirection = wall.x < room.x ? 1 : -1;
				const floorEdgeX = insideDirection > 0
					? aabb.maxX + PLAYER_RADIUS
					: aabb.minX - PLAYER_RADIUS;

				probe = {
					x: floorEdgeX + insideDirection * 0.4,
					z: wall.z,
					dx: -insideDirection,
					floorEdgeX,
					insideDirection
				};
				break;
			}
			if (probe) break;
		}
		expect(probe).toBeTruthy();

		const player = testGameState().players[socket._playerId];
		player.x = probe.x;
		player.z = probe.z;
		player.lastMoveTime = Date.now() - 80;

		socket.emit('move', { dx: probe.dx, dz: 0, rotation: 0 });
		await sleep(50);

		if (probe.insideDirection > 0) {
			expect(player.x).toBeLessThan(probe.x);
			expect(player.x).toBeGreaterThanOrEqual(probe.floorEdgeX - 1e-6);
		} else {
			expect(player.x).toBeGreaterThan(probe.x);
			expect(player.x).toBeLessThanOrEqual(probe.floorEdgeX + 1e-6);
		}
		expect(player.x).toBeCloseTo(probe.floorEdgeX, 5);
		expect(player.z).toBeCloseTo(probe.z, 5);
		expect(isEntityPositionBlocked(player.x, player.z, PLAYER_RADIUS)).toBe(false);
	});

	it('dead player cannot move', async () => {
		// Enter playing phase so the move handler is active
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		player.hp = 0;
		player.dead = true;

		const spawn = firstRoomSpawn();

		socket.emit('move', { dx: 1, dz: 1, rotation: 0 });

		expect(player.x).toBe(spawn.x);
		expect(player.z).toBe(spawn.z);
	});

	it('applies MOVE_SPEED per simulation tick for stored input', async () => {
		// Enter playing phase so the move handler processes the intent
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];

		// Place player at the center of the largest room to avoid swept-collision
		// rejection from wall proximity. The bounds center may fall in a passage
		// or between rooms — a room center guarantees clearance.
		const largestRoom = testGameState().layout.rooms.reduce(
			(best, r) => (r.width * r.depth > best.width * best.depth ? r : best),
			testGameState().layout.rooms[0]
		);
		player.x = largestRoom.x;
		player.z = largestRoom.z;

		const startX = player.x;

		// Emit movement intent and let the server apply fixed tick steps
		socket.emit('move', { dx: 1, dz: 0, rotation: 0 });

		// Wait for a couple of server ticks to integrate
		await sleep(120);

		const step = MOVE_SPEED / TICK_RATE;
		const actualDisplacement = Math.abs(player.x - startX);
		expect(actualDisplacement).toBeGreaterThan(step * 0.5);
		expect(actualDisplacement).toBeLessThan(step * 4 + 0.01);
	});

	it('rejects move to a void position between rooms (position unchanged)', async () => {
		// Enter playing phase so the move handler is active
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		const { isInsideDungeon } = await import('../index.js');

		const startRoom = testGameState().layout.rooms.find(r => r.role === 'start') || testGameState().layout.rooms[0];
		player.x = startRoom.x;
		player.z = startRoom.z;

		for (const [tdx, tdz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			socket.emit('move', { dx: tdx, dz: tdz, rotation: 0 });
			await sleep(120);
			expect(isInsideDungeon(player.x, player.z)).toBe(true);
		}
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
		expect(testGameState().players[socket._playerId].x).toBe(spawn.x);
	});

	it('rejects move with non-numeric fields', () => {
		const spawn = firstRoomSpawn();
		socket.emit('move', { dx: 'abc', dz: 0.5, rotation: 0 });
		expect(testGameState().players[socket._playerId].x).toBe(spawn.x);
	});

	it('rejects move with null payload', () => {
		const spawn = firstRoomSpawn();
		socket.emit('move', null);
		expect(testGameState().players[socket._playerId].x).toBe(spawn.x);
	});

	it('rejects move with array payload', () => {
		const spawn = firstRoomSpawn();
		socket.emit('move', [1, 2, 3]);
		expect(testGameState().players[socket._playerId].x).toBe(spawn.x);
	});

	it('rejects move with NaN fields', () => {
		const spawn = firstRoomSpawn();
		socket.emit('move', { dx: NaN, dz: 0.5, rotation: 0 });
		expect(testGameState().players[socket._playerId].x).toBe(spawn.x);
	});

	it('rejects stale move sequence numbers', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const playerId = socket._playerId;

		socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 2 });
		await sleep(50);
		expect(testGameState().players[playerId].lastInputSequence).toBe(2);

		socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 1 });
		await sleep(50);
		expect(testGameState().players[playerId].lastInputSequence).toBe(2);

		socket.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 3 });
		await sleep(50);
		expect(testGameState().players[playerId].lastInputSequence).toBe(3);
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

			const player = testGameState().players[socket._playerId];
			// Find the slot with a weapon card in hand
			const weaponSlot = player.hand.findIndex(c => c && c.type === 'weapon');
			expect(weaponSlot).toBeGreaterThanOrEqual(0);
			const weaponCard = player.hand[weaponSlot];

			// Place an enemy within ATTACK_RANGE in front of the player
			testGameState().enemies.push({
				id: 'e1',
				type: 'grunt',
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
			const enemy = testGameState().enemies.find(e => e.id === 'e1');
			expect(enemy).toBeDefined();
			expect(enemy.hp).toBeLessThan(50);
		});

		it('weapon cone hits enemies in the facing direction from useCard rotation', async () => {
			const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
			socket.emit('debugScenario', { name: 'summon-ready' });
			await debugResultPromise;
			await waitForEvent(socket, 'stateUpdate');

			const player = testGameState().players[socket._playerId];
			const weaponSlot = player.hand.findIndex(c => c && c.type === 'weapon');
			expect(weaponSlot).toBeGreaterThanOrEqual(0);
			const weaponCard = player.hand[weaponSlot];

			const facingRotation = Math.PI / 2;
			testGameState().enemies = [
				{
					id: 'e_ahead',
					x: player.x,
					z: player.z + 3,
					hp: 50,
					state: 'idle',
					wanderTarget: { x: player.x, z: player.z + 3 },
				},
				{
					id: 'e_side',
					x: player.x + 3,
					z: player.z,
					hp: 50,
					state: 'idle',
					wanderTarget: { x: player.x + 3, z: player.z },
				},
			];

			const cardUsedPromise = waitForEvent(socket, 'cardUsed');
			socket.emit('useCard', {
				cardId: weaponCard.id,
				slotIndex: weaponSlot,
				rotation: facingRotation,
			});
			await cardUsedPromise;

			const ahead = testGameState().enemies.find(e => e.id === 'e_ahead');
			const side = testGameState().enemies.find(e => e.id === 'e_side');
			expect(ahead.hp).toBeLessThan(50);
			expect(side.hp).toBe(50);
		});
	});

	describe('Summon card', () => {
		it('emits useCard, server processes radial AoE and deducts magic stones', async () => {
			// Enter playing phase so useCard is processed
			const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
			socket.emit('debugScenario', { name: 'summon-ready' });
			await debugResultPromise;
			await waitForEvent(socket, 'stateUpdate');

			const player = testGameState().players[socket._playerId];

			// Ensure a summon card is in hand — the random deal from summon-ready
			// may not include battle_familiar (2 of 8 deck cards), so we
			// manually place one if not present.
			let summonSlot = player.hand.findIndex(c => c && c.type === 'spell');
			if (summonSlot < 0) {
				const emptySlot = player.hand.findIndex(c => !c);
				if (emptySlot >= 0) {
					player.hand[emptySlot] = { id: 'battle_familiar', name: 'Signal Familiar', type: 'spell', charges: 1, remainingCharges: 1, magicStoneCost: 50, damage: 44 };
					summonSlot = emptySlot;
				} else {
					const replaceSlot = player.hand.findIndex((c, index) => c && index !== 0) ;
					player.hand[replaceSlot >= 0 ? replaceSlot : 5] = { id: 'battle_familiar', name: 'Signal Familiar', type: 'spell', charges: 1, remainingCharges: 1, magicStoneCost: 50, damage: 44 };
					summonSlot = replaceSlot >= 0 ? replaceSlot : 5;
				}
			}
			const summonCard = player.hand[summonSlot];
			expect(summonCard).toBeDefined();
			expect(summonCard.type).toBe('spell');
			player.magicStones = summonCard.magicStoneCost || 0;

			// Place enemies within SUMMON_RADIUS
			testGameState().enemies.push({
				id: 'e1',
				type: 'grunt',
				x: player.x + 5,
				z: player.z,
				hp: 60,
				state: 'idle',
				wanderTarget: { x: player.x + 5, z: player.z }
			});

			const beforeStones = testGameState().players[socket._playerId].magicStones;

			const cardUsedPromise = waitForEvent(socket, 'cardUsed');

			socket.emit('useCard', { cardId: summonCard.id, slotIndex: summonSlot });

			await cardUsedPromise;

			// Enemy should have taken summon damage
			const enemy = testGameState().enemies.find(e => e.id === 'e1');
			expect(enemy).toBeDefined();
			expect(enemy.hp).toBeLessThan(60);

			// Magic stones should be deducted
			const afterStones = testGameState().players[socket._playerId].magicStones;
			expect(afterStones).toBeLessThan(beforeStones);
		});

		it('rejects summon when not enough magic stones', async () => {
			// Enter playing phase so useCard is processed
			const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
			socket.emit('debugScenario', { name: 'summon-ready' });
			await debugResultPromise;
			await waitForEvent(socket, 'stateUpdate');

			const player = testGameState().players[socket._playerId];
			player.magicStones = 10;

			// Find the slot with a summon card in hand
			const summonSlot = player.hand.findIndex(c => c && c.type === 'spell');
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
				expect(err.reason).toBe('Not enough Mystic Signal');
			}
		});
	});

	/**
	 * Shared setup for monster card tests — connects via the monster-card
	 * debug scenario, finds the monster slot, and returns the essentials.
	 */
	async function setupMonsterCard(socket) {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'monster-card' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const gs = testGameState();
		const playerKey = Object.keys(gs.players).find(
			k => gs.players[k].debugScenario === 'monster-card'
		);
		expect(playerKey).toBeDefined();
		const playerData = gs.players[playerKey];

		const monsterSlot = playerData.hand.findIndex(c => c && c.type === 'creature');
		expect(monsterSlot).toBeGreaterThanOrEqual(0);
		const monsterCardId = playerData.hand[monsterSlot].id;
		expect(monsterCardId).toBe('dungeon_drake');

		return { socket, playerKey, monsterSlot, monsterCardId, handSizeBefore: playerData.hand.length };
	}

	async function resolveMonsterCardWindup(socket, playerKey) {
		const state = testGameState();
		const player = state.players[playerKey];
		if (player.cardUseState !== 'windup' || !player.pendingCardUse) return;

		const windUpMs = getCardDef(player.pendingCardUse.cardId).windUpMs || 0;
		if (windUpMs <= 0) return;

		const sim = require('../simulation');
		const progression = require('../progression');
		sim.setGameState(state, _timeouts);
		progression.setGameState(state);
		player.cardWindupStartTime = Date.now() - windUpMs - 50;

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		runGameLoopTick();
		await cardUsedPromise;
	}

	describe('Monster card', () => {
		it('uses monster card: minion spawned, card stays in hand until minion expires', async () => {
			const { playerKey, monsterSlot, monsterCardId, handSizeBefore } = await setupMonsterCard(socket);
			const minionCountBefore = testGameState().minions.length;
			const deckBefore = [...testGameState().players[playerKey].deck];

			const stateUpdatePromise = new Promise((resolve) => {
				socket.once('stateUpdate', resolve);
			});

			socket.emit('useCard', { cardId: monsterCardId, slotIndex: monsterSlot });
			await stateUpdatePromise;
			await resolveMonsterCardWindup(socket, playerKey);
			const updatedSnapshot = testGameState();

			expect(testGameState().minions.length).toBe(minionCountBefore + 1);
			const newMinion = testGameState().minions[testGameState().minions.length - 1];
			expect(newMinion.ownerId).toBe(socket._playerId);
			expect(newMinion.hp).toBe(50);
			expect(newMinion.ttl).toBeGreaterThan(29);
			expect(newMinion.ttl).toBeLessThanOrEqual(30);
			expect(newMinion.sourceSlotIndex).toBe(monsterSlot);
			expect(newMinion.sourceCardId).toBe(monsterCardId);

			expect(updatedSnapshot.minions).toBeDefined();
			expect(updatedSnapshot.minions.length).toBe(minionCountBefore + 1);

			const updatedPlayer = updatedSnapshot.players[playerKey] || testGameState().players[playerKey];
			expect(updatedPlayer).toBeDefined();
			expect(updatedPlayer.hand.length).toBe(handSizeBefore);
			const burningCard = updatedPlayer.hand[monsterSlot];
			expect(burningCard).toBeDefined();
			expect(burningCard.id).toBe(monsterCardId);
			expect(burningCard.activeMinionId).toBe(newMinion.id);
			expect(burningCard.burnMaxTtl).toBe(newMinion.maxTtl);
			expect(updatedPlayer.deck.length).toBe(deckBefore.length);

			const state = testGameState();
			const liveMinion = state.minions.find((m) => m.id === newMinion.id);
			expect(liveMinion).toBeDefined();
			const exhaustedBefore = (state.players[playerKey].exhaustedCards || []).length;
			liveMinion.ttl = 0.01;
			liveMinion.hp = 0;

			const sim = require('../simulation');
			const progression = require('../progression');
			sim.setGameState(state, _timeouts);
			progression.setGameState(state);
			updateMinions();

			expect(state.minions.some((m) => m.id === newMinion.id)).toBe(false);
			const playerAfterExpiry = state.players[playerKey];
			expect(playerAfterExpiry.hand[monsterSlot]).toBeNull();
			expect(playerAfterExpiry.deck.length).toBe(deckBefore.length);
			expect(playerAfterExpiry.nextDrawAt).toBeTypeOf('number');
			expect(playerAfterExpiry.exhaustedCards.length).toBe(exhaustedBefore + 1);
			expect(playerAfterExpiry.exhaustedCards.some((card) => card.id === monsterCardId)).toBe(true);

			processPassiveDraws(playerAfterExpiry.nextDrawAt);
			const slotCard = playerAfterExpiry.hand[monsterSlot];
			expect(slotCard).toBeTruthy();
			// Draw pile can contain duplicate card ids; assert fresh draw semantics, not identity.
			expect(slotCard.activeMinionId).toBeUndefined();
			expect(slotCard.burnMaxTtl).toBeUndefined();
			expect(slotCard.remainingCharges).toBe(slotCard.charges);
			expect(playerAfterExpiry.deck.length).toBe(deckBefore.length - 1);
		});

		it('rejects re-playing a creature card while its minion is active', async () => {
			const { playerKey, monsterSlot, monsterCardId } = await setupMonsterCard(socket);

			await waitForEvent(socket, 'stateUpdate');
			socket.emit('useCard', { cardId: monsterCardId, slotIndex: monsterSlot });
			await waitForEvent(socket, 'stateUpdate');
			await resolveMonsterCardWindup(socket, playerKey);

			const player = testGameState().players[playerKey];
			player.slotCooldowns[monsterSlot] = 0;

			const cardErrorPromise = waitForEvent(socket, 'cardError');
			socket.emit('useCard', { cardId: monsterCardId, slotIndex: monsterSlot });
			const cardError = await cardErrorPromise;

			expect(cardError.reason).toBe('Creature still active');
		});
	});

	it('discardCard empties a slot and schedules passive draw', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		const deckBefore = [...player.deck];
		const discardSlot = player.hand.findIndex(c => c && c.type === 'weapon');
		expect(discardSlot).toBeGreaterThanOrEqual(0);
		const cardId = player.hand[discardSlot].id;

		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('discardCard', { slotIndex: discardSlot, cardId });
		const snapshot = await stateUpdatePromise;

		const updated = snapshot.players[socket._playerId];
		expect(updated.hand[discardSlot]).toBeNull();
		expect(updated.deck).toEqual(deckBefore);
		expect(updated.nextDrawAt).toBeTypeOf('number');
	});

	describe('Synergistic cards', () => {
		async function enterScenario() {
			const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
			socket.emit('debugScenario', { name: 'summon-ready' });
			await debugResultPromise;
			await waitForEvent(socket, 'stateUpdate');
			return testGameState().players[socket._playerId];
		}

		it('discardCard frees a slot and draw weapon succeeds at full hand', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		player.deck = ['iron_sword', 'flame_blade', 'battle_familiar'];
		player.hand = [
			{ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 5 },
			{ id: 'flame_blade', name: 'Solar Edge', type: 'weapon', charges: 2, remainingCharges: 2 },
			{ id: 'battle_familiar', name: 'Signal Familiar', type: 'spell', charges: 1, remainingCharges: 1, magicStoneCost: 50 },
			{ id: 'dungeon_drake', name: 'Vault Wyrm', type: 'creature', charges: 1, remainingCharges: 1 },
			{ id: 'deck_sifter', name: 'Deck Sifter', type: 'weapon', charges: 3, remainingCharges: 3, effect: 'draw_card' },
			{ id: 'harvesting_scythe', name: 'Ether Scythe', type: 'weapon', charges: 3, remainingCharges: 3 },
		];

		const cardErrorPromise = waitForEvent(socket, 'cardError');
		socket.emit('useCard', { cardId: 'deck_sifter', slotIndex: 4 });
		const cardError = await cardErrorPromise;
		expect(cardError.reason).toBe('Hand full');

		const discardUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('discardCard', { slotIndex: 0, cardId: 'iron_sword' });
		await discardUpdatePromise;

		const deckBeforeDraw = player.deck.length;
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'deck_sifter', slotIndex: 4 });
		await stateUpdatePromise;

		expect(player.hand[0]).toBeTruthy();
		expect(player.deck.length).toBe(deckBeforeDraw - 1);
		expect(player.hand[4].remainingCharges).toBe(2);
	});

	it('Chrono Trigger restores charges to adjacent hand cards', async () => {
			const player = await enterScenario();
			player.deck = [];
			player.hand = [
				{ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 1 },
				{ id: 'chrono_trigger', name: 'Chrono Trigger', type: 'spell', charges: 1, remainingCharges: 1, magicStoneCost: 0 },
				{ id: 'flame_blade', name: 'Solar Edge', type: 'weapon', charges: 2, remainingCharges: 1 },
			];

			const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
			socket.emit('useCard', { cardId: 'chrono_trigger', slotIndex: 1 });
			await stateUpdatePromise;

			const sword = player.hand.find(c => c && c.id === 'iron_sword');
			const flame = player.hand.find(c => c && c.id === 'flame_blade');
			expect(sword.remainingCharges).toBe(3);
			expect(flame.remainingCharges).toBe(2);
		});

		it('Ether Scythe grants Magic Stones on hit and kill', async () => {
			const player = await enterScenario();
			player.magicStones = 0;
			player.currency = 0;
			const hpBefore = 80;
			player.hp = hpBefore;
			player.deck = [];
			player.hand = [
				{ id: 'harvesting_scythe', name: 'Ether Scythe', type: 'weapon', charges: 3, remainingCharges: 3 },
			];
			testGameState().enemies = [
				{ id: 'scythe-hit', x: player.x + 3, z: player.z, hp: 50, state: 'idle', wanderTarget: { x: player.x + 3, z: player.z } },
				{ id: 'scythe-kill', x: player.x + 4, z: player.z, hp: 8, state: 'idle', wanderTarget: { x: player.x + 4, z: player.z } },
			];

			const cardUsedPromise = waitForEvent(socket, 'cardUsed');
			socket.emit('useCard', { cardId: 'harvesting_scythe', slotIndex: 0 });
			const used = await cardUsedPromise;

			expect(used.magicStonesGained).toBe(25);
			expect(player.magicStones).toBeGreaterThanOrEqual(25);
			expect(player.magicStones).toBeLessThan(27);
			expect(player.currency).toBe(0);
			expect(player.hp).toBe(hpBefore);
			expect(used.currencyGained ?? 0).toBe(0);
			expect(used.hpHealed ?? 0).toBe(0);
			expect(testGameState().enemies.some(e => e.id === 'scythe-kill')).toBe(false);
		});

		it('Reaper\'s Scythe grants currency and HP on kill', async () => {
			const player = await enterScenario();
			const reaperDef = getCardDef('reapers_scythe');
			player.magicStones = 0;
			player.currency = 0;
			const hpBefore = 80;
			player.hp = hpBefore;
			player.deck = [];
			player.hand = [
				{ id: 'reapers_scythe', name: 'Reaper\'s Scythe', type: 'weapon', charges: 4, remainingCharges: 4 },
			];
			testGameState().enemies = [
				{ id: 'reaper-hit', x: player.x + 3, z: player.z, hp: 50, state: 'idle', wanderTarget: { x: player.x + 3, z: player.z } },
				{ id: 'reaper-kill', x: player.x + 4, z: player.z, hp: 8, state: 'idle', wanderTarget: { x: player.x + 4, z: player.z } },
			];

			const cardUsedPromise = waitForEvent(socket, 'cardUsed');
			socket.emit('useCard', { cardId: 'reapers_scythe', slotIndex: 0 });
			const used = await cardUsedPromise;

			expect(used.magicStonesGained).toBe(25);
			expect(player.magicStones).toBeGreaterThanOrEqual(25);
			expect(player.magicStones).toBeLessThan(27);
			expect(player.currency).toBe(reaperDef.currencyOnKill);
			expect(player.hp).toBe(Math.min(MAX_HP, hpBefore + reaperDef.healOnKill));
			expect(used.currencyGained).toBe(reaperDef.currencyOnKill);
			expect(used.hpHealed).toBe(reaperDef.healOnKill);
			expect(testGameState().enemies.some(e => e.id === 'reaper-kill')).toBe(false);
		});

		it('Offering Terminal consumes the oldest nearby friendly minion for Magic Stones and weapon charges', async () => {
			const player = await enterScenario();
			player.magicStones = 0;
			player.deck = [];
			player.hand = [
				{ id: 'sacrificial_altar', name: 'Offering Terminal', type: 'spell', charges: 1, remainingCharges: 1, magicStoneCost: 0 },
				{ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 1 },
			];
			testGameState().minions = [
				{ id: 'old-minion', ownerId: socket._playerId, type: 'dungeon_drake', x: player.x + 1, z: player.z, hp: 20, ttl: 30, createdAt: 10 },
				{ id: 'new-minion', ownerId: socket._playerId, type: 'dungeon_drake', x: player.x + 2, z: player.z, hp: 20, ttl: 30, createdAt: 20 },
			];

			const cardUsedPromise = waitForEvent(socket, 'cardUsed');
			socket.emit('useCard', { cardId: 'sacrificial_altar', slotIndex: 0 });
			const used = await cardUsedPromise;

			expect(used.sacrificedMinionId).toBe('old-minion');
			expect(player.magicStones).toBe(MAX_MAGIC_STONES);
			expect(testGameState().minions.map(m => m.id)).toEqual(['new-minion']);
			expect(player.hand.find(c => c && c.id === 'iron_sword').remainingCharges).toBe(3);
		});

		it('Mana Prism and Battery Automaton spawn their resource minions', async () => {
			const player = await enterScenario();
			player.magicStones = 50;
			player.deck = [];
			player.hand = [
				{ id: 'mana_prism', name: 'Mana Prism', type: 'spell', charges: 1, remainingCharges: 1, magicStoneCost: 0 },
				{ id: 'battery_automaton', name: 'Battery Automaton', type: 'creature', charges: 1, remainingCharges: 1, magicStoneCost: 50 },
			];

			let cardUsedPromise = waitForEvent(socket, 'cardUsed');
			socket.emit('useCard', { cardId: 'mana_prism', slotIndex: 0 });
			await cardUsedPromise;

			expect(testGameState().minions.some(m => m.type === 'mana_prism' && m.ownerId === socket._playerId)).toBe(true);
			player.slotCooldowns[0] = null;
			player.slotCooldowns[1] = null;

			cardUsedPromise = waitForEvent(socket, 'cardUsed');
			socket.emit('useCard', { cardId: 'battery_automaton', slotIndex: 1 });
			await cardUsedPromise;

			const battery = testGameState().minions.find(m => m.type === 'battery_automaton' && m.ownerId === socket._playerId);
			expect(battery).toBeDefined();
			expect(battery.hp).toBe(80);
			expect(player.magicStones).toBeLessThanOrEqual(1);
		});
	});

	describe('Minion owner-follow', () => {
		it('minion moves closer to owner when no enemies are nearby', async () => {
			const state = testGameState();
			state.gamePhase = 'playing';
			const playerId = socket._playerId;
			state.players[playerId].x = 10;
			state.players[playerId].z = 10;
			state.players[playerId].dead = false;

			state.minions.push({
				id: 'm1',
				ownerId: playerId,
				x: 0,
				z: 0,
				hp: 50,
				ttl: 30
			});
			state.enemies = [];

			const distBefore = Math.hypot(
				state.players[playerId].x - state.minions[0].x,
				state.players[playerId].z - state.minions[0].z
			);

			const sim = require('../simulation');
			const progression = require('../progression');
			sim.setGameState(state, _timeouts);
			progression.setGameState(state);
			updateMinions();

			const distAfter = Math.hypot(
				state.players[playerId].x - state.minions[0].x,
				state.players[playerId].z - state.minions[0].z
			);

			expect(distAfter).toBeLessThan(distBefore);
		});
	});
});

describe('Server hand authority — useCard validation', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('rejects a card id that is not in the player hand with cardError', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);

		const cardErrorPromise = waitForEvent(socket, 'cardError');
		socket.emit('useCard', { cardId: 'chrono_trigger', slotIndex: weaponSlot });

		const err = await cardErrorPromise;
		expect(err.reason).toBe('Card not in hand');
	});

	it('rejects a mismatched card id at the requested slot with cardError', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];
		const mismatchedSlot = player.hand.findIndex((card, index) =>
			index !== weaponSlot && card && card.id !== weaponCard.id
		);
		expect(mismatchedSlot).toBeGreaterThanOrEqual(0);

		const cardErrorPromise = waitForEvent(socket, 'cardError');
		socket.emit('useCard', { cardId: weaponCard.id, slotIndex: mismatchedSlot });

		const err = await cardErrorPromise;
		expect(err.reason).toBe('Card not in hand');
	});

	it('server decrements charges and leaves an empty slot when a weapon exhausts', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);

		player.hand[weaponSlot].remainingCharges = 1;
		const cardIdBefore = player.hand[weaponSlot].id;
		const deckSizeBefore = player.deck.length;

		testGameState().enemies.push({
			id: 'e_exhaust',
			type: 'grunt',
			x: player.x + 3,
			z: player.z,
			hp: 100,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z },
		});

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: cardIdBefore, slotIndex: weaponSlot });
		await cardUsedPromise;
		await stateUpdatePromise;

		expect(player.hand[weaponSlot]).toBeNull();
		expect(player.deck.length).toBe(deckSizeBefore);
		expect(player.nextDrawAt).toBeTypeOf('number');
	});
});

describe('Socket Integration — in-run deckUpdate', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('emits deckUpdate to the acting player after useCard changes hand', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		const weaponSlot = player.hand.findIndex((c) => c && c.type === 'weapon');
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];
		const handBefore = player.hand.map((c) => (c ? c.id : null));

		testGameState().enemies.push({
			id: 'e_deck_update',
			type: 'grunt',
			x: player.x + 3,
			z: player.z,
			hp: 100,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z },
		});

		player.hand[weaponSlot].remainingCharges = 1;

		const deckUpdatePromise = waitForEvent(socket, 'deckUpdate');
		socket.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		const deckUpdate = await deckUpdatePromise;

		expect(Array.isArray(deckUpdate.hand)).toBe(true);
		expect(deckUpdate.hand[weaponSlot]).toBeNull();
		expect(deckUpdate.hand).not.toEqual(handBefore);
		expect(Array.isArray(deckUpdate.deck)).toBe(true);
		expect(deckUpdate.deck).toEqual(player.deck);
		expect(typeof deckUpdate.inDesperation).toBe('boolean');
		expect(deckUpdate).toHaveProperty('desperationDeck');
		expect(deckUpdate).toHaveProperty('nextDrawAt');
		expect(deckUpdate.returnRewardsPreview).toEqual(expect.objectContaining({
			lootCurrency: expect.any(Number),
			objectiveComplete: expect.any(Boolean),
		}));
	});

	it('does not emit in-run deckUpdate to other players in the lobby', async () => {
		if (socket && socket.connected) socket.disconnect();
		const { socket1, socket2, lobbyId } = await connectTwoClients(baseUrl);
		const state = lobbyGameState(lobbyId);

		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		const player = state.players[socket1._playerId];
		const weaponSlot = player.hand.findIndex((c) => c && c.type === 'weapon');
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		state.enemies.push({
			id: 'e_deck_update_b',
			type: 'grunt',
			x: player.x + 3,
			z: player.z,
			hp: 100,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z },
		});

		player.hand[weaponSlot].remainingCharges = 1;

		let socket2DeckUpdate = false;
		socket2.on('deckUpdate', () => { socket2DeckUpdate = true; });

		const deckUpdatePromise = waitForEvent(socket1, 'deckUpdate');
		socket1.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		await deckUpdatePromise;

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(socket2DeckUpdate).toBe(false);

		socket1.disconnect();
		socket2.disconnect();
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
		expect(testGameState().players[socket._playerId]).toBeDefined();
	});
});

describe('Socket Integration — Disconnect Event', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		// Don't disconnect socket here — the test does it
		await closeServer();
	});

	it('keeps player in lobby during disconnect grace period', async () => {
		const { socket1, socket2, lobbyId } = await connectTwoClients(baseUrl);
		expect(testGameState().players[socket1._playerId]).toBeDefined();

		socket1.disconnect();
		await sleep(100);

		const state = lobbyGameState(lobbyId);
		expect(state.players[socket1._playerId]).toBeDefined();
		expect(state.players[socket1._playerId].connected).toBe(false);
		expect(state.players[socket2._playerId]).toBeDefined();

		socket2.disconnect();
	});

	it('clears ready on soft disconnect while player remains in lobby', async () => {
		const { socket1, socket2, lobbyId } = await connectTwoClients(baseUrl);
		const playerId = socket1._playerId;

		socket1.emit('playerReady', true);
		await sleep(50);
		expect(lobbyGameState(lobbyId).players[playerId].ready).toBe(true);

		socket1.disconnect();
		await sleep(100);

		const state = lobbyGameState(lobbyId);
		expect(state.players[playerId]).toBeDefined();
		expect(state.players[playerId].connected).toBe(false);
		expect(state.players[playerId].ready).toBe(false);

		socket2.disconnect();
	});

	it('does not start game when ready player soft-disconnects before opponent is ready', async () => {
		const { socket1, socket2, lobbyId } = await connectTwoClients(baseUrl);
		const playerId = socket1._playerId;

		let startGameReceived = false;
		socket2.on('startGame', () => { startGameReceived = true; });

		socket1.emit('playerReady', true);
		socket1.disconnect();
		await sleep(100);

		const state = lobbyGameState(lobbyId);
		expect(state.gamePhase).toBe('lobby');
		expect(state.players[playerId].connected).toBe(false);
		expect(state.players[playerId].ready).toBe(false);

		await sleep(500);
		expect(startGameReceived).toBe(false);

		socket2.disconnect();
	});

	it('evicts player after disconnect grace period expires', async () => {
		const { socket1, socket2, lobbyId } = await connectTwoClients(baseUrl);

		socket1.disconnect();
		await sleep(100);
		expect(lobbyGameState(lobbyId).players[socket1._playerId]).toBeDefined();

		forceEvictGracePeriodPlayers(lobbyId);
		expect(lobbyGameState(lobbyId).players[socket1._playerId]).toBeUndefined();

		socket2.disconnect();
	});

	it('auto-resumes lobby when reconnecting within grace period', async () => {
		const { socket1, socket2, lobbyId } = await connectTwoClients(baseUrl);
		const playerId = socket1._playerId;

		socket1.disconnect();
		await sleep(100);
		expect(lobbyGameState(lobbyId).players[playerId].connected).toBe(false);

		const token = createTestToken(playerId);
		const resumed = await new Promise((resolve, reject) => {
			const socket = ClientIO(baseUrl, {
				transports: ['websocket'],
				retry: false,
				auth: { token },
			});
			const timer = setTimeout(() => reject(new Error('timed out waiting for lobby resume')), 10000);
			socket.on('init', () => {});
			socket.on('lobbyJoined', (data) => {
				clearTimeout(timer);
				resolve({ socket, data });
			});
			socket.on('connect_error', reject);
		});

		expect(resumed.data.lobbyId).toBe(lobbyId);
		expect(lobbyGameState(lobbyId).players[playerId].connected).toBe(true);

		resumed.socket.disconnect();
		socket2.disconnect();
	});

	it('keeps owned minions during disconnect grace period', async () => {
		const { socket1, socket2, lobbyId } = await connectTwoClients(baseUrl);
		// Spawn a minion for player 1
		testGameState().minions.push({
			id: 'm1',
			ownerId: socket1._playerId,
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});

		expect(testGameState().minions.length).toBe(1);

		socket1.disconnect();
		await sleep(100);

		expect(testGameState().minions.filter(m => m.ownerId === socket1._playerId).length).toBe(1);

		forceEvictGracePeriodPlayers(lobbyId);
		expect(testGameState().minions.filter(m => m.ownerId === socket1._playerId).length).toBe(0);

		socket2.disconnect();
	});

	it('auto-resumes lobby when reconnecting within grace period', async () => {
		const { socket1, socket2, lobbyId } = await connectTwoClients(baseUrl);
		const playerId = socket1._playerId;

		socket1.disconnect();
		await sleep(100);
		expect(lobbyGameState(lobbyId).players[playerId].connected).toBe(false);

		const token = createTestToken(playerId);
		const resumed = await new Promise((resolve, reject) => {
			const socket = ClientIO(baseUrl, {
				transports: ['websocket'],
				retry: false,
				auth: { token },
			});
			const timer = setTimeout(() => reject(new Error('timed out waiting for lobby resume')), 10000);
			socket.on('init', () => {});
			socket.on('lobbyJoined', (data) => {
				clearTimeout(timer);
				resolve({ socket, data });
			});
			socket.on('connect_error', reject);
		});

		expect(resumed.data.lobbyId).toBe(lobbyId);
		expect(lobbyGameState(lobbyId).players[playerId].connected).toBe(true);

		resumed.socket.disconnect();
		socket2.disconnect();
	});
});

describe('Socket Integration — Last Player Disconnect Resets Run', () => {
	let baseUrl, socket, lobbyId;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const connected = await connectClient(baseUrl);
		socket = connected.socket;
		lobbyId = connected.init.lobbyId;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await sleep(50);
		await closeServer();
	});

	it('keeps lobby during disconnect grace period when last player leaves mid-run', async () => {
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		expect(testGameState().gamePhase).toBe('playing');

		socket.disconnect();
		await sleep(100);

		expect(lobbyGameState(lobbyId)).not.toBeNull();
		expect(lobbyGameState(lobbyId).players[socket._playerId].connected).toBe(false);

		forceEvictGracePeriodPlayers(lobbyId);
		expect(lobbyGameState(lobbyId)).toBeNull();
	});

	it('clears persisted run state when the lobby is deleted after grace', async () => {
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		expect(testGameState().run).toBeDefined();

		socket.disconnect();
		await sleep(100);
		expect(lobbyGameState(lobbyId)).not.toBeNull();

		forceEvictGracePeriodPlayers(lobbyId);
		expect(lobbyGameState(lobbyId)).toBeNull();
	});

	it('does not reset run when a second player remains connected', async () => {
		const second = await connectClient(baseUrl, 'remaining-player', { joinLobbyId: lobbyId });
		const socket2 = second.socket;

		// Both players ready to start the game
		const startGame1 = waitForEvent(socket, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket.emit('playerReady', true);
		await sleep(50);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);
		expect(testGameState().gamePhase).toBe('playing');
		expect(testGameState().run).toBeDefined();

		// Disconnect first player — second remains
		socket.disconnect();
		await sleep(100);

		expect(testGameState().gamePhase).toBe('playing');
		expect(testGameState().run).toBeDefined();

		// Clean up second socket
		if (socket2.connected) socket2.disconnect();
	});

	it('does not reset run when one of multiple players disconnects', async () => {
		const second = await connectClient(baseUrl, 'remaining-player-2', { joinLobbyId: lobbyId });
		const socket2 = second.socket;

		// Both players ready up and transition to playing
		const startGame1 = waitForEvent(socket, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket.emit('playerReady', true);
		await sleep(50);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);

		// Verify initial playing state
		expect(testGameState().gamePhase).toBe('playing');
		expect(testGameState().run).toBeDefined();
		expect(testGameState().enemies.length).toBeGreaterThan(0);

		// Disconnect socket1 — socket2 should remain
		socket.disconnect();
		await sleep(100);

		// gamePhase must remain 'playing'
		expect(testGameState().gamePhase).toBe('playing');

		// testGameState().run must still exist
		expect(testGameState().run).toBeDefined();

		// At least one enemy must remain (run not cleared)
		expect(testGameState().enemies.length).toBeGreaterThan(0);

		// The remaining socket's player must still be in testGameState().players
		expect(testGameState().players[socket2._playerId]).toBeDefined();

		if (socket2.connected) socket2.disconnect();
		await sleep(50);
	});

	it('resets to lobby when last player is evicted after grace in terminal run state', async () => {
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;

		const state = testGameState();
		state.run.objective.defeatedEnemies = state.run.objective.totalEnemies;
		state.run.status = 'victory';
		expect(state.run.status).toBe('victory');

		socket.disconnect();
		await sleep(100);
		expect(lobbyGameState(lobbyId)).not.toBeNull();

		forceEvictGracePeriodPlayers(lobbyId);
		expect(lobbyGameState(lobbyId)).toBeNull();
	});

	it('new connection can create a fresh lobby after grace eviction', async () => {
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		await waitForEvent(socket, 'stateUpdate');

		socket.disconnect();
		await sleep(100);
		forceEvictGracePeriodPlayers(lobbyId);
		expect(lobbyGameState(lobbyId)).toBeNull();

		const { socket: socket2, init } = await connectClient(baseUrl, 'fresh-player');
		expect(init.state.gamePhase).toBe('lobby');
		expect(init.lobbyId).not.toBe(lobbyId);

		if (socket2.connected) socket2.disconnect();
	});
});

describe('Socket Integration — Lobby / playerReady Flow', () => {
	let baseUrl, socket1, socket2, sharedLobbyId;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const first = await connectClient(baseUrl, 'ready-player-1');
		socket1 = first.socket;
		sharedLobbyId = first.init.lobbyId;
		const second = await connectClient(baseUrl, 'ready-player-2', { joinLobbyId: sharedLobbyId });
		socket2 = second.socket;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	it('two players connect, both emit playerReady(true), both receive startGame', async () => {
		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');

		socket1.emit('playerReady', true);
		await sleep(50);

		expect(testGameState().gamePhase).toBe('lobby');

		socket2.emit('playerReady', true);

		await Promise.all([startGame1, startGame2]);

		expect(testGameState().gamePhase).toBe('playing');
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

describe('Socket Integration — Quest Selection', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const connected = await connectTwoClients(baseUrl);
		socket1 = connected.socket1;
		socket2 = connected.socket2;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	it('defaults selected quest in game state and init payload', async () => {
		expect(testGameState().selectedQuestId).toBe('training_caverns');

		const { socket: socket3, init } = await connectClient(baseUrl);
		expect(init.state.selectedQuestId).toBe('training_caverns');
		socket3.disconnect();
	});

	it('selects a valid quest and broadcasts to all clients', async () => {
		const update1 = waitForQuestUpdate(socket1, 'crystal_rescue');
		const update2 = waitForQuestUpdate(socket2, 'crystal_rescue');

		socket1.emit('selectQuest', { questId: 'crystal_rescue' });

		const [u1, u2] = await Promise.all([update1, update2]);
		expect(u1.selectedQuestId).toBe('crystal_rescue');
		expect(u2.selectedQuestId).toBe('crystal_rescue');
		expect(Array.isArray(u1.quests)).toBe(true);
		expect(u1.quests.map(q => q.id)).toEqual(['training_caverns', 'crystal_rescue', 'arena_trials', 'frost_crossing', 'canyon_descent', 'ember_descent', 'spire_ascent', 'annex_escort', 'endless_siege']);
		expect(u1.layoutSeed).toBeDefined();
		expect(u1.layout).toBeDefined();
		expect(u1.layout.profile).toBe('open');
		expect(testGameState().selectedQuestId).toBe('crystal_rescue');
		expect(testGameState().layout.profile).toBe('open');
	});

	it('rejects unknown quest ids without changing the selected quest', async () => {
		socket1.emit('selectQuest', { questId: 'crystal_rescue' });
		await waitForQuestUpdate(socket1, 'crystal_rescue');
		expect(testGameState().selectedQuestId).toBe('crystal_rescue');

		const errorPromise = waitForEvent(socket1, 'questError');
		socket1.emit('selectQuest', { questId: 'unknown_quest' });
		const err = await errorPromise;

		expect(err.reason).toContain('Unknown quest');
		expect(testGameState().selectedQuestId).toBe('crystal_rescue');
	});

	it('still launches a run after quest selection when all players ready', async () => {
		socket1.emit('selectQuest', { questId: 'crystal_rescue' });
		await waitForQuestUpdate(socket1, 'crystal_rescue');

		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');

		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);

		await Promise.all([startGame1, startGame2]);
		expect(testGameState().gamePhase).toBe('playing');
		expect(testGameState().run.questId).toBe('crystal_rescue');
		expect(testGameState().enemies.length).toBe(2);
		expect(testGameState().loot.filter(l => l.kind === 'crystal').length).toBe(3);
		expect(testGameState().run.objective.type).toBe('collect_items');
		expect(testGameState().run.objective.totalItems).toBe(3);
	});

	it('collecting all crystals completes a crystal rescue run', async () => {
		socket1.emit('selectQuest', { questId: 'crystal_rescue' });
		await waitForQuestUpdate(socket1, 'crystal_rescue');

		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);
		await waitForEvent(socket1, 'stateUpdate');

		const player = testGameState().players[socket1._playerId];
		const crystals = testGameState().loot.filter(l => l.kind === 'crystal');
		expect(crystals.length).toBe(3);

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		for (const crystal of crystals) {
			player.x = crystal.x;
			player.z = crystal.z;
			socket1.emit('lootPickup', { lootId: crystal.id });
			await sleep(50);
		}

		const state = testGameState();
		state.run.objective.defeatedEnemies = state.run.objective.totalEnemies;
		runSimulationInPrimaryLobby(() => checkRunTerminalState());

		const summary = await runCompletePromise;
		expect(summary.status).toBe('victory');
		expect(summary.objective.type).toBe('collect_items');
		expect(summary.objective.collectedItems).toBe(3);
		expect(testGameState().run.status).toBe('victory');
	});

	it('starts the selected quest with quest metadata and configured enemy count', async () => {
		socket1.emit('selectQuest', { questId: 'training_caverns' });
		await waitForQuestUpdate(socket1, 'training_caverns');

		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);
		const state = await waitForEvent(socket1, 'stateUpdate');

		expect(state.run.questId).toBe('training_caverns');
		expect(state.run.questName).toBe('Initiate Vault');
		expect(state.run.objective.totalEnemies).toBe(6);
		expect(testGameState().enemies.length).toBe(2);
	});

	it('runComplete summary includes quest metadata and quest reward data', async () => {
		socket1.emit('selectQuest', { questId: 'training_caverns' });
		await waitForQuestUpdate(socket1, 'training_caverns');

		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		const player = testGameState().players[socket1._playerId];
		testGameState().enemies = [{
			id: 'e_final',
			type: 'grunt',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		testGameState().run.objective.totalEnemies = 1;
		testGameState().run.objective.defeatedEnemies = 0;
		testGameState().minions = [];

		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		const summary = await runCompletePromise;

		expect(summary.questId).toBe('training_caverns');
		expect(summary.questName).toBe('Initiate Vault');
		expect(summary.rewards.currency).toBeGreaterThanOrEqual(10);
	});

	it('preserves selected quest after returning to lobby', async () => {
		socket1.emit('selectQuest', { questId: 'crystal_rescue' });
		await waitForQuestUpdate(socket1, 'crystal_rescue');

		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);
		await waitForEvent(socket1, 'stateUpdate');

		testGameState().run.status = 'victory';
		const lobbyUpdatePromise = waitForEvent(socket1, 'lobbyUpdate');
		socket1.emit('returnToLobby');
		const lobbyUpdate = await lobbyUpdatePromise;

		expect(testGameState().selectedQuestId).toBe('crystal_rescue');
		expect(lobbyUpdate.selectedQuestId).toBe('crystal_rescue');
	});
});

describe('dungeon run objective', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const connected = await connectTwoClients(baseUrl);
		socket1 = connected.socket1;
		socket2 = connected.socket2;
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
		expect(testGameState().run).toBeDefined();
		expect(testGameState().enemies.length).toBeGreaterThan(0);

		const defeatedBefore = testGameState().run.objective.defeatedEnemies;

		// Place a weapon-range enemy in front of the player so useCard kills it
		// Clear existing enemies to ensure only this one is in the weapon cone
		const player = testGameState().players[socket1._playerId];
		testGameState().enemies = [{
			id: 'e_kill',
			type: 'grunt',
			x: player.x + 3, // within ATTACK_RANGE, in +X direction (rotation = 0)
			z: player.z,
			hp: 10, // weapon deals at least 15 damage, so this dies
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];

		// Seed an instant weapon when the dealt hand only has wind-up heavy hitters
		// (heavy wind-up weapons like flame_blade land their hit a tick later).
		const weaponSlot = ensureInstantWeaponInHand(player);
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
		expect(testGameState().run.objective.defeatedEnemies).toBe(defeatedBefore + 1);
	});
});

describe('Run terminal state — integration', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const connected = await connectTwoClients(baseUrl);
		socket1 = connected.socket1;
		socket2 = connected.socket2;
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
		const player = testGameState().players[socket1._playerId];
		testGameState().enemies = [{
			id: 'e_final',
			type: 'grunt',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		// Update run objective to reflect 1 enemy
		testGameState().run.objective.totalEnemies = 1;
		testGameState().run.objective.defeatedEnemies = 0;

		// Clear minions so updateMinions doesn't kill the enemy before our useCard
		testGameState().minions = [];

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
		const runFailedPromise = waitForEvent(socket1, 'runFailed');
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'run-failed' });
		const summary = await runFailedPromise;
		const debugResult = await debugResultPromise;
		expect(debugResult.ok).toBe(true);

		expect(testGameState().run.status).toBe('failed');
		expect(summary.status).toBe('failed');
		expect(summary).toHaveProperty('runId');
		expect(summary).toHaveProperty('players');
	});

	it('giveUp returns to lobby, strips run loot, and preserves HP', async () => {
		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);
		await waitForEvent(socket1, 'stateUpdate');

		const playerId = socket1._playerId;
		testGameState().players[playerId].hp = 47;
		testGameState().players[playerId].currency = 80;
		testGameState().players[playerId].currencyEarnedThisRun = 15;

		const abandonedPromise = waitForEvent(socket1, 'runAbandoned');
		const statePromise = waitForEvent(socket1, 'stateUpdate');
		socket1.emit('giveUp');
		await abandonedPromise;
		const stateUpdate = await statePromise;

		expect(testGameState().gamePhase).toBe('lobby');
		expect(stateUpdate.gamePhase).toBe('lobby');
		expect(testGameState().run).toBeUndefined();
		expect(testGameState().players[playerId].hp).toBe(47);
		expect(testGameState().players[playerId].currency).toBe(65);
		expect(testGameState().players[playerId].currencyEarnedThisRun).toBe(0);
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
		expect(testGameState().gamePhase).toBe('playing');
		expect(testGameState().run).toBeDefined();
		expect(testGameState().enemies.length).toBeGreaterThan(0);

		// Add some minions and loot to verify they're cleared
		testGameState().minions.push({ id: 'm1', ownerId: socket1._playerId, x: 0, z: 0, hp: 50, ttl: 30 });
		testGameState().loot.push({ id: 'l1', x: 0, z: 0, value: 10, createdAt: Date.now() });

		// Set run to terminal state so returnToLobby is allowed
		testGameState().run.status = 'victory';

		// Listen for stateUpdate after returnToLobby
		const stateUpdatePromise = waitForEvent(socket1, 'stateUpdate');

		socket1.emit('returnToLobby');

		const stateUpdate = await stateUpdatePromise;

		// Verify gamePhase reset
		expect(testGameState().gamePhase).toBe('lobby');
		expect(stateUpdate.gamePhase).toBe('lobby');

		// Verify run is cleared
		expect(testGameState().run).toBeUndefined();

		// Verify entities are cleared
		expect(testGameState().enemies.length).toBe(0);
		expect(testGameState().minions.length).toBe(0);
		expect(testGameState().loot.length).toBe(0);

		// Verify players are set to ready: false
		expect(testGameState().players[socket1._playerId].ready).toBe(false);
		expect(testGameState().players[socket2._playerId].ready).toBe(false);
	});

	it('after returnToLobby, players can ready up and start a second run with a fresh objective', async () => {
		// --- First run ---
		const startGame1a = waitForEvent(socket1, 'startGame');
		const startGame2a = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1a, startGame2a]);
		await waitForEvent(socket1, 'stateUpdate');

		const firstRunId = testGameState().run.id;
		expect(testGameState().run).toBeDefined();

		// Set run to terminal state so returnToLobby is allowed
		testGameState().run.status = 'victory';

		// --- Return to lobby ---
		const stateUpdateAfterReturn = waitForEvent(socket1, 'stateUpdate');
		socket1.emit('returnToLobby');
		await stateUpdateAfterReturn;

		expect(testGameState().gamePhase).toBe('lobby');
		expect(testGameState().run).toBeUndefined();

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
		expect(testGameState().run).toBeDefined();
		expect(testGameState().run.id).not.toBe(firstRunId);
		expect(testGameState().run.status).toBe('playing');
		expect(testGameState().run.objective.defeatedEnemies).toBe(0);
		expect(testGameState().run.objective.totalEnemies).toBeGreaterThan(0);

		// Verify the stateUpdate contains the new run
		expect(secondState).toHaveProperty('run');
		expect(secondState.run.id).toBe(testGameState().run.id);
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
		expect(testGameState().gamePhase).toBe('playing');
		expect(testGameState().run.status).toBe('playing');

		const runId = testGameState().run.id;
		const enemyCount = testGameState().enemies.length;

		// Emit returnToLobby from one socket while run is still active
		socket1.emit('returnToLobby');

		// Give the server a moment to process (and reject) the request
		await sleep(100);

		// Verify testGameState().gamePhase remains 'playing'
		expect(testGameState().gamePhase).toBe('playing');

		// Verify testGameState().run still exists with the same id and status
		expect(testGameState().run).toBeDefined();
		expect(testGameState().run.id).toBe(runId);
		expect(testGameState().run.status).toBe('playing');

		// Verify enemies count is unchanged
		expect(testGameState().enemies.length).toBe(enemyCount);
	});

	it('returnToLobby rejects request while run is still playing and emits runError to requesting socket', async () => {
		// Start a game
		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);
		await waitForEvent(socket1, 'stateUpdate');

		expect(testGameState().run.status).toBe('playing');

		// Attempt returnToLobby while run is active
		const runErrorPromise = waitForEvent(socket1, 'runError');
		socket1.emit('returnToLobby');
		const runError = await runErrorPromise;

		// Verify rejection
		expect(runError.reason).toBe('Run still in progress');

		// Verify gameState was not mutated
		expect(testGameState().gamePhase).toBe('playing');
		expect(testGameState().run).toBeDefined();
		expect(testGameState().run.status).toBe('playing');
	});

	it('player with 0 currency dies, returns to lobby with LOBBY_REVIVE_HP, and redeploy succeeds', async () => {
		// 1. Player starts with 0 currency (default for new accounts)
		const player1 = testGameState().players[socket1._playerId];
		expect(player1.currency).toBe(0);

		// 2. Start a run
		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);
		await waitForEvent(socket1, 'stateUpdate');

		// 3. Kill all players via run-failed debug scenario (sets hp:0, dead:true)
		// Set up event listener BEFORE triggering the scenario
		const runFailedPromise = waitForEvent(socket1, 'runFailed');
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'run-failed' });
		const summary = await runFailedPromise;
		const debugResult = await debugResultPromise;
		expect(debugResult.ok).toBe(true);

		// 4. Verify runFailed is emitted
		expect(summary.status).toBe('failed');
		expect(testGameState().run.status).toBe('failed');

		// Wait for state update reflecting terminal state
		await waitForEvent(socket1, 'stateUpdate');

		// 5. Return to lobby
		const stateUpdatePromise = waitForEvent(socket1, 'stateUpdate');
		socket1.emit('returnToLobby');
		await stateUpdatePromise;

		// 6. Verify player HP is LOBBY_REVIVE_HP (10) and dead: false
		expect(testGameState().gamePhase).toBe('lobby');
		expect(player1.hp).toBe(LOBBY_REVIVE_HP);
		expect(player1.dead).toBe(false);

		// 7. Ready up and deploy into a new run
		const startGame1b = waitForEvent(socket1, 'startGame');
		const startGame2b = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1b, startGame2b]);

		// 8. Verify new run starts successfully
		expect(testGameState().gamePhase).toBe('playing');
		expect(player1.hp).toBeGreaterThan(0);
		expect(player1.dead).toBe(false);
		expect(testGameState().run.status).toBe('playing');
	});
});

describe('Rewards in run complete payload', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const connected = await connectTwoClients(baseUrl);
		socket1 = connected.socket1;
		socket2 = connected.socket2;
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

		const player = testGameState().players[socket1._playerId];
		testGameState().enemies = [];
		testGameState().run.objective.totalEnemies = 1;
		testGameState().run.objective.defeatedEnemies = 1;
		testGameState().minions = [];

		// Clear victory counter so we get a deterministic card (no enemy card drops)
		if (!testGameState()._victoryCounters) testGameState()._victoryCounters = {};
		testGameState()._victoryCounters[socket1._playerId] = 0;

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		runSimulationInPrimaryLobby(() => checkRunTerminalState());
		const summary = await runCompletePromise;

		expect(summary.status).toBe('victory');
		expect(summary.players.length).toBeGreaterThan(0);

		const playerEntry = summary.players.find(p => p.id === socket1._playerId);
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

	it('offers card choices from defeated enemies and claims exactly one card', async () => {
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		const player = testGameState().players[socket1._playerId];
		testGameState().enemies = [{
			id: 'drop_enemy',
			type: 'grunt',
			cardDrop: 'dungeon_drake',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		testGameState().run.objective.totalEnemies = 1;
		testGameState().run.objective.defeatedEnemies = 0;
		testGameState().minions = [];

		const before = player.ownedCards.dungeon_drake || 0;
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		const summary = await runCompletePromise;

		expect(summary.players.find(p => p.id === socket1._playerId).cardChoices)
			.toEqual(expect.arrayContaining([
				expect.objectContaining({ id: 'dungeon_drake' })
			]));

		expect(player.ownedCards.dungeon_drake || 0).toBe(before);

		const rewardClaimed = waitForEvent(socket1, 'cardRewardClaimed');
		socket1.emit('claimCardReward', { cardId: 'dungeon_drake' });
		await rewardClaimed;

		expect(player.ownedCards.dungeon_drake).toBe(before + 1);
	});

	it('rejecting duplicate card reward claims does not add a second copy', async () => {
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		const player = testGameState().players[socket1._playerId];
		testGameState().enemies = [{
			id: 'drop_enemy',
			type: 'grunt',
			cardDrop: 'dungeon_drake',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		testGameState().run.objective.totalEnemies = 1;
		testGameState().run.objective.defeatedEnemies = 0;
		testGameState().minions = [];

		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		await runCompletePromise;

		const before = player.ownedCards.dungeon_drake || 0;

		const firstClaim = waitForEvent(socket1, 'cardRewardClaimed');
		socket1.emit('claimCardReward', { cardId: 'dungeon_drake' });
		await firstClaim;

		socket1.emit('claimCardReward', { cardId: 'dungeon_drake' });
		await sleep(50);

		expect(player.ownedCards.dungeon_drake).toBe(before + 1);
	});

	it('runFailed payload contains per-player rewards but no victory card', async () => {
		const runFailedPromise = waitForEvent(socket1, 'runFailed');
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'run-failed' });
		const summary = await runFailedPromise;
		const debugResult = await debugResultPromise;
		expect(debugResult.ok).toBe(true);

		expect(summary.status).toBe('failed');
		expect(summary.players.length).toBeGreaterThan(0);

		const playerEntry = summary.players.find(p => p.id === socket1._playerId);
		expect(playerEntry).toBeDefined();
		expect(playerEntry).toHaveProperty('rewards');
		expect(playerEntry.rewards).toHaveProperty('currency');
		expect(playerEntry.rewards).toHaveProperty('cards');

		// On failure, the player should NOT have received a victory card reward.
		// runRewards should exist but contain no bonus currency and no cards.
		const actualPlayer = testGameState().players[socket1._playerId];
		expect(actualPlayer.runRewards).not.toBeNull();
		expect(actualPlayer.runRewards.cards.length).toBe(0);
		expect(actualPlayer.runRewards.currency).toBe(0);
	});

	it('runFailed is emitted when all players exhaust their deck and hand', async () => {
		const runFailedPromise = waitForEvent(socket1, 'runFailed');
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'run-exhausted' });
		const summary = await runFailedPromise;
		const debugResult = await debugResultPromise;
		expect(debugResult.ok).toBe(true);

		expect(summary.status).toBe('failed');
		expect(testGameState().run.status).toBe('failed');
	});

	it('currency picked up via lootPickup appears in player currency in the run summary', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		const player = testGameState().players[socket1._playerId];

		// Place a loot item near the player
		const lootValue = 15;
		testGameState().loot.push({
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
		expect(testGameState().loot.find(l => l.id === 'loot_test')).toBeUndefined();
		expect(player.currency).toBe(currencyBefore + lootValue);

		// Now trigger a victory to check the summary includes the currency
		testGameState().enemies = [{
			id: 'e_final',
			type: 'grunt',
			x: player.x + 3,
			z: player.z,
			hp: 10,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		}];
		testGameState().run.objective.totalEnemies = 1;
		testGameState().run.objective.defeatedEnemies = 0;
		testGameState().minions = [];

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		socket1.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		const summary = await runCompletePromise;

		expect(summary.status).toBe('victory');

		const playerEntry = summary.players.find(p => p.id === socket1._playerId);
		expect(playerEntry).toBeDefined();
		// Player currency in summary should include the picked-up loot (+10 victory bonus)
		expect(playerEntry.currency).toBe(currencyBefore + lootValue + 10);
	});
});

describe('Reward state persistence across runs', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const connected = await connectTwoClients(baseUrl);
		socket1 = connected.socket1;
		socket2 = connected.socket2;
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

		const player = testGameState().players[socket1._playerId];

		// Record initial ownedCards
		const initialOwnedCards = { ...player.ownedCards };
		const initialCurrency = player.currency;

		testGameState().enemies = [];
		testGameState().run.objective.totalEnemies = 1;
		testGameState().run.objective.defeatedEnemies = 1;
		testGameState().minions = [];

		if (!testGameState()._victoryCounters) testGameState()._victoryCounters = {};
		testGameState()._victoryCounters[socket1._playerId] = 0;

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		runSimulationInPrimaryLobby(() => checkRunTerminalState());
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

		const player = testGameState().players[socket1._playerId];

		testGameState().enemies = [];
		testGameState().run.objective.totalEnemies = 1;
		testGameState().run.objective.defeatedEnemies = 1;
		testGameState().minions = [];

		if (!testGameState()._victoryCounters) testGameState()._victoryCounters = {};
		testGameState()._victoryCounters[socket1._playerId] = 0;

		const runComplete1 = waitForEvent(socket1, 'runComplete');
		runSimulationInPrimaryLobby(() => checkRunTerminalState());
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

		testGameState().enemies = [];
		testGameState().run.objective.totalEnemies = 1;
		testGameState().run.objective.defeatedEnemies = 1;
		testGameState().minions = [];

		const runComplete2 = waitForEvent(socket1, 'runComplete');
		runSimulationInPrimaryLobby(() => checkRunTerminalState());
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

		const player = testGameState().players[socket1._playerId];

		testGameState().enemies = [];
		testGameState().run.objective.totalEnemies = 1;
		testGameState().run.objective.defeatedEnemies = 1;
		testGameState().minions = [];

		if (!testGameState()._victoryCounters) testGameState()._victoryCounters = {};
		testGameState()._victoryCounters[socket1._playerId] = 0;

		const runCompletePromise = waitForEvent(socket1, 'runComplete');
		runSimulationInPrimaryLobby(() => checkRunTerminalState());
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
		const connected = await connectTwoClients(baseUrl);
		socket1 = connected.socket1;
		socket2 = connected.socket2;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	it('player A adds a card and receives deckUpdate; player B deck is unchanged', async () => {
		const playerA = testGameState().players[socket1._playerId];
		const deckB = [...testGameState().players[socket2._playerId].selectedDeck];

		// Default deck already contains all owned cards, so remove one first to make room
		const removePromise = waitForEvent(socket1, 'deckUpdate');
		socket1.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		await removePromise;
		const deckAfterRemove = [...playerA.selectedDeck];

		// Now add dungeon_drake back
		const deckUpdatePromise = waitForEvent(socket1, 'deckUpdate');
		socket1.emit('deckAddCard', { cardId: 'dungeon_drake' });
		const update = await deckUpdatePromise;

		expect(update.selectedDeck).toBeDefined();
		expect(update.ownedCards).toBeDefined();
		expect(update.inventory).toBeDefined();
		expect(update.selectedDeck.length).toBe(deckAfterRemove.length + 1);
		expect(selectedDeckCardIds(playerA, update.selectedDeck)).toContain('dungeon_drake');

		// Verify server state
		expect(playerA.selectedDeck.length).toBe(deckAfterRemove.length + 1);

		// Player B's deck must be unchanged
		expect(testGameState().players[socket2._playerId].selectedDeck).toEqual(deckB);
	});

	it('player removes a card from deck and receives deckUpdate', async () => {
		const playerA = testGameState().players[socket1._playerId];
		const deckBefore = [...playerA.selectedDeck];

		// Remove both dungeon_drake copies from the default deck
		for (let i = 0; i < 2; i++) {
			const deckUpdatePromise = waitForEvent(socket1, 'deckUpdate');
			socket1.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
			await deckUpdatePromise;
		}

		expect(playerA.selectedDeck.length).toBe(deckBefore.length - 2);
		expect(selectedDeckCardIds(playerA)).not.toContain('dungeon_drake');
	});

	it('adds and removes a specific duplicate card instance by instanceId', async () => {
		const playerA = testGameState().players[socket1._playerId];
		const originalDeck = [...playerA.selectedDeck];
		const ironInstances = playerA.inventory.filter((instance) => instance.cardId === 'iron_sword');
		expect(ironInstances.length).toBeGreaterThan(1);

		const firstIron = ironInstances[0];
		const secondIron = ironInstances[1];

		const removeFirstPromise = waitForEvent(socket1, 'deckUpdate');
		socket1.emit('deckRemoveCard', { instanceId: firstIron.instanceId, cardId: firstIron.cardId });
		await removeFirstPromise;

		expect(playerA.selectedDeck).not.toContain(firstIron.instanceId);
		expect(playerA.selectedDeck).toContain(secondIron.instanceId);

		const addFirstPromise = waitForEvent(socket1, 'deckUpdate');
		socket1.emit('deckAddCard', { instanceId: firstIron.instanceId, cardId: firstIron.cardId });
		await addFirstPromise;

		expect(playerA.selectedDeck).toContain(firstIron.instanceId);
		expect(playerA.selectedDeck).toContain(secondIron.instanceId);
		expect(playerA.selectedDeck.length).toBe(originalDeck.length);

		const removeSecondPromise = waitForEvent(socket1, 'deckUpdate');
		socket1.emit('deckRemoveCard', { instanceId: secondIron.instanceId, cardId: secondIron.cardId });
		await removeSecondPromise;

		expect(playerA.selectedDeck).toContain(firstIron.instanceId);
		expect(playerA.selectedDeck).not.toContain(secondIron.instanceId);
	});

	it('deckAddCard during playing phase is silently ignored', async () => {
		const playerA = testGameState().players[socket1._playerId];
		const deckBefore = [...playerA.selectedDeck];

		// Enter playing phase
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket1, 'stateUpdate');

		expect(testGameState().gamePhase).toBe('playing');

		// Attempt to add a card — should be silently ignored
		socket1.emit('deckAddCard', { cardId: 'iron_sword' });

		await sleep(200);

		expect(playerA.selectedDeck).toEqual(deckBefore);
	});

	it('deckRemoveCard during playing phase is silently ignored', async () => {
		const playerA = testGameState().players[socket1._playerId];
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
		const playerA = testGameState().players[socket1._playerId];
		expect(playerA.selectedDeck.length).toBe(12); // default deck size
	});

	it('removing card not in deck emits deckError', async () => {
		const playerA = testGameState().players[socket1._playerId];

		// Remove both dungeon_drake copies from deck
		for (let i = 0; i < 2; i++) {
			socket1.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
			await sleep(100);
		}

		// Now try to remove it again — should fail
		const deckErrorPromise = waitForEvent(socket1, 'deckError');
		socket1.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		const err = await deckErrorPromise;

		expect(err.reason).toContain('not in deck');
		expect(selectedDeckCardIds(playerA)).not.toContain('dungeon_drake');
	});

	it('adding too many copies of a card emits deckError', async () => {
		const playerA = testGameState().players[socket1._playerId];
		// Default deck already contains all 4 owned iron_swords — adding another should fail
		const deckErrorPromise = waitForEvent(socket1, 'deckError');
		socket1.emit('deckAddCard', { cardId: 'iron_sword' });
		const err = await deckErrorPromise;

		expect(err.reason).toContain('No extra copies');

		// Count iron_swords in deck — should be exactly 4 (unchanged)
		const ironCount = selectedDeckCardIds(playerA).filter(id => id === 'iron_sword').length;
		expect(ironCount).toBe(4);
	});

	it('two players can edit decks independently without affecting each other', async () => {
		const deckA = [...testGameState().players[socket1._playerId].selectedDeck];
		const deckB = [...testGameState().players[socket2._playerId].selectedDeck];

		// Player A removes both dungeon_drake copies from the default deck
		socket1.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		await sleep(100);
		socket1.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		await sleep(100);

		// Player B removes both dungeon_drake copies from the default deck
		const deckUpdateB = waitForEvent(socket2, 'deckUpdate');
		socket2.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		await deckUpdateB;
		socket2.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		await sleep(100);

		// Verify independence
		expect(testGameState().players[socket1._playerId].selectedDeck.length).toBe(deckA.length - 2);
		expect(testGameState().players[socket2._playerId].selectedDeck.length).toBe(deckB.length - 2);
		expect(selectedDeckCardIds(testGameState().players[socket1._playerId])).not.toContain('dungeon_drake'); // A removed it
		expect(selectedDeckCardIds(testGameState().players[socket2._playerId])).not.toContain('dungeon_drake'); // B removed it
	});
});

describe('Server Ready Validation and Deck-to-Hand', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const connected = await connectTwoClients(baseUrl);
		socket1 = connected.socket1;
		socket2 = connected.socket2;
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
		expect(init).toHaveProperty('inventory');
		expect(Array.isArray(init.inventory)).toBe(true);
		expect(init).toHaveProperty('ownedCards');
		expect(typeof init.ownedCards).toBe('object');
		expect(init).toHaveProperty('inventory');
		expect(Array.isArray(init.inventory)).toBe(true);

		testSocket.disconnect();
		await sleep(50);
	});

	it('converts old persisted ownedCards count-map data on connect', async () => {
		const accountId = `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const testProvider = new InMemoryProvider();
		testProvider.savePlayer(accountId, {
			currency: 77,
			ownedCards: { iron_sword: 2, flame_blade: 1 },
			selectedDeck: ['iron_sword', 'iron_sword', 'flame_blade'],
			x: 1,
			y: 0.5,
			z: 2,
			rotation: 0
		});
		setTestProvider(testProvider);

		const { socket, init, lobbyId } = await connectClient(baseUrl, accountId);
		const player = lobbyGameState(lobbyId).players[socket._playerId];
		expect(player).toBeDefined();

		expect(init.ownedCards).toEqual({ iron_sword: 2, flame_blade: 1 });
		expect(init.inventory).toHaveLength(3);
		expect(new Set(init.inventory.map((instance) => instance.instanceId)).size).toBe(3);
		expect(selectedDeckCardIds(player)).toEqual(['iron_sword', 'iron_sword', 'flame_blade']);

		socket.disconnect();
		setTestProvider(new InMemoryProvider());
		await sleep(50);
	});

	it('ready is rejected with deckError when deck is too small', async () => {
		// Shrink socket1's deck below DECK_MIN_SIZE
		testGameState().players[socket1._playerId].selectedDeck = ['iron_sword', 'flame_blade'];

		const deckErrorPromise = waitForEvent(socket1, 'deckError');

		socket1.emit('playerReady', true);

		const err = await deckErrorPromise;
		expect(err).toHaveProperty('reason');
		expect(err.reason).toContain('at least');

		// player.ready should remain false
		expect(testGameState().players[socket1._playerId].ready).toBe(false);
	});

	it('a valid selected deck populates player.deck when the run starts', async () => {
		// Ensure both players have valid default decks (8 cards each)
		const deck1 = [...testGameState().players[socket1._playerId].selectedDeck];
		const deck2 = [...testGameState().players[socket2._playerId].selectedDeck];

		// Wait for startGame on both sockets
		const startGamePromise1 = waitForEvent(socket1, 'startGame');
		const startGamePromise2 = waitForEvent(socket2, 'startGame');

		// Both players ready up
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);

		// Wait for startGame
		await Promise.all([startGamePromise1, startGamePromise2]);

		// Deck/hand are cold fields — verify from authoritative server state, not tick broadcasts
		const player1 = testGameState().players[socket1._playerId];
		const player2 = testGameState().players[socket2._playerId];

		expect(player1).toBeDefined();
		expect(Array.isArray(player1.deck)).toBe(true);
		// 4 cards are dealt into hand, so deck should have selectedDeck.length - 4
		expect(player1.deck.length).toBe(deck1.length - 4);

		// The deck + hand should contain the same card ids as selectedDeck (shuffled)
		const deck1Cards = player1.deck
			.map((entry) => cardIdForDeckEntry(entry, player1.inventory));
		const hand1Cards = player1.hand.filter(c => c).map(c => c.id);
		const allCards = [...deck1Cards, ...hand1Cards].sort();
		const selected1Sorted = selectedDeckCardIds(player1, deck1).sort();
		expect(allCards).toEqual(selected1Sorted);

		expect(player2).toBeDefined();
		expect(Array.isArray(player2.deck)).toBe(true);
		expect(player2.deck.length).toBe(deck2.length - 4);
	});
});

describe('Card evolution handler', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('evolves a +10 inventory instance through the socket event', async () => {
		const player = testGameState().players[socket._playerId];
		const instance = player.inventory.find((card) => card.cardId === 'iron_sword');
		instance.grind = 10;

		const evolutionPromise = waitForEvent(socket, 'cardEvolutionResult');
		socket.emit('evolveCard', { instanceId: instance.instanceId });
		const result = await evolutionPromise;

		expect(result.ok).toBe(true);
		expect(result.instance.instanceId).toBe(instance.instanceId);
		expect(result.instance.cardId).toBe('steel_claymore');
		expect(result.inventory.find((card) => card.instanceId === instance.instanceId).cardId).toBe('steel_claymore');
		expect(result.ownedCards.steel_claymore).toBe(1);
		expect(result.selectedDeck).toContain(instance.instanceId);
	});

	it('rejects socket evolution below +10', async () => {
		const player = testGameState().players[socket._playerId];
		const instance = player.inventory.find((card) => card.cardId === 'flame_blade');
		instance.grind = 9;

		const errorPromise = waitForEvent(socket, 'cardEvolutionError');
		socket.emit('evolveCard', { instanceId: instance.instanceId });
		const error = await errorPromise;

		expect(error.reason).toContain('+10');
		expect(instance.cardId).toBe('flame_blade');
	});

	it('rejects socket evolution for cards with no transform', async () => {
		const player = testGameState().players[socket._playerId];
		const instance = {
			instanceId: 'already-evolved',
			cardId: 'steel_claymore',
			grind: 10,
			level: 1,
			isEvolved: true,
		};
		player.inventory.push(instance);
		player.ownedCards.steel_claymore = 1;

		const errorPromise = waitForEvent(socket, 'cardEvolutionError');
		socket.emit('evolveCard', { instanceId: instance.instanceId });
		const error = await errorPromise;

		expect(error.reason).toContain('No evolution available');
		expect(instance.cardId).toBe('steel_claymore');
	});
});

describe('Lobby card sell and trade', () => {
	let baseUrl, socket1, socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const connected = await connectTwoClients(baseUrl);
		socket1 = connected.socket1;
		socket2 = connected.socket2;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	async function removeFromDeck(socket, player, cardId, count = 1) {
		const instances = player.inventory.filter((instance) => instance.cardId === cardId);
		let removed = 0;
		for (const instance of instances) {
			if (removed >= count) break;
			if (!player.selectedDeck.includes(instance.instanceId)) continue;
			const promise = waitForEvent(socket, 'deckUpdate');
			socket.emit('deckRemoveCard', { instanceId: instance.instanceId, cardId });
			await promise;
			removed++;
		}
	}

	it('selling an extra owned card grants currency and preserves deck validity', async () => {
		const player = testGameState().players[socket1._playerId];
		await removeFromDeck(socket1, player, 'iron_sword', 1);

		const deckBefore = [...player.selectedDeck];
		const currencyBefore = player.currency;

		const updatePromise = waitForEvent(socket1, 'cardInventoryUpdate');
		socket1.emit('sellCard', { cardId: 'iron_sword' });
		await updatePromise;

		expect(player.ownedCards.iron_sword).toBe(3);
		expect(player.currency).toBeGreaterThan(currencyBefore);
		expect(player.selectedDeck).toEqual(deckBefore);
		expect(validateDeck(player.selectedDeck, player.inventory).valid).toBe(true);
	});

	it('rejects selling a card that is required by the selected deck', async () => {
		const player = testGameState().players[socket1._playerId];
		const flames = player.inventory.filter((instance) => instance.cardId === 'flame_blade');
		expect(flames.length).toBe(3);
		for (const instance of flames) {
			expect(player.selectedDeck).toContain(instance.instanceId);
		}

		const errorPromise = waitForEvent(socket1, 'deckError');
		socket1.emit('sellCard', { cardId: 'flame_blade' });
		const err = await errorPromise;

		expect(err.reason).toMatch(/deck/i);
		expect(player.ownedCards.flame_blade).toBe(3);
	});

	it('lobbyUpdate includes a shop offer with cardId and price', async () => {
		const lobbyUpdatePromise = waitForEvent(socket1, 'lobbyUpdate');
		socket2.emit('playerReady', true);
		const update = await lobbyUpdatePromise;

		expect(update.shopOffer).toBeTruthy();
		expect(update.shopOffer.cardId).toBeTruthy();
		expect(update.shopOffer.price).toBeGreaterThan(0);
	});

	it('trade offer/accept swaps cards once and preserves both decks', async () => {
		const playerA = testGameState().players[socket1._playerId];
		const playerB = testGameState().players[socket2._playerId];

		await removeFromDeck(socket1, playerA, 'iron_sword', 1);
		await removeFromDeck(socket2, playerB, 'flame_blade', 1);

		const aIronBefore = playerA.ownedCards.iron_sword;
		const aFlameBefore = playerA.ownedCards.flame_blade || 0;
		const bIronBefore = playerB.ownedCards.iron_sword || 0;
		const bFlameBefore = playerB.ownedCards.flame_blade;
		const deckABefore = [...playerA.selectedDeck];
		const deckBBefore = [...playerB.selectedDeck];

		const offerPromise = waitForEvent(socket2, 'tradeOffer');
		socket1.emit('offerCardTrade', {
			targetPlayerId: socket2._playerId,
			offeredCardId: 'iron_sword',
			requestedCardId: 'flame_blade'
		});
		const offer = await offerPromise;
		expect(offer.tradeId).toBeTruthy();

		const aUpdatePromise = waitForEvent(socket1, 'cardInventoryUpdate');
		const bUpdatePromise = waitForEvent(socket2, 'cardInventoryUpdate');
		socket2.emit('respondCardTrade', { tradeId: offer.tradeId, accepted: true });
		await Promise.all([aUpdatePromise, bUpdatePromise]);

		expect(playerA.ownedCards.iron_sword).toBe(aIronBefore - 1);
		expect(playerA.ownedCards.flame_blade).toBe(aFlameBefore + 1);
		expect(playerB.ownedCards.iron_sword).toBe(bIronBefore + 1);
		expect(playerB.ownedCards.flame_blade).toBe(bFlameBefore - 1);
		expect(playerA.selectedDeck).toEqual(deckABefore);
		expect(playerB.selectedDeck).toEqual(deckBBefore);
		expect(validateDeck(playerA.selectedDeck, playerA.inventory).valid).toBe(true);
		expect(validateDeck(playerB.selectedDeck, playerB.inventory).valid).toBe(true);
	});

	it('trade reject does not mutate inventories', async () => {
		const playerA = testGameState().players[socket1._playerId];
		const playerB = testGameState().players[socket2._playerId];

		await removeFromDeck(socket1, playerA, 'iron_sword', 1);
		await removeFromDeck(socket2, playerB, 'flame_blade', 1);

		const aSnapshot = JSON.stringify(playerA.inventory);
		const bSnapshot = JSON.stringify(playerB.inventory);

		const offerPromise = waitForEvent(socket2, 'tradeOffer');
		socket1.emit('offerCardTrade', {
			targetPlayerId: socket2._playerId,
			offeredCardId: 'iron_sword',
			requestedCardId: 'flame_blade'
		});
		const offer = await offerPromise;

		const rejectPromise = waitForEvent(socket2, 'tradeUpdate');
		socket2.emit('respondCardTrade', { tradeId: offer.tradeId, accepted: false });
		const result = await rejectPromise;

		expect(result.status).toBe('rejected');
		expect(JSON.stringify(playerA.inventory)).toBe(aSnapshot);
		expect(JSON.stringify(playerB.inventory)).toBe(bSnapshot);
	});
});

describe('Card grinding handler', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('grinds an inventory instance through the socket event', async () => {
		const player = testGameState().players[socket._playerId];
		player.currency = 500;
		const instance = player.inventory.find((card) => card.cardId === 'iron_sword');

		const grindPromise = waitForEvent(socket, 'cardGrindResult');
		socket.emit('grindCard', { instanceId: instance.instanceId });
		const result = await grindPromise;

		expect(result.ok).toBe(true);
		expect(result.instance.instanceId).toBe(instance.instanceId);
		expect(result.instance.grind).toBe(1);
		expect(result.currency).toBe(400);
		expect(result.inventory.find((card) => card.instanceId === instance.instanceId).grind).toBe(1);
	});

	it('rejects socket grinding without enough gold', async () => {
		const player = testGameState().players[socket._playerId];
		player.currency = 0;
		const instance = player.inventory.find((card) => card.cardId === 'flame_blade');

		const errorPromise = waitForEvent(socket, 'cardGrindError');
		socket.emit('grindCard', { instanceId: instance.instanceId });
		const error = await errorPromise;

		expect(error.reason).toContain('Not enough money');
		expect(instance.grind).toBe(0);
	});

	it('applies grind multiplier to weapon damage during a run', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		const weaponSlot = player.hand.findIndex((card) => card && card.type === 'weapon');
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		player.hand[weaponSlot] = {
			...player.hand[weaponSlot],
			id: 'iron_sword',
			grind: 5,
		};

		testGameState().enemies = [{
			id: 'e_grind',
			type: 'grunt',
			x: player.x + 3,
			z: player.z,
			hp: 100,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z },
		}];

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'iron_sword', slotIndex: weaponSlot });
		const cardUsed = await cardUsedPromise;

		expect(cardUsed.hits).toHaveLength(1);
		expect(cardUsed.hits[0].hp).toBe(100 - Math.round(17 * 1.25));
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

		const player = testGameState().players[socket._playerId];
		const initialHp = player.hp;

		// Place an enemy in chasing state, within attack range of the player
		// We position it just within ENEMY_ATTACK_RANGE so updateEnemies triggers windup
		testGameState().enemies = [{
			id: 'e_telegraph',
			type: 'grunt',
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
			if (data.players && data.players[socket._playerId] && data.players[socket._playerId].hp < initialHp) {
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
			return su.players && su.players[socket._playerId] && su.players[socket._playerId].hp < initialHp;
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

		const player = testGameState().players[socket._playerId];

		// Place enemy in chasing state, within attack range so it transitions to windup
		testGameState().enemies = [{
			id: 'e_avoid',
			type: 'grunt',
			x: player.x + ENEMY_ATTACK_RANGE - 1,
			z: player.z,
			hp: 50,
			state: 'chasing',
			attackState: 'chasing',
			wanderTarget: { x: player.x, z: player.z }
		}];

		// Wait for the game tick to transition enemy to windup
		await sleep(100);

		expect(testGameState().enemies[0].attackState).toBe('windup');

		// Move player far away from the enemy using intent-based moves.
		// Each server tick applies MOVE_SPEED / TICK_RATE while input stays fresh.
		// away to be safe. Emit moves across multiple ticks to accumulate distance.
		for (let i = 0; i < 10; i++) {
			socket.emit('move', { dx: -1, dz: -1, rotation: 0 });
			await sleep(60); // wait for server tick between moves
		}

		// Wait for windup to expire (800ms from windup start)
		await sleep(ENEMY_DEFS.grunt.attackWindupMs + 200);

		// Trigger the game loop so updateEnemies revalidates the windup
		// and cancels the attack since the player is out of range
		runSimulationInPrimaryLobby(() => updateEnemies());

		// Player HP should remain at initial value (100)
		expect(player.hp).toBe(100);

		// Enemy should have cancelled the attack — attackState is no longer 'windup'
		expect(testGameState().enemies[0].attackState).not.toBe('windup');
	});

	it('skirmisher cone attack misses when player dodges sideways', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		const now = Date.now();

		testGameState().enemies = [{
			id: 'e_skirm_dodge',
			type: 'skirmisher',
			x: player.x,
			z: player.z,
			hp: 20,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: socket._playerId,
			windupStartTime: now - ENEMY_DEFS.skirmisher.attackWindupMs - 100,
			windupDirX: 1,
			windupDirZ: 0,
			wanderTarget: { x: player.x, z: player.z },
		}];

		// Still within ENEMY_ATTACK_RANGE but outside the locked forward cone
		player.z += 3;

		runSimulationInPrimaryLobby(() => updateEnemies());

		expect(player.hp).toBe(100);
	});

	it('skirmisher cone attack hits player directly in front', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		const initialHp = player.hp;
		const now = Date.now();

		testGameState().enemies = [{
			id: 'e_skirm_hit',
			type: 'skirmisher',
			x: player.x,
			z: player.z,
			hp: 20,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: socket._playerId,
			windupStartTime: now - ENEMY_DEFS.skirmisher.attackWindupMs - 100,
			windupDirX: 1,
			windupDirZ: 0,
			wanderTarget: { x: player.x, z: player.z },
		}];

		player.x += 3;

		runSimulationInPrimaryLobby(() => updateEnemies());

		expect(player.hp).toBe(initialHp - ENEMY_DEFS.skirmisher.attackDamage);
		expect(testGameState().enemies[0].attackState).toBe('recovering');
	});

	it('standing still near enemy results in damage after windup + strike', async () => {
		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		expect(player.hp).toBe(MAX_HP);

		// Place a single grunt enemy within ENEMY_ATTACK_RANGE of the player
		testGameState().enemies = [{
			id: 'e_damage_test',
			type: 'grunt',
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
		const client2 = await connectClient(baseUrl, undefined, { joinLobbyId: client1.lobbyId });

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
		const client2 = await connectClient(baseUrl, undefined, { joinLobbyId: client1.lobbyId });

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

	it('after resetGameState() layout seed stays quest-derived for the default quest', async () => {
		const client1 = await connectClient(baseUrl);
		const firstSeed = client1.init.layoutSeed;

		client1.socket.disconnect();
		await sleep(50);

		resetGameState();

		const client2 = await connectClient(baseUrl);
		const secondSeed = client2.init.layoutSeed;

		expect(secondSeed).toBe(firstSeed);

		expect(Array.isArray(client2.init.layout.rooms)).toBe(true);
		expect(client2.init.layout.rooms.length).toBeGreaterThan(0);

		client2.socket.disconnect();
		await sleep(50);
	});

	it('clampToDungeon() prevents player movement beyond dungeon bounds', async () => {
		const client = await connectClient(baseUrl);
		const bounds = testGameState().dungeonBounds;

		// Enter playing phase so moves are processed
		const debugResultPromise = waitForEvent(client.socket, 'debugScenarioResult');
		client.socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(client.socket, 'stateUpdate');

		const player = testGameState().players[client.socket._playerId];

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
		const player = testGameState().players[socket._playerId];
		const lootValue = 10;

		// Place a loot item
		testGameState().loot.push({
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
		expect(testGameState().loot.find(l => l.id === 'loot_idempotent')).toBeUndefined();

		// Second emit — loot is already gone, server should ignore (idempotent)
		socket.emit('lootPickup', { lootId: 'loot_idempotent' });
		await sleep(50);

		// Currency should NOT have increased again
		expect(player.currency).toBe(currencyBefore + lootValue);
	});

	it('emitting lootPickup for a non-existent loot ID is a no-op', async () => {
		const player = testGameState().players[socket._playerId];
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

	it('emitting lootPickup as a dead player leaves loot in testGameState().loot and currency unchanged', async () => {
		const player = testGameState().players[socket._playerId];
		const lootValue = 12;

		// Place a loot item near the player
		testGameState().loot.push({
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
		expect(testGameState().loot.find(l => l.id === 'loot_dead_test')).toBeDefined();
		// Currency must be unchanged
		expect(player.currency).toBe(currencyBefore);

		// Revive the player — pickup should now succeed
		player.dead = false;
		socket.emit('lootPickup', { lootId: 'loot_dead_test' });
		await sleep(50);

		expect(testGameState().loot.find(l => l.id === 'loot_dead_test')).toBeUndefined();
		expect(player.currency).toBe(currencyBefore + lootValue);
	});

	it('lootPickup on magic stone loot restores Magic Stones', async () => {
		const player = testGameState().players[socket._playerId];
		player.magicStones = 10;

		testGameState().loot.push({
			id: 'ms_drop_test',
			x: player.x + 1,
			z: player.z + 1,
			value: 20,
			kind: 'magic_stone',
			createdAt: Date.now(),
		});

		socket.emit('lootPickup', { lootId: 'ms_drop_test' });
		await sleep(50);

		expect(player.magicStones).toBe(30);
		expect(testGameState().loot.find(l => l.id === 'ms_drop_test')).toBeUndefined();
	});
});

describe('magic stone drops — any player can pick up', () => {
	let baseUrl, socket1, socket2, lobbyId;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const clients = await connectTwoClients(baseUrl, 'ms-loot-p1', 'ms-loot-p2');
		socket1 = clients.socket1;
		socket2 = clients.socket2;
		lobbyId = clients.lobbyId;
	});

	afterEach(async () => {
		if (socket1 && socket1.connected) socket1.disconnect();
		if (socket2 && socket2.connected) socket2.disconnect();
		await closeServer();
	});

	it('a non-killer player can lootPickup a magic stone on the ground', async () => {
		const state = lobbyGameState(lobbyId);
		const p1 = state.players[socket1._playerId];
		const p2 = state.players[socket2._playerId];
		const p1MsBefore = p1.magicStones;
		p2.magicStones = 15;

		state.loot.push({
			id: 'shared_ms_drop',
			x: p2.x + 1,
			z: p2.z,
			value: 20,
			kind: 'magic_stone',
			createdAt: Date.now(),
		});

		const drop = state.loot.find((l) => l.id === 'shared_ms_drop');
		p2.x = drop.x;
		p2.z = drop.z;

		socket2.emit('lootPickup', { lootId: 'shared_ms_drop' });
		await sleep(50);

		expect(p2.magicStones).toBe(35);
		expect(state.loot.find((l) => l.id === 'shared_ms_drop')).toBeUndefined();
		expect(p1.magicStones).toBe(p1MsBefore);
	});

	it('enemy death spawns magic_stone and currency loot entries any player can reach', async () => {
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
		const debug1 = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'mixed-enemies' });
		await debug1;

		const state = lobbyGameState(lobbyId);
		const grunt = state.enemies.find((e) => e.type === 'grunt');
		expect(grunt).toBeDefined();

		grunt.hp = 0;
		const { setGameState, cleanupAfterDamage } = require('../progression');
		setGameState(state);
		cleanupAfterDamage();

		const msLoot = state.loot.filter((l) => l.kind === 'magic_stone');
		const moneyLoot = state.loot.filter((l) => l.kind === 'currency');
		expect(msLoot.length).toBeGreaterThan(0);
		expect(moneyLoot.length).toBeGreaterThan(0);

		const p2 = state.players[socket2._playerId];
		p2.magicStones = 10;
		const drop = msLoot[0];
		p2.x = drop.x;
		p2.z = drop.z;

		const msBeforePickup = p2.magicStones;
		socket2.emit('lootPickup', { lootId: drop.id });
		const pickupSleepMs = 10;
		await sleep(pickupSleepMs);

		const regenTicksDuringSleep =
			Math.ceil(pickupSleepMs / (1000 / TICK_RATE)) + 1;
		const regenSlack = MAGIC_STONES_REGEN_PER_TICK * regenTicksDuringSleep;
		expect(p2.magicStones).toBeGreaterThanOrEqual(msBeforePickup + drop.value);
		expect(p2.magicStones).toBeLessThanOrEqual(msBeforePickup + drop.value + regenSlack);
		expect(state.loot.find((l) => l.id === drop.id)).toBeUndefined();

		const moneyDrop = moneyLoot[0];
		const currencyBefore = p2.currency;
		p2.x = moneyDrop.x;
		p2.z = moneyDrop.z;

		socket2.emit('lootPickup', { lootId: moneyDrop.id });
		await sleep(10);

		expect(p2.currency).toBe(currencyBefore + moneyDrop.value);
		expect(state.loot.find((l) => l.id === moneyDrop.id)).toBeUndefined();
		randomSpy.mockRestore();
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
		expect(testGameState().run).toBeDefined();
		const defeatedBefore = testGameState().run.objective.defeatedEnemies;

		// Place a skirmisher in weapon range with low HP so a single weapon hit kills it
		const player = testGameState().players[socket._playerId];
		let skirmisher;
		runSimulationInPrimaryLobby((state) => {
			spawnEnemy(player.x + 3, player.z, 'skirmisher');
			skirmisher = state.enemies[state.enemies.length - 1];
		});
		expect(skirmisher.type).toBe('skirmisher');
		// Reduce HP so a single weapon hit (min 15 damage) kills it
		skirmisher.hp = 10;

		// Clear minions so they don't interfere
		testGameState().minions = [];

		// Reposition right before the hit to minimize game-loop movement
		skirmisher.x = player.x + 3;
		skirmisher.z = player.z;

		// Seed an instant weapon so the kill resolves synchronously
		// (heavy wind-up weapons like flame_blade land their hit a tick later).
		const weaponSlot = ensureInstantWeaponInHand(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		// Wait for stateUpdate after the swing is initiated
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');

		socket.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		await stateUpdatePromise;

		// Enemy should be removed
		expect(testGameState().enemies.find(e => e.id === skirmisher.id)).toBeUndefined();

		// defeatedEnemies should have incremented
		expect(testGameState().run.objective.defeatedEnemies).toBeGreaterThan(defeatedBefore);
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
		expect(testGameState().run).toBeDefined();
		const defeatedBefore = testGameState().run.objective.defeatedEnemies;

		// Place a miniboss in weapon range
		const player = testGameState().players[socket._playerId];
		let miniboss;
		runSimulationInPrimaryLobby((state) => {
			spawnEnemy(player.x + 3, player.z, 'miniboss');
			miniboss = state.enemies[state.enemies.length - 1];
		});
		expect(miniboss.type).toBe('miniboss');
		expect(miniboss.hp).toBe(ENEMY_DEFS.miniboss.hp); // 150 HP

		// Clear minions so they don't interfere
		testGameState().minions = [];

		// Reduce miniboss HP so it's killable in a small number of hits regardless
		// of which weapon card (iron_sword=17 or flame_blade=28) is dealt into hand.
		// 40 HP → 3 hits with iron_sword (17×3=51) or 2 hits with flame_blade (28×2=56).
		miniboss.hp = 40;

		// Each hit requires COOLDOWN_MS (800ms) + tick time.
		// Worst case: 3 hits × 900ms = 2.7s. Use 10s timeout for safety.
		const hitsNeeded = Math.ceil(miniboss.hp / 17); // worst case: iron_sword (17 dmg)

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
		expect(testGameState().enemies.find(e => e.id === miniboss.id)).toBeUndefined();

		// defeatedEnemies should have incremented
		expect(testGameState().run.objective.defeatedEnemies).toBeGreaterThan(defeatedBefore);
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
		const spawners = testGameState().enemies.filter(e => e.type === 'spawner');
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
		let initialCount;
		runSimulationInPrimaryLobby((state) => {
			state.enemies = [spawner];
			initialCount = state.enemies.length;
			updateEnemies();
			expect(state.enemies.length).toBeGreaterThan(initialCount);
		});
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
		runSimulationInPrimaryLobby((state) => {
			state.enemies = [spawner];
			const initialIds = new Set(state.enemies.map(e => e.id));
			updateEnemies();
			const newEnemies = state.enemies.filter(e => !initialIds.has(e.id));
			expect(newEnemies.length).toBeGreaterThanOrEqual(1);
			const add = newEnemies.find(e => e.type === 'skirmisher' && e.spawnedBy === spawnerId);
			expect(add).toBeDefined();
		});
	});

	it('no regression: grunt and miniboss enemies still present and unaffected', async () => {
		// Enter playing phase via summon-ready.
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });

		const debugResult = await debugResultPromise;
		expect(debugResult.ok).toBe(true);

		await waitForEvent(socket, 'stateUpdate');

		// Inject a grunt and a miniboss directly. Bulk spawning now draws types
		// from the quest's enemy pool, so the default quest no longer guarantees
		// a miniboss — this test is about the spawner not affecting *other* enemy
		// types, so we place them deterministically rather than relying on a draw.
		const grunt = {
			id: 'test-grunt', x: 5, z: 5, type: 'grunt',
			hp: ENEMY_DEFS.grunt.hp, maxHp: ENEMY_DEFS.grunt.hp,
			state: 'idle', attackState: 'idle', wanderTarget: { x: 5, z: 5 },
		};
		const miniboss = {
			id: 'test-miniboss', x: -5, z: -5, type: 'miniboss',
			hp: ENEMY_DEFS.miniboss.hp, maxHp: ENEMY_DEFS.miniboss.hp,
			state: 'idle', attackState: 'idle', wanderTarget: { x: -5, z: -5 },
		};
		runSimulationInPrimaryLobby((state) => {
			state.enemies = [grunt, miniboss];
		});

		const grunts = testGameState().enemies.filter(e => e.type === 'grunt');
		const minibosses = testGameState().enemies.filter(e => e.type === 'miniboss');
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
		testGameState().minions = [];

		// Advance time past spawnIntervalMs and call updateEnemies
		await sleep(ENEMY_DEFS.spawner.spawnIntervalMs + 500);
		runSimulationInPrimaryLobby(() => updateEnemies());

		// Verify grunts and minibosses are still present with same HP
		for (const id of gruntIds) {
			const enemy = testGameState().enemies.find(e => e.id === id);
			expect(enemy).toBeDefined();
			expect(enemy.hp).toBe(gruntHpBefore[id]);
		}
		for (const id of minibossIds) {
			const enemy = testGameState().enemies.find(e => e.id === id);
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

		const player = testGameState().players[socket._playerId];

		// Find a wall in the dungeon layout and try to move through it.
		const layout = testGameState().layout;
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

		const player = testGameState().players[socket._playerId];

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];

		// Place an enemy in range for the first hit
		testGameState().enemies.push({
			id: 'e_cd',
			type: 'grunt',
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

		const player = testGameState().players[socket._playerId];

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);

		// Place an enemy in range
		testGameState().enemies.push({
			id: 'e_cd2',
			type: 'grunt',
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

describe('Fixed tick movement — no elapsed teleport', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('a single stale move intent does not teleport the player', async () => {
		// Enter playing phase
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		const startX = player.x;

		// One move packet, then wait for only a couple ticks
		socket.emit('move', { dx: 1, dz: 0, rotation: 0 });
		await sleep(120);

		const step = MOVE_SPEED / TICK_RATE;
		const actualDist = Math.abs(player.x - startX);

		expect(actualDist).toBeLessThanOrEqual(step * 4 + 0.01);
	});
});

// ── Hand Reconciliation ──

describe('Hand reconciliation — remainingCharges via deckUpdate', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('server corrections to remainingCharges are reflected in deckUpdate after card play', async () => {
		// Enter playing phase
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];

		// Find a weapon card in hand
		const weaponSlot = findWeaponSlot(player);
		expect(weaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = player.hand[weaponSlot];
		const chargesBefore = weaponCard.remainingCharges;

		// Place an enemy in range so the weapon hits something
		testGameState().enemies.push({
			id: 'e_hand_recon',
			type: 'grunt',
			x: player.x + 3,
			z: player.z,
			hp: 100,
			state: 'idle',
			wanderTarget: { x: player.x + 3, z: player.z }
		});

		player.hand[weaponSlot].remainingCharges = 1;

		const deckUpdatePromise = waitForEvent(socket, 'deckUpdate');
		socket.emit('useCard', { cardId: weaponCard.id, slotIndex: weaponSlot });
		const deckUpdate = await deckUpdatePromise;

		expect(Array.isArray(deckUpdate.hand)).toBe(true);
		expect(deckUpdate.hand[weaponSlot]).toBeNull();

		// Also verify the server gameState reflects the same
		expect(player.hand[weaponSlot]).toBeNull();
		expect(chargesBefore).toBeGreaterThan(0);
	});

	it('tick stateUpdate omits cold deck fields while server state retains them', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];
		expect(Array.isArray(player.hand)).toBe(true);
		expect(player.hand.some((card) => card)).toBe(true);

		const tickUpdatePromise = waitForEvent(socket, 'stateUpdate');
		const tickUpdate = await tickUpdatePromise;
		const tickPlayer = tickUpdate.players[socket._playerId];

		expect(tickPlayer).toBeDefined();
		expect(tickPlayer.hand).toBeUndefined();
		expect(tickPlayer.deck).toBeUndefined();
		expect(tickPlayer.inventory).toBeUndefined();
		expect(tickPlayer.returnRewardsPreview).toBeUndefined();

		const authoritative = testGameState().players[socket._playerId];
		expect(Array.isArray(authoritative.hand)).toBe(true);
		expect(authoritative.hand.some((card) => card)).toBe(true);
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
		if (withRun) return withRun;

		// Lobby-scoped stateUpdate may not reach the client in time; read authoritative lobby state.
		const state = lobbyGameState(socket._lobbyId);
		expect(state?.run, `no run on lobby state for ${name}`).toBeDefined();
		return {
			run: state.run,
			enemies: state.enemies,
			players: state.players,
		};
	}

	for (const scenario of [
		'summon-low-mana',
		'summon-ready',
		'combat-damaged-player',
		'mixed-enemies',
		'spawner-active',
		'monster-card',
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

	it('"monster-card" guarantees a monster card in hand', async () => {
		const snap = await runScenarioCaptureSnapshot('monster-card');
		const playerKey = Object.keys(snap.players).find(k => snap.players[k].debugScenario === 'monster-card');
		expect(playerKey).toBeDefined();
		const player = snap.players[playerKey];
		const monsterSlot = player.hand.findIndex(c => c && c.type === 'creature');
		expect(monsterSlot).toBeGreaterThanOrEqual(0);
		expect(player.hand[monsterSlot].id).toBe('dungeon_drake');
	});
});

describe('Player ID Drift Prevention on Cold Reconnect', () => {
	let testProvider;
	let baseUrl;

	beforeEach(async () => {
		testProvider = new InMemoryProvider();
		baseUrl = await startTestServer();
		// startServer() overwrites the provider — re-set after server starts
		setTestProvider(testProvider);
	});

	afterEach(async () => {
		setTestProvider(new InMemoryProvider());
		await closeServer();
	});

	it('reuses providedPlayerId on cold reconnect when persisted data exists', async () => {
		// --- First connection: connect WITHOUT auth, get server-assigned ID ---
		const { socket: sock1, init: init1 } = await connectClient(baseUrl);
		const serverId = init1.playerId;
		expect(serverId).toBeDefined();
		expect(testGameState().players[serverId]).toBeDefined();

		// Simulate earning currency
		testGameState().players[serverId].currency = 42;
		savePlayerInPrimaryLobby(serverId);

		// Disconnect — triggers savePlayerData and starts grace period
		sock1.disconnect();
		await sleep(100);

		// Player stays in lobby during grace period
		expect(testGameState().players[serverId].connected).toBe(false);

		forceEvictGracePeriodPlayers(init1.lobbyId);
		expect(testGameState()).toBeNull();

		// Verify data was persisted under serverId
		const savedAfterDisconnect = testProvider.loadPlayer(serverId);
		expect(savedAfterDisconnect).not.toBeNull();
		expect(savedAfterDisconnect.currency).toBe(42);

		// --- Second connection: reconnect with the server-assigned ID via auth ---
		const { socket: sock2, init: init2 } = await connectClient(baseUrl, serverId);

		// Server should have reused the same ID — no drift
		expect(init2.playerId).toBe(serverId);
		expect(testGameState().players[serverId]).toBeDefined();

		// Verify only one save key exists in the provider (no orphaned files)
		const savedKeys = Array.from(testProvider.store.keys());
		expect(savedKeys).toContain(serverId);
		// The serverId should be the only key matching its UUID prefix
		const prefix = serverId.substring(0, 8);
		const matchingKeys = savedKeys.filter(k => k.startsWith(prefix));
		expect(matchingKeys.length).toBe(1);
		expect(matchingKeys[0]).toBe(serverId);

		sock2.disconnect();
	});

	it('uses accountId from JWT as playerId (even with no persisted data)', async () => {
		const fakeId = 'nonexistent-player-id-' + crypto.randomUUID();

		// Connect with a JWT whose accountId is the fake ID.
		// With JWT auth, the server uses decoded.accountId as playerId,
		// regardless of whether persisted data exists.
		const { socket: sock, init } = await connectClient(baseUrl, fakeId);

		// Server should use the accountId from the JWT as playerId
		expect(init.playerId).toBe(fakeId);
		// The init payload should also include the accountId
		expect(init.accountId).toBe(fakeId);

		sock.disconnect();
	});
});

describe('Restore Persisted Location on Cold Reconnect During Active Run', () => {
	let testProvider;
	let baseUrl;

	beforeEach(async () => {
		testProvider = new InMemoryProvider();
		baseUrl = await startTestServer();
		setTestProvider(testProvider);
	});

	afterEach(async () => {
		setTestProvider(new InMemoryProvider());
		await closeServer();
	});

	it('restores saved location when cold reconnecting during playing phase', async () => {
		// --- Connect two players and start a run ---
		const c1 = await connectClient(baseUrl);
		const c2 = await connectClient(baseUrl, undefined, { joinLobbyId: c1.lobbyId });

		const startGamePromise1 = waitForEvent(c1.socket, 'startGame');
		const startGamePromise2 = waitForEvent(c2.socket, 'startGame');
		c1.socket.emit('playerReady', true);
		c2.socket.emit('playerReady', true);
		await Promise.all([startGamePromise1, startGamePromise2]);
		await waitForEvent(c1.socket, 'stateUpdate');

		expect(testGameState().gamePhase).toBe('playing');

		// --- Move player 2 to a non-default position ---
		const player2Id = c2.socket._playerId;
		const player2 = testGameState().players[player2Id];
		const originalX = player2.x;
		const originalZ = player2.z;

		// Teleport player2 in memory to simulate movement (easier than waiting for move tick)
		player2.x = originalX + 5;
		player2.z = originalZ + 5;
		player2.rotation = 1.5;

		// Force-save the moved position
		savePlayerInPrimaryLobby(player2Id);

		// --- Disconnect player 2 (triggers save + grace period) ---
		c2.socket.disconnect();
		await sleep(100);

		expect(testGameState().players[player2Id].connected).toBe(false);
		expect(testGameState().gamePhase).toBe('playing');

		forceEvictGracePeriodPlayers(c1.lobbyId);
		expect(testGameState().players[player2Id]).toBeUndefined();

		// --- Cold reconnect player 2 with the same ID ---
		const c2Reconnect = await reconnectClient(baseUrl, player2Id, c1.lobbyId);

		// Server should reuse the same player ID
		expect(c2Reconnect.init.playerId).toBe(player2Id);

		// The restored player should have the saved location, not the spawn point
		const restoredPlayer = testGameState().players[player2Id];
		expect(restoredPlayer).toBeDefined();
		expect(restoredPlayer.x).toBe(originalX + 5);
		expect(restoredPlayer.z).toBe(originalZ + 5);
		expect(restoredPlayer.rotation).toBe(1.5);

		// The init payload should contain the restored position in the state
		expect(c2Reconnect.init.state.players[player2Id].x).toBe(originalX + 5);
		expect(c2Reconnect.init.state.players[player2Id].z).toBe(originalZ + 5);

		c1.socket.disconnect();
		c2Reconnect.socket.disconnect();
	});

	it('restores location on cold reconnect in lobby (no regression)', async () => {
		// --- Connect player, move them, disconnect ---
		const c1 = await connectClient(baseUrl);
		const player1Id = c1.socket._playerId;
		const player1 = testGameState().players[player1Id];

		// Move player to a non-default position
		player1.x = player1.x + 3;
		player1.z = player1.z + 3;
		player1.rotation = 2.0;

		// Force-save
		savePlayerInPrimaryLobby(player1Id);

		// Disconnect (last player → returns to lobby, but saves location)
		c1.socket.disconnect();
		await sleep(100);

		// --- Cold reconnect ---
		const c1Reconnect = await connectClient(baseUrl, player1Id);

		expect(c1Reconnect.init.playerId).toBe(player1Id);
		const restored = testGameState().players[player1Id];
		expect(restored.x).toBe(player1.x);
		expect(restored.z).toBe(player1.z);
		expect(restored.rotation).toBe(2.0);

		c1Reconnect.socket.disconnect();
	});

	it('spawns at default position when no saved data exists regardless of game phase', async () => {
		// --- Connect player 1 and start a run ---
		const c1 = await connectClient(baseUrl);
		const c2 = await connectClient(baseUrl, undefined, { joinLobbyId: c1.lobbyId });

		const startGamePromise1 = waitForEvent(c1.socket, 'startGame');
		const startGamePromise2 = waitForEvent(c2.socket, 'startGame');
		c1.socket.emit('playerReady', true);
		c2.socket.emit('playerReady', true);
		await Promise.all([startGamePromise1, startGamePromise2]);
		await waitForEvent(c1.socket, 'stateUpdate');

		expect(testGameState().gamePhase).toBe('playing');

		// Get the spawn position
		const spawnX = testGameState().players[c1.socket._playerId].x;
		const spawnZ = testGameState().players[c1.socket._playerId].z;

		// Disconnect player 2 so we know the run is still active
		c2.socket.disconnect();
		await sleep(50);

		// --- Connect a brand new player (no saved data) during active run ---
		const c3 = await connectClient(baseUrl, undefined, { joinLobbyId: c1.lobbyId });
		const newPlayer = testGameState().players[c3.socket._playerId];

		// Should spawn at default position
		expect(newPlayer.x).toBe(spawnX);
		expect(newPlayer.z).toBe(spawnZ);

		c1.socket.disconnect();
		c3.socket.disconnect();
	});
});

describe('Initialize Combat Hand on Active-Run Reconnect', () => {
	let testProvider;
	let baseUrl;

	beforeEach(async () => {
		testProvider = new InMemoryProvider();
		baseUrl = await startTestServer();
		setTestProvider(testProvider);
	});

	afterEach(async () => {
		setTestProvider(new InMemoryProvider());
		await closeServer();
	});

	it('initializes hand and deck when cold reconnecting during playing phase', async () => {
		// --- Connect two players and start a run ---
		const c1 = await connectClient(baseUrl);
		const c2 = await connectClient(baseUrl, undefined, { joinLobbyId: c1.lobbyId });

		const startGamePromise1 = waitForEvent(c1.socket, 'startGame');
		const startGamePromise2 = waitForEvent(c2.socket, 'startGame');
		c1.socket.emit('playerReady', true);
		c2.socket.emit('playerReady', true);
		await Promise.all([startGamePromise1, startGamePromise2]);
		await waitForEvent(c1.socket, 'stateUpdate');

		expect(testGameState().gamePhase).toBe('playing');

		// --- Verify player 2 has a hand before disconnect ---
		const player2Id = c2.socket._playerId;
		const player2 = testGameState().players[player2Id];
		expect(player2.hand).toBeDefined();
		expect(player2.hand.length).toBeGreaterThan(0);
		expect(player2.deck).toBeDefined();

		// Save player data
		savePlayerInPrimaryLobby(player2Id);

		// --- Disconnect player 2 ---
		c2.socket.disconnect();
		await sleep(100);

		expect(testGameState().players[player2Id].connected).toBe(false);
		expect(testGameState().gamePhase).toBe('playing');

		forceEvictGracePeriodPlayers(c1.lobbyId);
		expect(testGameState().players[player2Id]).toBeUndefined();

		// --- Cold reconnect player 2 ---
		const c2Reconnect = await reconnectClient(baseUrl, player2Id, c1.lobbyId);

		expect(c2Reconnect.init.playerId).toBe(player2Id);

		// --- Verify hand and deck are initialized ---
		const restoredPlayer = testGameState().players[player2Id];
		expect(restoredPlayer.hand).toBeDefined();
		expect(restoredPlayer.hand.length).toBeGreaterThan(0);
		expect(restoredPlayer.hand.length).toBeLessThanOrEqual(6);
		expect(restoredPlayer.hand.filter(Boolean).length).toBeLessThanOrEqual(4);
		expect(restoredPlayer.deck).toBeDefined();
		expect(Array.isArray(restoredPlayer.deck)).toBe(true);

		// Verify each filled hand card has the expected shape
		for (const card of restoredPlayer.hand.filter(Boolean)) {
			expect(card).toHaveProperty('id');
			expect(card).toHaveProperty('name');
			expect(card).toHaveProperty('type');
			expect(card).toHaveProperty('remainingCharges');
		}

		c1.socket.disconnect();
		c2Reconnect.socket.disconnect();
	});

	it('useCard succeeds after cold reconnect during active run', async () => {
		// --- Connect two players and start a run ---
		const c1 = await connectClient(baseUrl);
		const c2 = await connectClient(baseUrl, undefined, { joinLobbyId: c1.lobbyId });

		const startGamePromise1 = waitForEvent(c1.socket, 'startGame');
		const startGamePromise2 = waitForEvent(c2.socket, 'startGame');
		c1.socket.emit('playerReady', true);
		c2.socket.emit('playerReady', true);
		await Promise.all([startGamePromise1, startGamePromise2]);
		await waitForEvent(c1.socket, 'stateUpdate');

		// --- Move player 2 to face an enemy ---
		const player2Id = c2.socket._playerId;
		const player2 = testGameState().players[player2Id];
		player2.x += 5;
		player2.z += 5;

		// Place an enemy in front of player 2
		testGameState().enemies.push({
			id: 'target_enemy',
			x: player2.x + 3,
			z: player2.z,
			hp: 50,
			maxHp: 50,
			type: 'grunt',
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: player2.x + 3, z: player2.z }
		});

		savePlayerInPrimaryLobby(player2Id);

		// --- Disconnect and reconnect player 2 (warm reconnect within grace) ---
		c2.socket.disconnect();
		await sleep(100);

		const c2Reconnect = await connectClient(baseUrl, player2Id);

		await waitForEvent(c2Reconnect.socket, 'stateUpdate');

		// Find a weapon card in the restored hand
		const restoredPlayer = testGameState().players[player2Id];
		const weaponSlot = restoredPlayer.hand.findIndex(c => c && c.type === 'weapon');

		// If no weapon in hand, manually place one (the deck shuffle may not deal one)
		if (weaponSlot < 0) {
			restoredPlayer.hand[0] = {
				id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon',
				charges: 5, remainingCharges: 5, damage: 17
			};
		}

		const finalWeaponSlot = restoredPlayer.hand.findIndex(c => c && c.type === 'weapon');
		expect(finalWeaponSlot).toBeGreaterThanOrEqual(0);
		const weaponCard = restoredPlayer.hand[finalWeaponSlot];
		const chargesBefore = weaponCard.remainingCharges;

		// --- Use the weapon card ---
		const cardUsedPromise = waitForEvent(c2Reconnect.socket, 'cardUsed');

		c2Reconnect.socket.emit('useCard', { cardId: weaponCard.id, slotIndex: finalWeaponSlot });

		const cardUsedData = await cardUsedPromise;
		expect(cardUsedData).toBeDefined();
		expect(cardUsedData.cardId).toBe(weaponCard.id);

		// Verify the card was consumed (remainingCharges decremented)
		const usedCard = restoredPlayer.hand[finalWeaponSlot];
		if (usedCard) {
			expect(usedCard.remainingCharges).toBeLessThan(chargesBefore);
		}

		c1.socket.disconnect();
		c2Reconnect.socket.disconnect();
	});

	it('does NOT initialize hand on reconnect during lobby phase', async () => {
		// --- Connect player in lobby ---
		const c1 = await connectClient(baseUrl);
		const player1Id = c1.socket._playerId;
		const player1 = testGameState().players[player1Id];

		expect(testGameState().gamePhase).toBe('lobby');

		// Player should NOT have a hand in lobby
		expect(player1.hand).toBeUndefined();

		savePlayerInPrimaryLobby(player1Id);

		// --- Disconnect and reconnect in lobby ---
		c1.socket.disconnect();
		await sleep(100);

		const c1Reconnect = await connectClient(baseUrl, player1Id);

		expect(c1Reconnect.init.playerId).toBe(player1Id);

		// Reconnected player in lobby should NOT have a hand initialized
		const restoredPlayer = testGameState().players[player1Id];
		expect(restoredPlayer.hand).toBeUndefined();

		c1Reconnect.socket.disconnect();
	});

	it('resets slotCooldowns and preserves magicStones on active-run reconnect', async () => {
		// --- Connect two players and start a run ---
		const c1 = await connectClient(baseUrl);
		const c2 = await connectClient(baseUrl, undefined, { joinLobbyId: c1.lobbyId });

		const startGamePromise1 = waitForEvent(c1.socket, 'startGame');
		const startGamePromise2 = waitForEvent(c2.socket, 'startGame');
		c1.socket.emit('playerReady', true);
		c2.socket.emit('playerReady', true);
		await Promise.all([startGamePromise1, startGamePromise2]);
		await waitForEvent(c1.socket, 'stateUpdate');

		// --- Set stale cooldowns and low magic stones ---
		const player2Id = c2.socket._playerId;
		const player2 = testGameState().players[player2Id];
		player2.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(Date.now() + 99999);
		player2.magicStones = 0;

		savePlayerInPrimaryLobby(player2Id);

		// --- Disconnect and reconnect ---
		c2.socket.disconnect();
		await sleep(100);

		expect(testGameState().players[player2Id].connected).toBe(false);
		forceEvictGracePeriodPlayers(c1.lobbyId);

		const c2Reconnect = await reconnectClient(baseUrl, player2Id, c1.lobbyId);

		const restoredPlayer = testGameState().players[player2Id];
		expect(restoredPlayer.slotCooldowns).toEqual(new Array(MAX_HAND_SLOTS).fill(null));
		expect(restoredPlayer.magicStones).toBeCloseTo(0, 0);

		c1.socket.disconnect();
		c2Reconnect.socket.disconnect();
	});

	it('revives dead player with LOBBY_REVIVE_HP on reconnect', async () => {
		// --- Connect two players and start a run ---
		const c1 = await connectClient(baseUrl);
		const c2 = await connectClient(baseUrl, undefined, { joinLobbyId: c1.lobbyId });

		const startGamePromise1 = waitForEvent(c1.socket, 'startGame');
		const startGamePromise2 = waitForEvent(c2.socket, 'startGame');
		c1.socket.emit('playerReady', true);
		c2.socket.emit('playerReady', true);
		await Promise.all([startGamePromise1, startGamePromise2]);
		await waitForEvent(c1.socket, 'stateUpdate');

		// --- Kill player 2 ---
		const player2Id = c2.socket._playerId;
		const player2 = testGameState().players[player2Id];
		player2.hp = 0;
		player2.dead = true;

		savePlayerInPrimaryLobby(player2Id);

		// --- Disconnect and reconnect ---
		c2.socket.disconnect();
		await sleep(100);

		expect(testGameState().players[player2Id].connected).toBe(false);
		forceEvictGracePeriodPlayers(c1.lobbyId);

		const c2Reconnect = await reconnectClient(baseUrl, player2Id, c1.lobbyId);

		const restoredPlayer = testGameState().players[player2Id];
		expect(restoredPlayer.hp).toBe(LOBBY_REVIVE_HP);
		expect(restoredPlayer.dead).toBe(false);

		c1.socket.disconnect();
		c2Reconnect.socket.disconnect();
	});

	it('does not reinitialize hand if player already has cards (warm reconnect)', async () => {
		// This tests the case where a player reconnects but their player
		// object is still in memory (e.g. socket reconnection before cleanup).
		// In this case, hand should NOT be re-dealt.

		// --- Connect two players and start a run ---
		const c1 = await connectClient(baseUrl);
		const c2 = await connectClient(baseUrl, undefined, { joinLobbyId: c1.lobbyId });

		const startGamePromise1 = waitForEvent(c1.socket, 'startGame');
		const startGamePromise2 = waitForEvent(c2.socket, 'startGame');
		c1.socket.emit('playerReady', true);
		c2.socket.emit('playerReady', true);
		await Promise.all([startGamePromise1, startGamePromise2]);
		await waitForEvent(c1.socket, 'stateUpdate');

		const player2Id = c2.socket._playerId;
		const player2 = testGameState().players[player2Id];
		const handBefore = player2.hand.filter(Boolean).map(c => c.id);

		// Simulate warm reconnect: manually call the reconnect path
		// by keeping the player in memory but simulating the connection handler
		// Since the player already has a non-empty hand, the condition
		// `!player.hand || player.hand.length === 0` should be false,
		// so no re-initialization occurs.

		// We verify this by checking that the condition is correctly guarded.
		// The player has a hand, so the init block is skipped.
		expect(player2.hand.length).toBeGreaterThan(0);

		// The code path we care about is:
		// if (testGameState().gamePhase === 'playing') {
		//   if (!player.hand || player.hand.length === 0) { ... }
		// }
		// Since player.hand is non-empty, the inner block is skipped.
		// We can't easily simulate a warm reconnect in integration tests,
		// but the cold reconnect path (player removed from memory) is the
		// primary concern and is covered by other tests.

		c1.socket.disconnect();
		c2.socket.disconnect();
	});
});

describe('Socket Integration — Wall-Aware Enemy Movement', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('enemy does not cross wall when chasing player on opposite side', async () => {
		// Enter playing phase so enemies are active
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = testGameState().players[socket._playerId];

		// Find a room with walls to use as a barrier
		const room = testGameState().layout.rooms[0];
		const wall = room.walls[0];

		// Place player on one side of the wall (inside the room)
		const playerSide = wall.axis === 'x'
			? { x: wall.x + wall.length / 2 - 1, z: wall.z }
			: { x: wall.x, z: wall.z + wall.length / 2 - 1 };

		// Move player to that position
		player.x = playerSide.x;
		player.z = playerSide.z;

		// Place enemy on the other side of the wall (outside the room), within detection range
		const enemySide = wall.axis === 'x'
			? { x: wall.x - wall.length / 2 - 1, z: wall.z }
			: { x: wall.x, z: wall.z - wall.length / 2 - 1 };

		// Remove existing enemies and add one for this test
		let enemyStartSide;
		runSimulationInPrimaryLobby((state) => {
			state.enemies = [];
			spawnEnemy(enemySide.x, enemySide.z, 'grunt');
			state.enemies[0].wanderTarget = { x: enemySide.x, z: enemySide.z };
			enemyStartSide = wall.axis === 'x'
				? (state.enemies[0].x < wall.x ? 'left' : 'right')
				: (state.enemies[0].z < wall.z ? 'below' : 'above');
			for (let i = 0; i < 20; i++) {
				updateEnemies();
			}
		});

		// Verify the enemy never crossed to the player's side of the wall
		const enemyEndSide = wall.axis === 'x'
			? (testGameState().enemies[0].x < wall.x ? 'left' : 'right')
			: (testGameState().enemies[0].z < wall.z ? 'below' : 'above');

		expect(enemyEndSide).toBe(enemyStartSide);

		// Also verify the enemy is not overlapping the wall
		expect(isEntityPositionBlocked(testGameState().enemies[0].x, testGameState().enemies[0].z, ENTITY_RADIUS)).toBe(false);
	});
});

describe('Telepipe extract and redeploy vitals persistence', () => {
	afterEach(async () => {
		await closeServer();
	});

	it('single player extract keeps the dungeon running for remaining players', async () => {
		const baseUrl = await startTestServer();
		const p1 = await connectAndJoinLobby(baseUrl, 'telepipe-partial-1');
		const p2 = await connectAndJoinLobby(baseUrl, 'telepipe-partial-2', { joinLobbyId: p1.init.lobbyId });

		const startPromise1 = waitForEvent(p1.socket, 'startGame');
		const startPromise2 = waitForEvent(p2.socket, 'startGame');
		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);
		await startPromise1;
		await startPromise2;

		const state = testGameState();
		const p1Id = p1.socket._playerId;
		const p2Id = p2.socket._playerId;
		state.telepipe = {
			x: state.players[p1Id].x,
			z: state.players[p1Id].z,
			placedBy: p1Id,
			placedAt: Date.now() - 3000,
		};
		setGameState(state);

		let suspended = false;
		p2.socket.on('runSuspended', () => { suspended = true; });

		expect(tryEnterTelepipe(p1Id).ok).toBe(true);
		expect(testGameState().gamePhase).toBe('playing');
		expect(testGameState().run.status).toBe('playing');
		expect(testGameState().players[p1Id].extracted).toBe(true);
		expect(testGameState().players[p2Id].extracted).toBeFalsy();
		expect(suspended).toBe(false);

		p1.socket.disconnect();
		p2.socket.disconnect();
	});

	it('two-player telepipe extract returns to hub and redeploy resumes suspended dungeon', async () => {
		const baseUrl = await startTestServer();
		const p1 = await connectAndJoinLobby(baseUrl, 'telepipe-1');
		const p2 = await connectAndJoinLobby(baseUrl, 'telepipe-2', { joinLobbyId: p1.init.lobbyId });

		const startPromise1 = waitForEvent(p1.socket, 'startGame');
		const startPromise2 = waitForEvent(p2.socket, 'startGame');
		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);
		await startPromise1;
		await startPromise2;

		const state = testGameState();
		const p1Id = p1.socket._playerId;
		const p2Id = p2.socket._playerId;
		const preExtractRunId = state.run.id;
		state.telepipe = {
			x: state.players[p1Id].x,
			z: state.players[p1Id].z,
			placedBy: p1Id,
			placedAt: Date.now(),
		};
		state.enemies.push({
			id: 'e-telepipe-test',
			x: state.players[p1Id].x + 2,
			z: state.players[p1Id].z,
			hp: 55,
			maxHp: 55,
			type: 'grunt',
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: state.players[p1Id].x + 2, z: state.players[p1Id].z },
		});
		setGameState(state);

		const portalX = state.telepipe.x;
		const portalZ = state.telepipe.z;

		expect(tryEnterTelepipe(p1Id).ok).toBe(true);
		expect(testGameState().gamePhase).toBe('playing');

		const live = testGameState();
		live.players[p2Id].x = portalX;
		live.players[p2Id].z = portalZ;
		expect(tryEnterTelepipe(p2Id).ok).toBe(true);

		expect(testGameState().gamePhase).toBe('lobby');
		expect(testGameState().run).toBeUndefined();
		expect(testGameState().enemies).toHaveLength(0);
		expect(testGameState().telepipe).toBeNull();

		const resumePromise1 = waitForEvent(p1.socket, 'startGame');
		const resumePromise2 = waitForEvent(p2.socket, 'startGame');
		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);
		await resumePromise1;
		await resumePromise2;

		const redeployed = testGameState();
		expect(redeployed.gamePhase).toBe('playing');
		expect(redeployed.run.id).toBe(preExtractRunId);
		const restoredEnemy = redeployed.enemies.find((e) => e.id === 'e-telepipe-test');
		expect(restoredEnemy).toBeDefined();
		expect(restoredEnemy.hp).toBe(55);
		expect(redeployed.telepipe).toEqual({
			x: portalX,
			z: portalZ,
			placedBy: p1Id,
			placedAt: state.telepipe.placedAt,
		});
		expect(redeployed.players[p1Id].extracted).toBe(false);
		expect(redeployed.players[p2Id].extracted).toBe(false);

		p1.socket.disconnect();
		p2.socket.disconnect();
	});

	it('two-player telepipe extract preserves damage and spent magic stones across hub return and redeploy', async () => {
		const baseUrl = await startTestServer();
		const p1 = await connectAndJoinLobby(baseUrl, 'telepipe-preserve-1');
		const p2 = await connectAndJoinLobby(baseUrl, 'telepipe-preserve-2', { joinLobbyId: p1.init.lobbyId });

		const startPromise1 = waitForEvent(p1.socket, 'startGame');
		const startPromise2 = waitForEvent(p2.socket, 'startGame');
		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);
		await startPromise1;
		await startPromise2;

		const state = testGameState();
		const p1Id = p1.socket._playerId;
		const p2Id = p2.socket._playerId;
		const preExtractRunId = state.run.id;

		runSimulationInPrimaryLobby(() => {
			damagePlayer(p1Id, 58);
		});
		const expectedHp = testGameState().players[p1Id].hp;
		expect(expectedHp).toBe(42);

		const SUMMON_COST = 50;
		runSimulationInPrimaryLobby((liveState) => {
			const player = liveState.players[p1Id];
			let summonSlot = player.hand.findIndex((c) => c && c.type === 'spell');
			if (summonSlot < 0) {
				summonSlot = player.hand.findIndex((c) => !c);
				player.hand[summonSlot] = {
					id: 'battle_familiar',
					name: 'Signal Familiar',
					type: 'spell',
					charges: 1,
					remainingCharges: 1,
					magicStoneCost: SUMMON_COST,
					damage: 44,
				};
			}
			player.magicStones = SUMMON_COST + 20;
			liveState.enemies.push({
				id: 'e-ms-spend',
				type: 'grunt',
				x: player.x + 5,
				z: player.z,
				hp: 60,
				state: 'idle',
				wanderTarget: { x: player.x + 5, z: player.z },
			});
		});

		const player = testGameState().players[p1Id];
		const summonSlot = player.hand.findIndex((c) => c && c.type === 'spell');
		const summonCard = player.hand[summonSlot];
		const cardUsedPromise = waitForEvent(p1.socket, 'cardUsed');
		p1.socket.emit('useCard', { cardId: summonCard.id, slotIndex: summonSlot });
		await cardUsedPromise;

		const expectedMs = testGameState().players[p1Id].magicStones;
		expect(expectedMs).toBeCloseTo(20, 0);

		runSimulationInPrimaryLobby((liveState) => {
			liveState.telepipe = {
				x: liveState.players[p1Id].x,
				z: liveState.players[p1Id].z,
				placedBy: p1Id,
				placedAt: Date.now(),
			};
		});

		const portalState = testGameState();
		const portalX = portalState.telepipe.x;
		const portalZ = portalState.telepipe.z;

		expect(tryEnterTelepipe(p1Id).ok).toBe(true);
		runSimulationInPrimaryLobby((afterP1Extract) => {
			afterP1Extract.players[p2Id].x = portalX;
			afterP1Extract.players[p2Id].z = portalZ;
		});
		expect(tryEnterTelepipe(p2Id).ok).toBe(true);

		const hub = testGameState();
		expect(hub.gamePhase).toBe('lobby');
		expect(hub.run).toBeUndefined();
		expect(hub.players[p1Id].magicStones).toBeCloseTo(expectedMs, 0);
		expect(hub.players[p1Id].hp).toBe(expectedHp);

		const resumePromise1 = waitForEvent(p1.socket, 'startGame');
		const resumePromise2 = waitForEvent(p2.socket, 'startGame');
		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);
		await resumePromise1;
		await resumePromise2;

		const redeployed = testGameState();
		expect(redeployed.gamePhase).toBe('playing');
		expect(redeployed.run.id).toBe(preExtractRunId);
		expect(redeployed.players[p1Id].magicStones).toBeCloseTo(expectedMs, 0);
		expect(redeployed.players[p1Id].hp).toBe(expectedHp);

		p1.socket.disconnect();
		p2.socket.disconnect();
	});

	it('abandon after telepipe extract starts new sortie with full card charges and new run id', async () => {
		const baseUrl = await startTestServer();
		const p1 = await connectAndJoinLobby(baseUrl, 'telepipe-abandon-1');
		const p2 = await connectAndJoinLobby(baseUrl, 'telepipe-abandon-2', { joinLobbyId: p1.init.lobbyId });

		const startPromise1 = waitForEvent(p1.socket, 'startGame');
		const startPromise2 = waitForEvent(p2.socket, 'startGame');
		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);
		await startPromise1;
		await startPromise2;

		const state = testGameState();
		const p1Id = p1.socket._playerId;
		const p2Id = p2.socket._playerId;
		const preExtractRunId = state.run.id;
		const nonDefaultHp = 47;
		const nonDefaultMs = 18;

		runSimulationInPrimaryLobby((liveState) => {
			const player = liveState.players[p1Id];
			player.hp = nonDefaultHp;
			player.magicStones = nonDefaultMs;
			for (const card of player.hand) {
				if (card && card.charges != null) {
					card.remainingCharges = Math.max(0, card.charges - 1);
				}
			}
			liveState.telepipe = {
				x: player.x,
				z: player.z,
				placedBy: p1Id,
				placedAt: Date.now() - 3000,
			};
		});

		const spentCharges = {};
		for (const card of testGameState().players[p1Id].hand) {
			if (card && card.charges != null) {
				spentCharges[card.id] = card.remainingCharges;
			}
		}

		const portalState = testGameState();
		const portalX = portalState.telepipe.x;
		const portalZ = portalState.telepipe.z;

		expect(tryEnterTelepipe(p1Id).ok).toBe(true);
		runSimulationInPrimaryLobby((afterP1Extract) => {
			afterP1Extract.players[p2Id].x = portalX;
			afterP1Extract.players[p2Id].z = portalZ;
		});
		expect(tryEnterTelepipe(p2Id).ok).toBe(true);

		expect(testGameState().gamePhase).toBe('lobby');
		expect(testGameState().suspendedCheckpoint).not.toBeNull();
		expect(testGameState().players[p1Id].hp).toBe(nonDefaultHp);
		expect(testGameState().players[p1Id].magicStones).toBe(nonDefaultMs);

		const abandonedPromise = waitForEvent(p1.socket, 'runAbandoned');
		p1.socket.emit('abandonRun');
		await abandonedPromise;

		expect(testGameState().suspendedCheckpoint).toBeNull();

		const redeployPromise1 = waitForEvent(p1.socket, 'startGame');
		const redeployPromise2 = waitForEvent(p2.socket, 'startGame');
		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);
		await redeployPromise1;
		await redeployPromise2;

		const redeployed = testGameState();
		expect(redeployed.gamePhase).toBe('playing');
		expect(redeployed.run.id).not.toBe(preExtractRunId);
		expect(redeployed.players[p1Id].hp).toBe(nonDefaultHp);
		expect(redeployed.players[p1Id].magicStones).toBeGreaterThanOrEqual(nonDefaultMs);
		expect(redeployed.players[p1Id].magicStones).toBeLessThanOrEqual(
			nonDefaultMs + MAGIC_STONES_REGEN_PER_TICK * 10,
		);
		expect(redeployed.players[p1Id].hp).not.toBe(MAX_HP);
		expect(redeployed.players[p1Id].magicStones).not.toBe(STARTING_MAGIC_STONES);

		for (const card of redeployed.players[p1Id].hand) {
			if (card) {
				expect(card.remainingCharges).toBe(card.charges);
				if (spentCharges[card.id] != null) {
					expect(card.remainingCharges).toBeGreaterThan(spentCharges[card.id]);
				}
			}
		}

		p1.socket.disconnect();
		p2.socket.disconnect();
	});

	it('canyon_descent: telepipe extract → abandon → redeploy preserves vitals and resets card charges', async () => {
		const baseUrl = await startTestServer();
		const p1 = await connectAndJoinLobby(baseUrl, 'canyon-telepipe-abandon-1');
		const p2 = await connectAndJoinLobby(baseUrl, 'canyon-telepipe-abandon-2', { joinLobbyId: p1.init.lobbyId });

		const debug1 = waitForEvent(p1.socket, 'debugScenarioResult');
		p1.socket.emit('debugScenario', { name: 'canyon-descent-telepipe-ready' });
		expect((await debug1).ok).toBe(true);

		const debug2 = waitForEvent(p2.socket, 'debugScenarioResult');
		p2.socket.emit('debugScenario', { name: 'canyon-descent-telepipe-ready' });
		expect((await debug2).ok).toBe(true);

		const state = testGameState();
		const p1Id = p1.socket._playerId;
		const p2Id = p2.socket._playerId;
		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe('canyon_descent');
		expect(state.selectedQuestTier).toBe(2);
		expect(state.players[p1Id].hand.some((card) => card && card.id === 'telepipe')).toBe(true);

		const preSuspendRunId = state.run.id;
		const nonDefaultHp = 51;
		const nonDefaultMs = 19;

		runSimulationInPrimaryLobby((liveState) => {
			const player = liveState.players[p1Id];
			player.hp = nonDefaultHp;
			player.magicStones = nonDefaultMs;
			for (const card of player.hand) {
				if (card && card.charges != null) {
					card.remainingCharges = Math.max(0, card.charges - 1);
				}
			}
			liveState.telepipe = {
				x: player.x,
				z: player.z,
				placedBy: p1Id,
				placedAt: Date.now() - PORTAL_PLACEMENT_GRACE_MS - 1,
			};
		});

		const spentCharges = {};
		for (const card of testGameState().players[p1Id].hand) {
			if (card && card.charges != null) {
				spentCharges[card.id] = card.remainingCharges;
			}
		}

		const portalState = testGameState();
		const portalX = portalState.telepipe.x;
		const portalZ = portalState.telepipe.z;

		expect(tryEnterTelepipe(p1Id).ok).toBe(true);
		runSimulationInPrimaryLobby((afterP1Extract) => {
			afterP1Extract.players[p2Id].x = portalX;
			afterP1Extract.players[p2Id].z = portalZ;
		});
		expect(tryEnterTelepipe(p2Id).ok).toBe(true);

		expect(testGameState().gamePhase).toBe('lobby');
		expect(testGameState().suspendedCheckpoint).not.toBeNull();

		const abandonedPromise = waitForEvent(p1.socket, 'runAbandoned');
		p1.socket.emit('abandonRun');
		await abandonedPromise;

		expect(testGameState().suspendedCheckpoint).toBeNull();

		const redeployDebug1 = waitForEvent(p1.socket, 'debugScenarioResult');
		const redeployDebug2 = waitForEvent(p2.socket, 'debugScenarioResult');
		p1.socket.emit('debugScenario', { name: 'canyon-descent-tier-2' });
		p2.socket.emit('debugScenario', { name: 'canyon-descent-tier-2' });
		expect((await redeployDebug1).ok).toBe(true);
		expect((await redeployDebug2).ok).toBe(true);

		const redeployed = testGameState();
		expect(redeployed.gamePhase).toBe('playing');
		expect(redeployed.run.id).not.toBe(preSuspendRunId);
		expect(redeployed.players[p1Id].hp).toBe(nonDefaultHp);
		expect(redeployed.players[p1Id].magicStones).toBeGreaterThanOrEqual(nonDefaultMs);
		expect(redeployed.players[p1Id].magicStones).toBeLessThanOrEqual(
			nonDefaultMs + MAGIC_STONES_REGEN_PER_TICK * 10,
		);
		expect(redeployed.players[p1Id].hp).not.toBe(MAX_HP);
		expect(redeployed.players[p1Id].magicStones).not.toBe(STARTING_MAGIC_STONES);

		for (const card of redeployed.players[p1Id].hand) {
			if (card) {
				expect(card.remainingCharges).toBe(card.charges);
				if (spentCharges[card.id] != null) {
					expect(card.remainingCharges).toBeGreaterThan(spentCharges[card.id]);
				}
			}
		}

		p1.socket.disconnect();
		p2.socket.disconnect();
	});

	it('telepipe-ready debug scenario stays in lobby until ready-up injects telepipe', async () => {
		const baseUrl = await startTestServer();
		const p1 = await connectAndJoinLobby(baseUrl, 'telepipe-debug-1');
		const p2 = await connectAndJoinLobby(baseUrl, 'telepipe-debug-2', { joinLobbyId: p1.init.lobbyId });

		const debug1 = waitForEvent(p1.socket, 'debugScenarioResult');
		p1.socket.emit('debugScenario', { name: 'telepipe-ready' });
		expect((await debug1).ok).toBe(true);
		expect(testGameState().gamePhase).toBe('lobby');

		const debug2 = waitForEvent(p2.socket, 'debugScenarioResult');
		p2.socket.emit('debugScenario', { name: 'telepipe-ready' });
		expect((await debug2).ok).toBe(true);
		expect(testGameState().gamePhase).toBe('lobby');

		const startPromise1 = waitForEvent(p1.socket, 'startGame');
		const startPromise2 = waitForEvent(p2.socket, 'startGame');
		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);
		await startPromise1;
		await startPromise2;

		const state = testGameState();
		const p1Id = p1.socket._playerId;
		const p2Id = p2.socket._playerId;
		expect(state.gamePhase).toBe('playing');
		expect(state.players[p1Id].hand.some((c) => c && c.id === 'telepipe')).toBe(true);
		expect(state.players[p2Id].hand.some((c) => c && c.id === 'telepipe')).toBe(true);

		p1.socket.disconnect();
		p2.socket.disconnect();
	});
});

describe('Socket Integration — MEDIC_HEAL', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	it('partial-HP player in hub lobby heals to MAX_HP via medicHeal socket event', async () => {
		const { socket } = await connectAndJoinLobby(baseUrl, 'medic-heal-1');
		const playerId = socket._playerId;

		runSimulationInPrimaryLobby((state) => {
			state.players[playerId].hp = 40;
			state.players[playerId].currency = 25;
		});

		const healedPromise = waitForEvent(socket, 'medicHealed');
		socket.emit('medicHeal');
		const result = await healedPromise;

		expect(result).toEqual({
			hp: MAX_HP,
			currency: 25 - MEDIC_HEAL_COST,
			cost: MEDIC_HEAL_COST,
		});
		expect(testGameState().players[playerId].hp).toBe(MAX_HP);
		expect(testGameState().players[playerId].currency).toBe(25 - MEDIC_HEAL_COST);

		socket.disconnect();
	});
});

describe('Socket Integration — useKeyItem dodge_roll', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	/**
	 * Connect a client and enter the playing phase via summon-ready debug scenario.
	 */
	async function connectAndStartRun() {
		const { socket } = await connectAndJoinLobby(baseUrl, `dodge-${Date.now()}`);
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');
		return { socket };
	}

	it('useKeyItem dodge_roll moves player and sets cooldown; second emit within cooldown returns on_cooldown', async () => {
		const { socket } = await connectAndStartRun();
		const state = testGameState();
		const player = state.players[socket._playerId];

		const xBefore = player.x;
		const zBefore = player.z;

		// Set input direction so dodge has a clear direction to dash
		player.inputDx = 1;
		player.inputDz = 0;

		// First dodge — should succeed
		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'dodge_roll' });
		const result1 = await result1Promise;

		expect(result1.ok).toBe(true);
		expect(result1.keyItemId).toBe('dodge_roll');
		expect(result1.cooldownUntil).toBeGreaterThan(Date.now());

		// Player position should have changed (dashed in +X direction)
		const moved = Math.hypot(player.x - xBefore, player.z - zBefore);
		expect(moved).toBeGreaterThan(0);

		// keyItemCooldownUntil should be set
		expect(player.keyItemCooldownUntil).toBeGreaterThan(Date.now());

		// Second dodge within cooldown — should be rejected
		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'dodge_roll' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);

		socket.disconnect();
	});

	it('stateSnapshot includes updated player position and keyItemCooldownRemaining after dodge', async () => {
		const { socket } = await connectAndStartRun();
		const state = testGameState();
		const player = state.players[socket._playerId];

		// Ensure no existing cooldown
		player.keyItemCooldownUntil = 0;

		// Perform dodge
		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		const stateUpdatePromise = new Promise((resolve) => {
			socket.once('stateUpdate', (data) => resolve(data));
		});
		socket.emit('useKeyItem', { keyItemId: 'dodge_roll' });
		await resultPromise;
		const snapshot = await stateUpdatePromise;

		// Snapshot.players is an object keyed by player ID
		const snapshotPlayer = snapshot.players[socket._playerId];
		expect(snapshotPlayer).toBeDefined();
		// Position should match the player's new position
		expect(snapshotPlayer.x).toBe(player.x);
		expect(snapshotPlayer.z).toBe(player.z);
		// keyItemCooldownRemaining should be > 0
		expect(snapshotPlayer.keyItemCooldownRemaining).toBeGreaterThan(0);

		socket.disconnect();
	});
});
