import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	clearAllTimers,
	getCardDef,
	runGameLoopTick,
} from '../index.js';
import {
	isPlayerCardCommitted,
	applyPlayerMovement,
	buildMovementContext,
	processPendingCardWindups,
  setGameState as setSimGameState,
} from '../simulation.js';
import { MAX_MAGIC_STONES } from '../config.js';
import {
	connectClient,
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
} from './helpers.js';

describe('card wind-up input lock until resolution', () => {
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
		return { state, player };
	}

	it('keeps movement and useCard blocked after windUpMs until processPendingCardWindups', async () => {
		const { state, player } = await startMagmaWindupScenario();
		const windUpMs = getCardDef('magma_greatsword').windUpMs;
		const slotIndex = player.hand.findIndex((c) => c && c.id === 'magma_greatsword');
		expect(slotIndex).toBeGreaterThanOrEqual(0);

		const startX = player.x;
		const startZ = player.z;

		await waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'magma_greatsword', slotIndex, rotation: 0 });
		await waitForEvent(socket, 'stateUpdate');

		player.cardWindupStartTime = Date.now() - windUpMs - 50;
		setSimGameState(state, {});

		expect(isPlayerCardCommitted(player)).toBe(true);
		expect(player.pendingCardUse?.cardId).toBe('magma_greatsword');

		player.inputDx = 1;
		player.inputDz = 0;
		player.inputActive = true;
		player.lastInputTime = Date.now();
		applyPlayerMovement(state, buildMovementContext(state));
		expect(player.x).toBe(startX);
		expect(player.z).toBe(startZ);

		const cardErrorPromise = waitForEvent(socket, 'cardError');
		socket.emit('useCard', { cardId: 'magma_greatsword', slotIndex, rotation: 0 });
		const cardError = await cardErrorPromise;
		expect(cardError.reason).toBe('Card commitment in progress');

		processPendingCardWindups();

		expect(isPlayerCardCommitted(player)).toBe(false);
		expect(player.pendingCardUse).toBeUndefined();

		player.inputDx = 1;
		player.inputDz = 0;
		player.inputActive = true;
		player.lastInputTime = Date.now();
		applyPlayerMovement(state, buildMovementContext(state));
		expect(player.x).not.toBe(startX);

		const freeSlot = player.hand.findIndex((c) => c === null);
		expect(freeSlot).toBeGreaterThanOrEqual(0);
		player.hand[freeSlot] = {
			id: 'iron_sword',
			name: 'Rust-Forged Saber',
			type: 'weapon',
			charges: 5,
			remainingCharges: 5,
		};
		player.slotCooldowns[freeSlot] = null;

		const cardErrors = [];
		socket.on('cardError', (payload) => cardErrors.push(payload.reason));

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'iron_sword', slotIndex: freeSlot, rotation: 0 });
		await cardUsedPromise;
		expect(cardErrors).not.toContain('Card commitment in progress');
	});

	it('rejects useKeyItem while card-committed and allows dodge after wind-up resolves', async () => {
		const { state, player } = await startMagmaWindupScenario();
		const windUpMs = getCardDef('magma_greatsword').windUpMs;
		const slotIndex = player.hand.findIndex((c) => c && c.id === 'magma_greatsword');
		expect(slotIndex).toBeGreaterThanOrEqual(0);

		const startX = player.x;
		const startZ = player.z;
		const cooldownBefore = player.keyItemCooldownUntil || 0;
		const invulnBefore = player.invulnerableUntil || 0;

		player.inputDx = 1;
		player.inputDz = 0;

		await waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'magma_greatsword', slotIndex, rotation: 0 });
		await waitForEvent(socket, 'stateUpdate');

		player.cardWindupStartTime = Date.now() - windUpMs - 50;
		setSimGameState(state, {});

		expect(isPlayerCardCommitted(player)).toBe(true);

		const dodgeRejectPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'dodge_roll' });
		const dodgeReject = await dodgeRejectPromise;
		expect(dodgeReject.ok).toBe(false);
		expect(dodgeReject.reason).toBe('card_commitment');
		expect(player.x).toBe(startX);
		expect(player.z).toBe(startZ);
		expect(player.keyItemCooldownUntil || 0).toBe(cooldownBefore);
		expect(player.invulnerableUntil || 0).toBe(invulnBefore);

		const blockingBefore = player.blockingUntil || 0;
		const guardRejectPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'guard_block' });
		const guardReject = await guardRejectPromise;
		expect(guardReject.ok).toBe(false);
		expect(guardReject.reason).toBe('card_commitment');
		expect(player.blockingUntil || 0).toBe(blockingBefore);

		processPendingCardWindups();
		expect(isPlayerCardCommitted(player)).toBe(false);

		player.keyItemCooldownUntil = 0;
		player.inputDx = 1;
		player.inputDz = 0;

		const dodgeOkPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'dodge_roll' });
		const dodgeOk = await dodgeOkPromise;
		expect(dodgeOk.ok).toBe(true);
		expect(dodgeOk.keyItemId).toBe('dodge_roll');
		expect(Math.hypot(player.x - startX, player.z - startZ)).toBeGreaterThan(0);
		expect(player.keyItemCooldownUntil).toBeGreaterThan(Date.now());
	});

	it('rejects discardCard while committed and resolves dungeon_drake minion after wind-up', async () => {
		({ socket } = await connectClient(baseUrl));
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;

		const state = lobbyGameState(socket._lobbyId);
		const player = state.players[socket._playerId];
		const windUpMs = getCardDef('dungeon_drake').windUpMs;
		const slotIndex = 0;

		player.rotation = 0;
		player.magicStones = MAX_MAGIC_STONES;
		player.slotCooldowns = new Array(player.hand.length).fill(null);
		player.hand[slotIndex] = {
			id: 'dungeon_drake',
			name: 'Vault Wyrm',
			type: 'creature',
			charges: 1,
			remainingCharges: 1,
		};
		state.enemies = [];
		state.enchantments = state.enchantments || [];
		state.minions = state.minions || [];

		await waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'dungeon_drake', slotIndex, rotation: 0 });
		await waitForEvent(socket, 'stateUpdate');

		expect(isPlayerCardCommitted(player)).toBe(true);
		expect(player.hand[slotIndex].id).toBe('dungeon_drake');
		const pendingAtCommit = player.pendingCardUse
			? { ...player.pendingCardUse }
			: undefined;
		expect(pendingAtCommit?.cardId).toBe('dungeon_drake');

		player.cardWindupStartTime = Date.now() - windUpMs - 50;
		setSimGameState(state, {});

		expect(isPlayerCardCommitted(player)).toBe(true);
		expect(player.pendingCardUse?.cardId).toBe('dungeon_drake');

		const nextDrawAtBefore = player.nextDrawAt;

		const cardErrorPromise = waitForEvent(socket, 'cardError');
		socket.emit('discardCard', { slotIndex, cardId: 'dungeon_drake' });
		const cardError = await cardErrorPromise;
		expect(cardError.reason).toBe('Card commitment in progress');

		expect(player.hand[slotIndex].id).toBe('dungeon_drake');
		expect(player.pendingCardUse?.cardId).toBe(pendingAtCommit?.cardId);
		expect(player.pendingCardUse?.slotIndex).toBe(pendingAtCommit?.slotIndex);
		expect(state.minions.length).toBe(0);
		expect(player.nextDrawAt).toBe(nextDrawAtBefore);

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		processPendingCardWindups();
		runGameLoopTick();
		const cardUsedPayload = await cardUsedPromise;

		expect(isPlayerCardCommitted(player)).toBe(false);
		expect(player.pendingCardUse).toBeUndefined();
		expect(state.minions.length).toBe(1);
		expect(state.minions[0].ownerId).toBe(socket._playerId);
		expect(cardUsedPayload.minionId).toBe(state.minions[0].id);
		expect(player.hand[slotIndex].activeMinionId).toBe(state.minions[0].id);
		expect(player.hand[slotIndex].remainingCharges).toBe(0);

		const freeSlot = player.hand.findIndex((c) => c === null);
		expect(freeSlot).toBeGreaterThanOrEqual(0);
		player.hand[freeSlot] = {
			id: 'iron_sword',
			name: 'Rust-Forged Saber',
			type: 'weapon',
			charges: 5,
			remainingCharges: 5,
		};

		const cardErrors = [];
		socket.on('cardError', (payload) => cardErrors.push(payload.reason));

		const discardUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('discardCard', { slotIndex: freeSlot, cardId: 'iron_sword' });
		await discardUpdatePromise;
		expect(cardErrors).not.toContain('Card commitment in progress');
		expect(player.hand[freeSlot]).toBeNull();
	});
});
