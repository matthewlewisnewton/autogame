import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Force production mode BEFORE importing server module so static middleware
// is mounted inside startServer() (which checks process.env.NODE_ENV at runtime).
process.env.NODE_ENV = 'production';
// Production mode requires JWT_SECRET for initAuth(); use a test-only value.
process.env.JWT_SECRET = 'test-secret-for-static-serve-tests';

import {
	startServer,
	server as httpServer,
	io as serverIo,
	clearAllTimers,
} from '../index.js';

const mockDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
const MOCK_HTML = '<!DOCTYPE html><html><head><title>Void Grimoire</title></head><body></body></html>';

function setupMockDist() {
	fs.mkdirSync(mockDist, { recursive: true });
	fs.writeFileSync(path.join(mockDist, 'index.html'), MOCK_HTML);
}

function teardownMockDist() {
	try {
		fs.rmSync(mockDist, { recursive: true, force: true });
	} catch {
		// ignore — dist may not exist
	}
}

function request(urlPath) {
	return new Promise((resolve, reject) => {
		const addr = httpServer.address();
		if (!addr || typeof addr.port !== 'number') {
			return reject(new Error('Server not listening'));
		}
		http.get(`http://127.0.0.1:${addr.port}${urlPath}`, (res) => {
			const chunks = [];
			res.on('data', (chunk) => chunks.push(chunk));
			res.on('end', () => {
				const body = Buffer.concat(chunks).toString('utf8');
				resolve({
					status: res.statusCode,
					contentType: res.headers['content-type'] || '',
					body,
				});
			});
		}).on('error', reject);
	});
}

beforeAll(async () => {
	setupMockDist();
	clearAllTimers();

	if (httpServer.listening) {
		const addr = httpServer.address();
		return `http://127.0.0.1:${addr.port}`;
	}

	await startServer(0);
	const addr = httpServer.address();
	return `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
	teardownMockDist();
	// Restore NODE_ENV for other tests in the same process
	process.env.NODE_ENV = 'test';

	if (!httpServer.listening) return;
	await new Promise((resolve) => {
		try { serverIo.close(); } catch (_) {}
		httpServer.close(() => resolve());
	});
});

describe('Production static client serving', () => {
	it('GET / returns HTTP 200 with HTML containing <title>', async () => {
		const res = await request('/');
		expect(res.status).toBe(200);
		expect(res.contentType).toContain('text/html');
		expect(res.body).toContain('<title>');
		expect(res.body).toContain('Void Grimoire');
	});

	it('GET /foo (unknown path) returns SPA index.html (200)', async () => {
		const res = await request('/foo');
		expect(res.status).toBe(200);
		expect(res.contentType).toContain('text/html');
		expect(res.body).toContain('<title>');
	});

	it('GET /healthz returns JSON { ok: true } (not HTML)', async () => {
		const res = await request('/healthz');
		expect(res.status).toBe(200);
		expect(res.contentType).toContain('application/json');
		expect(res.body).not.toContain('<html>');
		const json = JSON.parse(res.body);
		expect(json.ok).toBe(true);
	});

	it('GET /api/some-path returns non-HTML response (not SPA fallback)', async () => {
		const res = await request('/api/some-path');
		// Should be a non-HTML error (401 from auth middleware or 404) — never the SPA shell
		expect(res.contentType).not.toContain('text/html');
		expect(res.body).not.toContain('<html>');
		expect(res.body).not.toContain('Void Grimoire');
	});
});
