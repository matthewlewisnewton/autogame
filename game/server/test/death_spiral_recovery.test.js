import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	startTestServer,
	closeServer,
	connectTwoClients,
	waitForEvent,
	testGameState,
} from './helpers.js';
import { MAX_HP, LOBBY_REVIVE_HP } from '../config.js';
import { ENEMY_DEFS } from '../index.js';

describe('Death spiral recovery regression', () => {
	let baseUrl;
	let socket1;
	let socket2;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		const connected = await connectTwoClients(baseUrl);
		socket1 = connected.socketA;
		socket2 = connected.socketB;
	});

	afterEach(async () => {
		if (socket1?.connected) socket1.disconnect();
		if (socket2?.connected) socket2.disconnect();
		await closeServer();
	});

	it('lobby revive HP survives at least two Initiate Vault grunt hits', () => {
		expect(LOBBY_REVIVE_HP).toBeGreaterThanOrEqual(2 * ENEMY_DEFS.grunt.attackDamage);
	});

	it('0-currency death → lobby revive → charity medic → redeploy', async () => {
		const player1 = testGameState().players[socket1._playerId];
		expect(player1.currency).toBe(0);

		const startGame1 = waitForEvent(socket1, 'startGame');
		const startGame2 = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1, startGame2]);
		await waitForEvent(socket1, 'stateUpdate');

		const runFailedPromise = waitForEvent(socket1, 'runFailed');
		const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
		socket1.emit('debugScenario', { name: 'run-failed' });
		await runFailedPromise;
		const debugResult = await debugResultPromise;
		expect(debugResult.ok).toBe(true);
		expect(testGameState().run.status).toBe('failed');

		await waitForEvent(socket1, 'stateUpdate');

		const stateUpdatePromise = waitForEvent(socket1, 'stateUpdate');
		socket1.emit('returnToLobby');
		await stateUpdatePromise;

		expect(testGameState().gamePhase).toBe('lobby');
		expect(player1.hp).toBe(LOBBY_REVIVE_HP);
		expect(player1.dead).toBe(false);
		expect(player1.currency).toBe(0);

		const healedPromise = waitForEvent(socket1, 'medicHealed');
		socket1.emit('medicHeal');
		const healed = await healedPromise;

		expect(healed).toEqual({
			hp: MAX_HP,
			currency: 0,
			cost: 0,
		});
		expect(testGameState().players[socket1._playerId].hp).toBe(MAX_HP);
		expect(testGameState().players[socket1._playerId].currency).toBe(0);

		const startGame1b = waitForEvent(socket1, 'startGame');
		const startGame2b = waitForEvent(socket2, 'startGame');
		socket1.emit('playerReady', true);
		socket2.emit('playerReady', true);
		await Promise.all([startGame1b, startGame2b]);

		expect(testGameState().gamePhase).toBe('playing');
		expect(player1.hp).toBeGreaterThan(0);
		expect(player1.dead).toBe(false);
		expect(testGameState().run.status).toBe('playing');
	});
});
