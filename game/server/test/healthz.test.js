import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
} from '../index.js';

async function startTestServer() {
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
	await startServer(0);
	const addr = httpServer.address();
	return `http://localhost:${addr.port}`;
}

async function closeTestServer() {
	if (!httpServer.listening) return;
	await new Promise((resolve) => {
		try { serverIo.close(); } catch (_) {}
		httpServer.close(() => resolve());
	});
}

let baseUrl;

beforeEach(async () => {
	baseUrl = await startTestServer();
});

afterEach(async () => {
	await closeTestServer();
});

describe('GET /healthz', () => {
	it('returns 200 with { ok: true } without auth after startServer completes', async () => {
		const res = await fetch(`${baseUrl}/healthz`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
});
