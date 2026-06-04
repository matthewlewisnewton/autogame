import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import {
	startServer,
	resetGameState,
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
import { connectClient, waitForEvent, lobbyStateForSocket, playerForSocket } from './helpers.js';

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

describe('Legion Marshal definitions', () => {
	it('defines evolved stats and skeleton summon parameters', () => {
		expect(EVOLUTION_TRANSFORMS.skeleton_knight).toBe('undead_commander');
		expect(CARD_DEFS.undead_commander).toMatchObject({
			id: 'undead_commander',
			type: 'creature',
			minionHp: 180,
			taunt: true,
			summonSkeletonCount: 2,
			summonSkeletonHp: 60,
			isEvolved: true,
			specialEffect: 'summon_skeletons',
		});
	});

	it('evolves Necroframe Knight at +10 grind', () => {
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

describe('Legion Marshal gameplay', () => {
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

		const player = playerForSocket(socket);
		player.deck = [];
		player.hand = [{
			id: 'undead_commander',
			name: 'Legion Marshal',
			type: 'creature',
			charges: 1,
			remainingCharges: 1,
		}];

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'undead_commander', slotIndex: 0 });
		const cardUsed = await cardUsedPromise;

		const state = lobbyStateForSocket(socket);
		const ownerMinions = state.minions.filter(m => m.ownerId === socket._playerId);
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

describe('evolution-ready debug scenario', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
	});

	it('provisions a skeleton_knight at +10 grind and evolves it to undead_commander', async () => {
		// Apply the evolution-ready debug scenario
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'evolution-ready' });
		const debugResult = await debugResultPromise;

		// Verify the scenario result
		expect(debugResult.ok).toBe(true);
		expect(debugResult.scenario).toBe('evolution-ready');

		// Read player state to verify the +10 skeleton_knight instance
		const player = playerForSocket(socket);
		expect(player).toBeDefined();

		const skInstance = player.inventory.find(
			(inst) => inst.cardId === 'skeleton_knight' && inst.grind === 10
		);
		expect(skInstance).toBeDefined();
		expect(skInstance.instanceId).toBeDefined();

		// Verify the instance is in the selected deck
		expect(player.selectedDeck).toContain(skInstance.instanceId);

		// Verify the game phase is lobby (not playing)
		const state = lobbyStateForSocket(socket);
		expect(state.gamePhase).toBe('lobby');

		// Evolve the card
		const evolveResult = evolveCard(player, skInstance.instanceId);
		expect(evolveResult.ok).toBe(true);
		expect(evolveResult.toCardId).toBe('undead_commander');
		expect(evolveResult.fromCardId).toBe('skeleton_knight');

		// Verify the transformed instance
		const evolvedInstance = player.inventory.find(
			(inst) => inst.instanceId === skInstance.instanceId
		);
		expect(evolvedInstance.cardId).toBe('undead_commander');
		expect(evolvedInstance.isEvolved).toBe(true);
		expect(evolvedInstance.grind).toBe(0);
		expect(evolvedInstance.evolvedFrom).toBe('skeleton_knight');
	});
});
