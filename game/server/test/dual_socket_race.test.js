import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	getJWTSecret,
	findSocketByPlayerId,
} from '../index.js';
import { clearUsers } from '../users.js';

// ── Helpers ──

async function startTestServer() {
	for (const conn of Object.values(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	if (httpServer.listening) {
		await new Promise((resolve) => {
			const t = setTimeout(() => {
				try { serverIo.close(); } catch (_) {}
				httpServer.close(resolve);
			}, 5000);
			httpServer.close(() => { clearTimeout(t); resolve(); });
		});
	}

	resetGameState();
	serverIo.removeAllListeners('connection');
	clearAllTimers();
	clearUsers();

	await startServer(0);
	const addr = httpServer.address();
	return `http://localhost:${addr.port}`;
}

async function closeTestServer() {
	if (!httpServer.listening) return;
	for (const conn of Object.values(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	await new Promise((resolve) => {
		try { serverIo.close(); } catch (_) {}
		httpServer.close(() => resolve());
	});
}

function createTestToken(accountId, username = 'testuser') {
	return jwt.sign(
		{ accountId, username },
		getJWTSecret(),
		{ expiresIn: '1h' }
	);
}

function countConnectedSocketsForPlayerId(playerId) {
	let count = 0;
	for (const socket of serverIo.sockets.sockets.values()) {
		if (socket.playerId === playerId && socket.connected) {
			count++;
		}
	}
	return count;
}

function connectAndWaitForInit(baseUrl, token) {
	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			auth: { token },
		});

		const timer = setTimeout(() => {
			socket.disconnect();
			reject(new Error('connectAndWaitForInit: timed out waiting for init'));
		}, 10000);

		socket.once('init', (data) => {
			clearTimeout(timer);
			resolve({ socket, init: data });
		});

		socket.once('connect_error', (err) => {
			clearTimeout(timer);
			socket.disconnect();
			reject(err);
		});
	});
}

function waitForEvent(socket, event) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`waitForEvent: timed out waiting for "${event}"`));
		}, 10000);
		socket.once(event, (data) => {
			clearTimeout(timer);
			resolve(data);
		});
	});
}

let baseUrl;

beforeEach(async () => {
	baseUrl = await startTestServer();
	clearUsers();
});

afterEach(async () => {
	await closeTestServer();
});

// ── Tests ──

describe('Dual socket race', () => {
	it('second connection with same JWT evicts the first live socket', async () => {
		const accountId = `acct-dual-socket-${Date.now()}`;
		const token = createTestToken(accountId);

		const { socket: socketA, init: initA } = await connectAndWaitForInit(baseUrl, token);
		expect(initA.playerId).toBe(accountId);

		socketA.emit('createLobby', { name: 'Dual Socket Race' });
		await waitForEvent(socketA, 'lobbyJoined');

		const socketADisconnected = new Promise((resolve) => {
			socketA.once('disconnect', resolve);
		});

		const { socket: socketB, init: initB } = await connectAndWaitForInit(baseUrl, token);
		expect(initB.playerId).toBe(accountId);

		await socketADisconnected;

		expect(countConnectedSocketsForPlayerId(accountId)).toBe(1);

		const liveServerSocket = findSocketByPlayerId(accountId);
		expect(liveServerSocket).toBeDefined();
		expect(liveServerSocket.connected).toBe(true);
		expect(liveServerSocket.id).toBe(socketB.id);

		expect(socketA.connected).toBe(false);
		expect(socketB.connected).toBe(true);

		socketB.disconnect();
		try { socketA.disconnect(); } catch (_) {}
	});
});
