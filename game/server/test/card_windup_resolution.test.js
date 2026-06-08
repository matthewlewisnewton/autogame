import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	clearAllTimers,
	getCardDef,
	runGameLoopTick,
} from '../index.js';
import {
	isPlayerCardCommitted,
	collectConeHits,
	processPendingCardWindups,
	setGameState as setSimGameState,
} from '../simulation.js';
import { setGameState as setProgressionGameState } from '../progression.js';
import {
	connectClient,
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
} from './helpers.js';

describe('processPendingCardWindups (unit)', () => {
	it('resolves a due weapon wind-up against locked commit origin', async () => {
		const baseUrl = await startTestServer();
		try {
			const { socket } = await connectClient(baseUrl);
			const startGamePromise = waitForEvent(socket, 'startGame');
			socket.emit('playerReady', true);
			await startGamePromise;

			const state = lobbyGameState(socket._lobbyId);
			const player = state.players[socket._playerId];
			state._lobbyId = socket._lobbyId;
			state.gamePhase = 'playing';
			state.run = { status: 'playing' };
			player.x = 0;
			player.z = 0;
			player.rotation = 0;
			player.dead = false;
			player.extracted = false;
			state.enemies = [{
				id: 'windup-target',
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
			player.cardUseState = 'windup';
			player.cardWindupMs = 800;
			player.cardWindupStartTime = Date.now() - 800;
			player.pendingCardUse = {
				cardId: 'magma_greatsword',
				slotIndex: 0,
				rotation: 0,
				originX: 0,
				originZ: 0,
				grind: 0,
			};

			setSimGameState(state, {});
			setProgressionGameState(state);
			expect(collectConeHits(0, 0, 1, 0, 5, Math.PI / 2, 42, { attackerId: socket._playerId }).hits.length).toBe(1);

			processPendingCardWindups();

			expect(state.enemies[0].hp).toBeLessThan(200);
			expect(player.pendingCardUse).toBeUndefined();
			socket.disconnect();
		} finally {
			clearAllTimers();
			await closeServer();
		}
	});
});

describe('card wind-up deferred resolution', () => {
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

	it('magma_greatsword applies damage and CARD_USED only after windUpMs', async () => {
		const { state, player } = await startMagmaWindupScenario();
		const target = () => state.enemies[0];
		const hpBefore = target().hp;
		const windUpMs = getCardDef('magma_greatsword').windUpMs;
		const slotIndex = player.hand.findIndex((c) => c && c.id === 'magma_greatsword');
		expect(slotIndex).toBeGreaterThanOrEqual(0);

		player.x = 0;
		player.z = 0;
		player.rotation = 0;
		target().x = 2;
		target().z = 0;
		target().wanderTarget = { x: target().x, z: target().z };

		const commitUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'magma_greatsword', slotIndex, rotation: 0 });
		await commitUpdatePromise;

		expect(target().hp).toBe(hpBefore);
		expect(isPlayerCardCommitted(player)).toBe(true);

		setSimGameState(state, {});
		setProgressionGameState(state);
		expect(state._lobbyId).toBeDefined();
		// Pin wind-up so the live game loop cannot resolve under us (see key-items echo tests).
		player.cardWindupStartTime = Date.now() + 100000;
		processPendingCardWindups();
		expect(target().hp).toBe(hpBefore);
		expect(player.cardUseState).toBe('windup');

		expect(state.enemies).toHaveLength(1);
		const { originX, originZ } = player.pendingCardUse;
		expect(originX).toBe(0);
		expect(originZ).toBe(0);
		target().x = originX + 2;
		target().z = originZ;

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		player.cardWindupStartTime = Date.now() - windUpMs - 50;
		runGameLoopTick();
		const cardUsedPayload = await cardUsedPromise;

		expect(player.cardUseState).toBeUndefined();
		expect(target().hp).toBeLessThan(hpBefore);
		expect(cardUsedPayload.hits?.length).toBeGreaterThan(0);
		expect(isPlayerCardCommitted(player)).toBe(false);
		expect(player.pendingCardUse).toBeUndefined();
	});

	it('cancels pending resolution when the player dies during wind-up', async () => {
		const { state, player, enemy } = await startMagmaWindupScenario();
		const hpBefore = enemy.hp;
		const windUpMs = getCardDef('magma_greatsword').windUpMs;
		const slotIndex = player.hand.findIndex((c) => c && c.id === 'magma_greatsword');

		await waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'magma_greatsword', slotIndex, rotation: 0 });
		await waitForEvent(socket, 'stateUpdate');

		let cardUsed = false;
		socket.on('cardUsed', () => { cardUsed = true; });

		player.dead = true;
		player.cardWindupStartTime = Date.now() - windUpMs;
		setSimGameState(state, {});
		setProgressionGameState(state);
		processPendingCardWindups();

		expect(cardUsed).toBe(false);
		expect(enemy.hp).toBe(hpBefore);
		expect(player.pendingCardUse).toBeUndefined();
		expect(isPlayerCardCommitted(player)).toBe(false);
	});

	async function startExcaliburWindupScenario() {
		({ socket } = await connectClient(baseUrl));
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'excalibur-windup-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const state = lobbyGameState(socket._lobbyId);
		const player = state.players[socket._playerId];
		const enemy = state.enemies[0];
		return { state, player, enemy };
	}

	it('excalibur_photon enters windup on useCard with no immediate damage or cardUsed', async () => {
		const { state, player } = await startExcaliburWindupScenario();
		const target = () => state.enemies[0];
		const hpBefore = target().hp;
		const perSwingDamage = getCardDef('excalibur_photon').damage;
		expect(perSwingDamage).toBe(14);
		const slotIndex = player.hand.findIndex((c) => c && c.id === 'excalibur_photon');
		expect(slotIndex).toBeGreaterThanOrEqual(0);

		player.x = 0;
		player.z = 0;
		player.rotation = 0;
		target().x = 2;
		target().z = 0;
		target().wanderTarget = { x: target().x, z: target().z };

		let cardUsed = false;
		socket.on('cardUsed', () => { cardUsed = true; });

		const commitUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'excalibur_photon', slotIndex, rotation: 0 });
		await commitUpdatePromise;

		expect(player.cardUseState).toBe('windup');
		expect(player.pendingCardUse?.cardId).toBe('excalibur_photon');
		expect(target().hp).toBe(hpBefore);
		expect(cardUsed).toBe(false);
		expect(isPlayerCardCommitted(player)).toBe(true);
	});

	it('excalibur_photon applies 28 total damage and CARD_USED only after windUpMs', async () => {
		const { state, player } = await startExcaliburWindupScenario();
		const target = () => state.enemies[0];
		const hpBefore = target().hp;
		const cardDef = getCardDef('excalibur_photon');
		const windUpMs = cardDef.windUpMs;
		const perSwingDamage = cardDef.damage;
		const swingsPerUse = cardDef.swingsPerUse;
		expect(perSwingDamage).toBe(14);
		expect(swingsPerUse).toBe(2);
		const slotIndex = player.hand.findIndex((c) => c && c.id === 'excalibur_photon');
		expect(slotIndex).toBeGreaterThanOrEqual(0);

		player.x = 0;
		player.z = 0;
		player.rotation = 0;
		target().x = 2;
		target().z = 0;
		target().wanderTarget = { x: target().x, z: target().z };

		const commitUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'excalibur_photon', slotIndex, rotation: 0 });
		await commitUpdatePromise;

		expect(target().hp).toBe(hpBefore);
		expect(isPlayerCardCommitted(player)).toBe(true);

		setSimGameState(state, {});
		setProgressionGameState(state);
		expect(state._lobbyId).toBeDefined();
		player.cardWindupStartTime = Date.now() + 100000;
		processPendingCardWindups();
		expect(target().hp).toBe(hpBefore);
		expect(player.cardUseState).toBe('windup');

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		player.cardWindupStartTime = Date.now() - windUpMs - 50;
		runGameLoopTick();
		const cardUsedPayload = await cardUsedPromise;

		expect(player.cardUseState).toBeUndefined();
		expect(target().hp).toBe(hpBefore - perSwingDamage * swingsPerUse);
		expect(cardUsedPayload.hits?.length).toBe(swingsPerUse);
		expect(cardUsedPayload.swingCount).toBe(swingsPerUse);
		expect(cardUsedPayload.hits.map((h) => h.swing).sort()).toEqual([1, 2]);
		expect(isPlayerCardCommitted(player)).toBe(false);
		expect(player.pendingCardUse).toBeUndefined();
	});

	it('iron_sword without windUpMs still resolves instantly', async () => {
		({ socket } = await connectClient(baseUrl));
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;

		const state = lobbyGameState(socket._lobbyId);
		const player = state.players[socket._playerId];
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
			id: 'windup-instant-control',
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
});
