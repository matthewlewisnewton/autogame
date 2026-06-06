import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { server as httpServer } from '../index.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	testGameState,
} from './helpers.js';

describe('lobby ready → deploy resilience', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	it('two players ready up, server stays listening and emits startGame', async () => {
		const p1 = await connectClient(baseUrl, 'ready-resilience-a');
		const p2 = await connectClient(baseUrl, 'ready-resilience-b', {
			joinLobbyId: p1.lobbyId,
		});

		const startA = waitForEvent(p1.socket, 'startGame');
		const startB = waitForEvent(p2.socket, 'startGame');

		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);

		await Promise.all([startA, startB]);

		expect(httpServer.listening).toBe(true);
		const healthz = await fetch(`${baseUrl}/healthz`);
		expect(healthz.status).toBe(200);
		expect(await healthz.json()).toEqual({ ok: true });
		expect(testGameState().gamePhase).toBe('playing');
		expect(testGameState().run).toBeTruthy();

		p1.socket.disconnect();
		p2.socket.disconnect();
	});
});
