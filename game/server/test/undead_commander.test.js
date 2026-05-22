import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import {
	startServer,
	resetGameState,
	gameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	setTestProvider,
	getJWTSecret,
	CARD_DEFS,
	EVOLUTION_TRANSFORMS,
	EVOLUTION_GRIND_REQUIRED,
	createCardInstance,
	evolveCard,
} from '../index.js';
import { InMemoryProvider } from '../providers.js';

function createTestToken(accountId, username) {
	return jwt.sign(
		{ accountId, username: username || accountId },
		getJWTSecret(),
		{ expiresIn: '1h' }
	);
}

async function startTestServer() {
	for (const conn of Object.values(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	if (httpServer.listening) {
		await new Promise((resolve) => httpServer.close(resolve));
	}
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('startTestServer timed out')), 15000);
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

async function closeServer() {
	for (const conn of Object.values(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	if (httpServer.listening) {
		await new Promise((resolve) => httpServer.close(resolve));
	}
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
			auth: { token },
		});
		const timer = setTimeout(() => {
			try { socket.disconnect(); } catch (_) {}
			reject(new Error('connectClient timed out waiting for init'));
		}, 10000);
		socket.on('init', (data) => {
			clearTimeout(timer);
			socket._playerId = data.playerId || data.id;
			resolve({ socket });
		});
		socket.on('connect_error', (e) => {
			clearTimeout(timer);
			reject(e);
		});
	});
}

function waitForEvent(socket, event) {
	return new Promise((resolve) => {
		socket.once(event, resolve);
	});
}

describe('Undead Commander definitions', () => {
	it('defines evolved stats and skeleton summon parameters', () => {
		expect(EVOLUTION_TRANSFORMS.skeleton_knight).toBe('undead_commander');
		expect(CARD_DEFS.undead_commander).toMatchObject({
			id: 'undead_commander',
			type: 'monster',
			minionHp: 180,
			taunt: true,
			summonSkeletonCount: 2,
			summonSkeletonHp: 60,
			isEvolved: true,
			specialEffect: 'summon_skeletons',
		});
	});

	it('evolves Skeleton Knight at +10 grind', () => {
		const player = {
			inventory: [
				createCardInstance('skeleton_knight', {
					instanceId: 'sk-1',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { skeleton_knight: 1 },
			selectedDeck: ['sk-1'],
		};

		const result = evolveCard(player, 'sk-1');

		expect(result.ok).toBe(true);
		expect(result.toCardId).toBe('undead_commander');
		expect(player.inventory[0].cardId).toBe('undead_commander');
		expect(player.inventory[0].isEvolved).toBe(true);
	});
});

describe('Undead Commander gameplay', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('spawns commander plus two smaller skeleton minions when played', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const player = gameState.players[socket._playerId];
		player.deck = [];
		player.hand = [{
			id: 'undead_commander',
			name: 'Undead Commander',
			type: 'monster',
			charges: 1,
			remainingCharges: 1,
		}];

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'undead_commander', slotIndex: 0 });
		const cardUsed = await cardUsedPromise;

		const ownerMinions = gameState.minions.filter(m => m.ownerId === socket._playerId);
		expect(ownerMinions).toHaveLength(3);

		const commander = ownerMinions.find(m => m.type === 'undead_commander');
		expect(commander).toMatchObject({ hp: 180, maxHp: 180, taunt: true });

		const skeletons = ownerMinions.filter(m => m.type === 'skeleton_knight');
		expect(skeletons).toHaveLength(2);
		for (const skeleton of skeletons) {
			expect(skeleton.hp).toBe(60);
			expect(skeleton.maxHp).toBe(60);
			expect(skeleton.taunt).toBeUndefined();
		}

		expect(cardUsed.summonedMinions).toHaveLength(2);
	});
});
