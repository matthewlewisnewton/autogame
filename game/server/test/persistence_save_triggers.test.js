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
	spawnLoot
} from '../index.js';
import { InMemoryProvider } from '../providers.js';

// ── Helpers ──

function createTestToken(accountId, username) {
	return jwt.sign(
		{ accountId, username: username || accountId },
		getJWTSecret(),
		{ expiresIn: '1h' }
	);
}

async function startTestServer() {
	for (const [id, conn] of Object.entries(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	if (httpServer.listening) {
		await new Promise((resolve, reject) => {
			const t = setTimeout(() => {
				try { serverIo.close(); } catch (_) {}
				httpServer.close(resolve);
			}, 5000);
			httpServer.close(() => { clearTimeout(t); resolve(); });
		});
	}

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('startTestServer: timed out')), 15000);
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

function connectClient(baseUrl) {
	const accountId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const token = createTestToken(accountId);

	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			auth: { token }
		});

		const timer = setTimeout(() => {
			try { socket.disconnect(); } catch (_) {}
			reject(new Error('connectClient: timed out'));
		}, 10000);

		socket.on('init', (data) => {
			clearTimeout(timer);
			socket._playerId = data.playerId || data.id;
			resolve({ socket, init: data });
		});
		socket.on('connect_error', (e) => {
			clearTimeout(timer);
			reject(e);
		});
	});
}

function waitForEvent(socket, event, timeout = 3000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeout);
		socket.once(event, (data) => {
			clearTimeout(timer);
			resolve(data);
		});
	});
}

function sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

async function closeServer() {
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

// ── Tests ──

describe('savePlayerData triggers on state-changing handlers', () => {
	let baseUrl;
	let testProvider;

	beforeEach(async () => {
		testProvider = new InMemoryProvider();
		baseUrl = await startTestServer();
		// startServer() may overwrite provider — re-set after
		setTestProvider(testProvider);
	});

	afterEach(async () => {
		setTestProvider(null);
		await closeServer();
	});

	it('move handler calls savePlayerData after a successful position update', async () => {
		const { socket } = await connectClient(baseUrl);

		// Enter playing phase via debug scenario
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket._playerId];
		const xBefore = player.x;

		// Spy on the provider's savePlayer to verify savePlayerData is called
		// (savePlayerData delegates to provider.savePlayer internally)
		const savePlayerSpy = vi.spyOn(testProvider, 'savePlayer');

		// Emit a move
		socket.emit('move', { dx: 1, dz: 0, rotation: 0 });
		await sleep(50);

		// Position should have changed
		expect(player.x).not.toBe(xBefore);

		// savePlayer should have been called at least once (the move handler
		// calls savePlayerData which delegates to provider.savePlayer)
		expect(savePlayerSpy).toHaveBeenCalled();

		// Verify the saved data reflects the new position
		const savedKey = gameState.players[socket._playerId]?.accountId || socket._playerId;
		const saved = testProvider.loadPlayer(savedKey);
		expect(saved).not.toBeNull();
		expect(saved.x).toBeCloseTo(player.x, 4);

		savePlayerSpy.mockRestore();
		socket.disconnect();
	});

	it('lootPickup handler calls savePlayerData after currency is incremented', async () => {
		const { socket } = await connectClient(baseUrl);

		// Enter playing phase
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket._playerId];
		const currencyBefore = player.currency;

		// Place a loot item near the player
		const lootValue = 15;
		gameState.loot.push({
			id: 'loot_save_test',
			x: player.x,
			z: player.z,
			value: lootValue,
			createdAt: Date.now()
		});

		// Spy on provider.savePlayer
		const savePlayerSpy = vi.spyOn(testProvider, 'savePlayer');

		// Pick up the loot
		socket.emit('lootPickup', { lootId: 'loot_save_test' });
		await sleep(50);

		// Verify currency was incremented
		expect(player.currency).toBe(currencyBefore + lootValue);

		// Verify savePlayer was called
		expect(savePlayerSpy).toHaveBeenCalled();

		// Verify the saved data reflects the new currency
		const savedKey = gameState.players[socket._playerId]?.accountId || socket._playerId;
		const saved = testProvider.loadPlayer(savedKey);
		expect(saved).not.toBeNull();
		expect(saved.currency).toBe(currencyBefore + lootValue);

		savePlayerSpy.mockRestore();
		socket.disconnect();
	});

	it('deckAddCard handler calls savePlayerData after a card is added to the deck', async () => {
		const { socket } = await connectClient(baseUrl);

		const player = gameState.players[socket._playerId];
		const deckBefore = [...player.selectedDeck];

		// The starting deck is at DECK_MAX_SIZE (8), so remove a card first to make room
		const removePromise = waitForEvent(socket, 'deckUpdate');
		socket.emit('deckRemoveCard', { cardId: 'dungeon_drake' });
		await removePromise;

		// Spy on provider.savePlayer (after the remove, so we only count the add)
		const savePlayerSpy = vi.spyOn(testProvider, 'savePlayer');

		// Add a card back to the deck (in lobby phase)
		const deckUpdatePromise = waitForEvent(socket, 'deckUpdate');
		socket.emit('deckAddCard', { cardId: 'dungeon_drake' });
		await deckUpdatePromise;

		// Deck should be back to original size
		expect(player.selectedDeck.length).toBe(deckBefore.length);

		// Verify savePlayer was called
		expect(savePlayerSpy).toHaveBeenCalled();

		// Verify the saved data reflects the updated deck
		const savedKey = gameState.players[socket._playerId]?.accountId || socket._playerId;
		const saved = testProvider.loadPlayer(savedKey);
		expect(saved).not.toBeNull();
		expect(saved.selectedDeck.length).toBe(deckBefore.length);

		savePlayerSpy.mockRestore();
		socket.disconnect();
	});

	it('deckRemoveCard handler calls savePlayerData after a card is removed from the deck', async () => {
		const { socket } = await connectClient(baseUrl);

		const player = gameState.players[socket._playerId];
		const deckBefore = [...player.selectedDeck];

		// Spy on provider.savePlayer
		const savePlayerSpy = vi.spyOn(testProvider, 'savePlayer');

		// Remove a card from the deck (in lobby phase)
		const deckUpdatePromise = waitForEvent(socket, 'deckUpdate');
		socket.emit('deckRemoveCard', { cardId: 'iron_sword' });
		await deckUpdatePromise;

		// Deck should have shrunk
		expect(player.selectedDeck.length).toBe(deckBefore.length - 1);

		// Verify savePlayer was called
		expect(savePlayerSpy).toHaveBeenCalled();

		// Verify the saved data reflects the updated deck
		const savedKey = gameState.players[socket._playerId]?.accountId || socket._playerId;
		const saved = testProvider.loadPlayer(savedKey);
		expect(saved).not.toBeNull();
		expect(saved.selectedDeck.length).toBe(deckBefore.length - 1);

		savePlayerSpy.mockRestore();
		socket.disconnect();
	});
});
