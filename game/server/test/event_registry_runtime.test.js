// Capture-independent runtime proof for the shared event-name registry
// (game/shared/events.json).
//
// The top-level visual capture pipeline (Vite + browser) flakes, so it cannot
// be trusted to prove that the game actually exchanges messages over the shared
// registry at runtime. This Node-level socket integration test boots a REAL
// server, connects two REAL socket.io-client clients, and asserts that the core
// gameplay events flow end-to-end — without Vite, a browser, or any visual
// capture.
//
// Every socket event name below is referenced through the shared registry
// constant `EVENTS.<name>` (imported exactly as production server code does).
// There are deliberately NO raw event-name string literals in any listener or
// emit call. Because the server emits these same events via the same registry,
// the test co-drifts with the registry: rename or typo a registry key and these
// `waitForEvent(socket, EVENTS.<name>)` awaits stop matching the wire name and
// the test fails — durable, code-verifiable proof the registry is wired up.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import { createRequire } from 'module';
import {
	startTestServer,
	closeServer,
	waitForEvent,
	createTestToken,
	connectTwoClients,
} from './helpers.js';

const require = createRequire(import.meta.url);
// Import the registry exactly as production server code does.
const EVENTS = require('../../shared/events.json');

/**
 * Connect one real socket.io-client client and CAPTURE its `EVENTS.init`
 * payload (the shared `connectTwoClients` harness consumes `init` internally,
 * so we connect manually here to assert on the init delivery directly). Then
 * create or join a lobby and await `EVENTS.lobbyJoined`. Every event name goes
 * through `EVENTS.*` so a registry rename breaks this path.
 */
function connectCapturingInit(baseUrl, accountId, { joinLobbyId } = {}) {
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
			reject(new Error(`connectCapturingInit: timed out waiting for ${EVENTS.init} from ${baseUrl}`));
		}, 10000);

		socket.once(EVENTS.init, async (initPayload) => {
			clearTimeout(timer);
			socket._playerId = initPayload.playerId || initPayload.id;
			try {
				if (joinLobbyId) {
					socket.emit(EVENTS.joinLobby, { lobbyId: joinLobbyId });
				} else {
					socket.emit(EVENTS.createLobby, {});
				}
				const lobbyJoined = await waitForEvent(socket, EVENTS.lobbyJoined);
				socket._lobbyId = lobbyJoined.lobbyId;
				resolve({ socket, initPayload, lobbyJoined });
			} catch (err) {
				try { socket.disconnect(); } catch (_) {}
				reject(err);
			}
		});
	});
}

describe('shared event registry — end-to-end socket runtime', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	it('delivers EVENTS.init to both clients and EVENTS.lobbyJoined into the same lobby', async () => {
		const host = await connectCapturingInit(baseUrl, 'registry-host');
		const guest = await connectCapturingInit(baseUrl, 'registry-guest', {
			joinLobbyId: host.lobbyJoined.lobbyId,
		});

		try {
			// Both clients received an EVENTS.init payload with their identity.
			expect(typeof host.initPayload.id).toBe('string');
			expect(typeof guest.initPayload.id).toBe('string');
			expect(host.initPayload.id).not.toBe(guest.initPayload.id);

			// Both clients proved lobby membership via EVENTS.lobbyJoined, and the
			// shared lobby id matches — they are in the same lobby.
			expect(typeof host.lobbyJoined.lobbyId).toBe('string');
			expect(guest.lobbyJoined.lobbyId).toBe(host.lobbyJoined.lobbyId);
		} finally {
			host.socket.disconnect();
			guest.socket.disconnect();
		}
	});

	it('delivers at least one EVENTS.stateUpdate to a client after both connect and play', async () => {
		// Reuse the established harness to get two authenticated clients in one
		// lobby, then drive a normal gameplay action (EVENTS.playerReady on both)
		// to start the run; the server game loop broadcasts EVENTS.stateUpdate.
		const { socketA, socketB, lobbyId } = await connectTwoClients(baseUrl);

		try {
			expect(typeof lobbyId).toBe('string');

			const stateUpdatePromise = waitForEvent(socketA, EVENTS.stateUpdate);
			const startGamePromise = waitForEvent(socketA, EVENTS.startGame);

			socketA.emit(EVENTS.playerReady, true);
			socketB.emit(EVENTS.playerReady, true);

			await startGamePromise;
			const snapshot = await stateUpdatePromise;

			// A real stateUpdate payload arrived over the wire after both clients
			// were connected and the run started.
			expect(snapshot).toBeTruthy();
			expect(snapshot.players).toBeDefined();
			expect(Object.keys(snapshot.players).length).toBeGreaterThanOrEqual(1);
		} finally {
			socketA.disconnect();
			socketB.disconnect();
		}
	});
});
