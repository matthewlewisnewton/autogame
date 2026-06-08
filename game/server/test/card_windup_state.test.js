import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	clearAllTimers,
	CARD_DEFS,
	getCardDef,
	gameState,
	hotStateSnapshot,
} from '../index.js';
import {
	isPlayerCardCommitted,
	clearPlayerCardCommitment,
	applyPlayerMovement,
} from '../simulation.js';
import {
	connectClient,
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
	playerForSocket,
} from './helpers.js';

describe('card wind-up definitions', () => {
	it('exposes windUpMs on magma_greatsword via getCardDef', () => {
		expect(CARD_DEFS.magma_greatsword.windUpMs).toBe(800);
		expect(getCardDef('magma_greatsword').windUpMs).toBe(800);
	});

	it('does not define windUpMs on iron_sword', () => {
		expect(getCardDef('iron_sword').windUpMs).toBeUndefined();
	});
});

describe('buildPlayerHotSnapshot commitment fields', () => {
	it('exposes cardUseState, cardWindupUntil, and cardWindupCardId', () => {
		const now = Date.now();
		gameState.players.p1 = {
			x: 0,
			y: 0.5,
			z: 0,
			rotation: 0,
			hp: 100,
			dead: false,
			cardUseState: 'windup',
			cardWindupStartTime: now,
			cardWindupMs: 800,
			pendingCardUse: { cardId: 'magma_greatsword', slotIndex: 0 },
		};
		const hot = hotStateSnapshot().players.p1;
		expect(hot.cardUseState).toBe('windup');
		expect(hot.cardWindupCardId).toBe('magma_greatsword');
		expect(hot.cardWindupUntil).toBe(now + 800);
	});

	it('extends cardWindupUntil while pendingCardUse survives past windUpMs', () => {
		const now = Date.now();
		const originalWindupEnd = now - 900 + 800;
		gameState.players.p1 = {
			x: 0,
			y: 0.5,
			z: 0,
			rotation: 0,
			hp: 100,
			dead: false,
			cardUseState: 'windup',
			cardWindupStartTime: now - 900,
			cardWindupMs: 800,
			pendingCardUse: { cardId: 'magma_greatsword', slotIndex: 0 },
		};
		const snapshotTime = Date.now();
		const hot = hotStateSnapshot().players.p1;
		expect(hot.cardUseState).toBe('windup');
		expect(hot.cardWindupCardId).toBe('magma_greatsword');
		expect(hot.cardWindupUntil).toBeGreaterThan(originalWindupEnd);
		expect(hot.cardWindupUntil).toBeGreaterThanOrEqual(snapshotTime);
	});
});

describe('isPlayerCardCommitted', () => {
	it('returns true during the wind-up window and while pendingCardUse is unresolved', () => {
		const player = {
			cardUseState: 'windup',
			cardWindupStartTime: Date.now(),
			cardWindupMs: 800,
		};
		expect(isPlayerCardCommitted(player)).toBe(true);

		player.cardWindupStartTime = Date.now() - 100;
		expect(isPlayerCardCommitted(player)).toBe(true);

		player.cardWindupStartTime = Date.now() - 800;
		expect(isPlayerCardCommitted(player)).toBe(false);

		player.pendingCardUse = { cardId: 'magma_greatsword', slotIndex: 0 };
		expect(isPlayerCardCommitted(player)).toBe(true);

		player.cardUseState = 'idle';
		expect(isPlayerCardCommitted(player)).toBe(false);
	});
});

describe('card wind-up gameplay', () => {
	let baseUrl;
	let socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		clearAllTimers();
		await closeServer();
	});

	async function startMagmaWindupScenario() {
		({ socket } = await connectClient(baseUrl));
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'magma-windup-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const state = lobbyGameState(socket._lobbyId);
		const player = state.players[socket._playerId];
		const enemy = state.enemies[0];
		return { state, player, enemy };
	}

	it('magma_greatsword enters commitment without CARD_USED or enemy damage', async () => {
		const { state, player, enemy } = await startMagmaWindupScenario();
		const hpBefore = enemy.hp;
		const slotIndex = player.hand.findIndex((c) => c && c.id === 'magma_greatsword');
		expect(slotIndex).toBeGreaterThanOrEqual(0);

		let cardUsed = false;
		socket.on('cardUsed', () => { cardUsed = true; });

		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'magma_greatsword', slotIndex, rotation: 0 });
		await stateUpdatePromise;

		expect(cardUsed).toBe(false);
		expect(enemy.hp).toBe(hpBefore);
		expect(player.cardUseState).toBe('windup');
		expect(player.pendingCardUse).toMatchObject({
			slotIndex,
			cardId: 'magma_greatsword',
		});
		expect(isPlayerCardCommitted(player)).toBe(true);

		expect(player.pendingCardUse?.cardId).toBe('magma_greatsword');
		expect(player.cardWindupStartTime + player.cardWindupMs).toBeGreaterThan(Date.now());
	});

	it('blocks movement and duplicate useCard while committed', async () => {
		const { player, enemy } = await startMagmaWindupScenario();
		const slotIndex = player.hand.findIndex((c) => c && c.id === 'magma_greatsword');
		const startX = player.x;
		const startZ = player.z;

		await waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'magma_greatsword', slotIndex, rotation: 0 });
		await waitForEvent(socket, 'stateUpdate');

		const cardErrorPromise = waitForEvent(socket, 'cardError');
		socket.emit('useCard', { cardId: 'magma_greatsword', slotIndex, rotation: 0 });
		const cardError = await cardErrorPromise;
		expect(cardError.reason).toBe('Card commitment in progress');

		player.inputDx = 1;
		player.inputDz = 0;
		player.inputActive = true;
		player.lastInputTime = Date.now();
		applyPlayerMovement(lobbyGameState(socket._lobbyId));
		expect(player.x).toBe(startX);
		expect(player.z).toBe(startZ);
		expect(enemy.hp).toBe(200);
	});

	it('iron_sword without windUpMs still resolves instantly', async () => {
		({ socket } = await connectClient(baseUrl));
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;

		const player = playerForSocket(socket);
		const state = lobbyGameState(socket._lobbyId);
		player.x = 0;
		player.z = 0;
		player.rotation = 0;
		player.slotCooldowns = new Array(player.hand.length).fill(null);
		player.hand[0] = {
			id: 'iron_sword',
			name: 'Rust-Forged Saber',
			type: 'weapon',
			charges: 5,
			remainingCharges: 5,
		};
		state.enemies = [{
			id: 'windup-control',
			type: 'grunt',
			x: 2,
			z: 0,
			y: 0.5,
			hp: 200,
			maxHp: 200,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 2, z: 0 },
		}];

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'iron_sword', slotIndex: 0, rotation: 0 });
		await cardUsedPromise;

		expect(player.cardUseState).toBeUndefined();
		expect(state.enemies[0].hp).toBeLessThan(200);
	});

	it('clears commitment on player death', () => {
		const player = {
			cardUseState: 'windup',
			cardWindupStartTime: Date.now(),
			cardWindupMs: 800,
			pendingCardUse: { cardId: 'magma_greatsword', slotIndex: 0 },
		};
		clearPlayerCardCommitment(player);
		expect(isPlayerCardCommitted(player)).toBe(false);
		expect(player.pendingCardUse).toBeUndefined();
	});
});
