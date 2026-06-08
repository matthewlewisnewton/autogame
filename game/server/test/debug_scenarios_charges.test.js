import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	clearAllTimers,
	CARD_DEFS,
} from '../index.js';
import {
	connectClient,
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
} from './helpers.js';

let socket;
let baseUrl;

describe('debug scenario charges derived from CARD_DEFS', () => {
	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		clearAllTimers();
		await closeServer();
	});

	it('CARD_DEFS exposes reduced charge counts for heavy-hitter cards', () => {
		expect(CARD_DEFS.magma_greatsword.charges).toBe(3);
		expect(CARD_DEFS.flame_blade.charges).toBe(2);
	});

	it('magma-windup-ready injects magma_greatsword with charges from CARD_DEFS', async () => {
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
		const card = player.hand.find((c) => c && c.id === 'magma_greatsword');

		expect(card).toBeDefined();
		expect(card.charges).toBe(CARD_DEFS.magma_greatsword.charges);
		expect(card.remainingCharges).toBe(CARD_DEFS.magma_greatsword.charges);
		expect(card.charges).toBe(3);
	});

	it('flame-blade-windup-ready injects flame_blade with charges from CARD_DEFS', async () => {
		({ socket } = await connectClient(baseUrl));
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'flame-blade-windup-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const state = lobbyGameState(socket._lobbyId);
		const player = state.players[socket._playerId];
		const card = player.hand.find((c) => c && c.id === 'flame_blade');

		expect(card).toBeDefined();
		expect(card.charges).toBe(CARD_DEFS.flame_blade.charges);
		expect(card.remainingCharges).toBe(CARD_DEFS.flame_blade.charges);
		expect(card.charges).toBe(2);
	});
});
