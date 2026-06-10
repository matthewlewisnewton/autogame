import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	clearAllTimers,
	getCardDef,
	tryEnterTelepipe,
} from '../index.js';
import {
	isPlayerCardCommitted,
	applyPlayerMovement,
} from '../simulation.js';
import { MAX_MAGIC_STONES } from '../config.js';
import {
	connectClient,
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
	testGameState,
} from './helpers.js';

describe('card wind-up backward compatibility', () => {
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

	async function connectAndStartRun() {
		({ socket } = await connectClient(baseUrl));
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		return lobbyGameState(socket._lobbyId);
	}

	function setupInstantCardScenario(card) {
		const state = lobbyGameState(socket._lobbyId);
		const player = state.players[socket._playerId];
		player.rotation = 0;
		player.magicStones = MAX_MAGIC_STONES;
		player.slotCooldowns = new Array(player.hand.length).fill(null);
		player.hand[0] = card;
		const targetX = player.x + 2;
		const targetZ = player.z;
		state.enemies = [{
			id: 'regression-target',
			type: 'grunt',
			x: targetX,
			z: targetZ,
			y: 0.5,
			hp: 200,
			maxHp: 200,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: targetX, z: targetZ },
		}];
		return { state, player, enemy: state.enemies[0] };
	}

	async function expectInstantCardUse(cardId, setupCard, assertEffect) {
		await connectAndStartRun();
		const { state, player, enemy } = setupInstantCardScenario(setupCard);
		const hpBefore = enemy.hp;

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId, slotIndex: 0, rotation: 0 });
		const cardUsed = await cardUsedPromise;

		expect(cardUsed.cardId).toBe(cardId);
		expect(player.cardUseState).toBeUndefined();
		expect(player.pendingCardUse).toBeUndefined();
		expect(isPlayerCardCommitted(player)).toBe(false);
		assertEffect({ state, player, enemy, hpBefore, cardUsed });

		// Movement is blocked only while isPlayerCardCommitted; instant cards must stay mobile.
		player.inputDx = 1;
		player.inputDz = 0;
		player.inputActive = true;
		player.lastInputTime = Date.now();
		const xBefore = player.x;
		applyPlayerMovement(lobbyGameState(socket._lobbyId));
		expect(isPlayerCardCommitted(player)).toBe(false);
		expect(player.x).not.toBe(xBefore);
	}

	it('iron_sword resolves instantly with immediate damage and no commitment', async () => {
		await expectInstantCardUse('iron_sword', {
			id: 'iron_sword',
			name: 'Rust-Forged Saber',
			type: 'weapon',
			charges: 5,
			remainingCharges: 5,
		}, ({ enemy, hpBefore, cardUsed }) => {
			expect(enemy.hp).toBeLessThan(hpBefore);
			expect(cardUsed.hits?.length).toBeGreaterThan(0);
		});
	});

	it('frost_nova resolves instantly with immediate area damage and no commitment', async () => {
		await expectInstantCardUse('frost_nova', {
			id: 'frost_nova',
			name: 'Cryo Burst',
			type: 'spell',
			charges: 1,
			remainingCharges: 1,
			magicStoneCost: 35,
		}, ({ enemy, hpBefore }) => {
			expect(enemy.hp).toBeLessThan(hpBefore);
		});
	});

	it('skeleton_knight resolves instantly, spawns a minion, and does not commit', async () => {
		await connectAndStartRun();
		const { state, player } = setupInstantCardScenario({
			id: 'skeleton_knight',
			name: 'Necroframe Knight',
			type: 'creature',
			charges: 1,
			remainingCharges: 1,
		});
		const minionsBefore = state.minions.length;

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'skeleton_knight', slotIndex: 0, rotation: 0 });
		await cardUsedPromise;

		expect(player.cardUseState).toBeUndefined();
		expect(player.pendingCardUse).toBeUndefined();
		expect(state.minions.length).toBe(minionsBefore + 1);
		expect(state.minions.some((m) => m.ownerId === socket._playerId)).toBe(true);
	});

	it('exposes windUpMs on exemplar cards without affecting instant cards', () => {
		expect(getCardDef('steel_claymore').windUpMs).toBe(600);
		expect(getCardDef('flame_blade').windUpMs).toBe(650);
		expect(getCardDef('magma_greatsword').windUpMs).toBe(800);
		expect(getCardDef('soul_drain').windUpMs).toBe(700);
		expect(getCardDef('excalibur_photon').windUpMs).toBe(600);
		expect(getCardDef('glacier_collapse').windUpMs).toBe(700);
		expect(getCardDef('dungeon_drake').windUpMs).toBe(600);
		expect(getCardDef('spike_trap').windUpMs).toBe(500);
		expect(getCardDef('iron_sword').windUpMs).toBeUndefined();
		expect(getCardDef('frost_nova').windUpMs).toBeUndefined();
		expect(getCardDef('skeleton_knight').windUpMs).toBeUndefined();
	});
});

describe('card wind-up suspend cleanup', () => {
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

	it('clears commitment on telepipe suspend and does not restore it on resume', async () => {
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
		const slotIndex = player.hand.findIndex((c) => c && c.id === 'magma_greatsword');
		expect(slotIndex).toBeGreaterThanOrEqual(0);

		const commitUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'magma_greatsword', slotIndex, rotation: 0 });
		await commitUpdatePromise;

		expect(isPlayerCardCommitted(player)).toBe(true);
		expect(player.pendingCardUse?.cardId).toBe('magma_greatsword');

		const liveState = testGameState();
		const livePlayer = liveState.players[socket._playerId];
		liveState.telepipe = {
			x: livePlayer.x,
			z: livePlayer.z,
			placedBy: socket._playerId,
			placedAt: Date.now(),
		}; 

		const suspendedPromise = waitForEvent(socket, 'runSuspended');
		expect(tryEnterTelepipe(liveState, socket._playerId).ok).toBe(true);
		await suspendedPromise;

		const hubState = testGameState();
		const hubPlayer = hubState.players[socket._playerId];
		expect(hubState.gamePhase).toBe('lobby');
		expect(hubPlayer.cardUseState).toBeUndefined();
		expect(hubPlayer.pendingCardUse).toBeUndefined();
		expect(isPlayerCardCommitted(hubPlayer)).toBe(false);

		const checkpoint = hubState.suspendedCheckpoint;
		expect(checkpoint).not.toBeNull();
		const savedPlayer = checkpoint.playerStates[socket._playerId];
		expect(savedPlayer.cardUseState).toBeUndefined();
		expect(savedPlayer.pendingCardUse).toBeUndefined();

		const resumePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await resumePromise;

		const resumed = testGameState();
		const resumedPlayer = resumed.players[socket._playerId];
		expect(resumed.gamePhase).toBe('playing');
		expect(resumedPlayer.cardUseState).toBeUndefined();
		expect(resumedPlayer.pendingCardUse).toBeUndefined();
		expect(isPlayerCardCommitted(resumedPlayer)).toBe(false);
	});
});
