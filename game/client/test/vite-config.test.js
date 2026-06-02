import { describe, it, expect, afterEach, vi } from 'vitest';

describe('vite.config.js proxy targets', () => {
	const savedHarnessPort = process.env.HARNESS_GAME_PORT;
	const savedPort = process.env.PORT;

	afterEach(() => {
		vi.resetModules();
		if (savedHarnessPort === undefined) {
			delete process.env.HARNESS_GAME_PORT;
		} else {
			process.env.HARNESS_GAME_PORT = savedHarnessPort;
		}
		if (savedPort === undefined) {
			delete process.env.PORT;
		} else {
			process.env.PORT = savedPort;
		}
	});

	async function loadConfig() {
		const { default: config } = await import('../vite.config.js');
		return config;
	}

	it('defaults proxy target to localhost:3000 when no port env is set', async () => {
		delete process.env.HARNESS_GAME_PORT;
		delete process.env.PORT;
		const config = await loadConfig();
		expect(config.server.proxy['/api'].target).toBe('http://localhost:3000');
		expect(config.server.proxy['/socket.io'].target).toBe('http://localhost:3000');
	});

	it('uses HARNESS_GAME_PORT for proxy targets when set', async () => {
		process.env.HARNESS_GAME_PORT = '3001';
		delete process.env.PORT;
		const config = await loadConfig();
		expect(config.server.proxy['/api'].target).toBe('http://localhost:3001');
		expect(config.server.proxy['/socket.io'].target).toBe('http://localhost:3001');
	});

	it('falls back to PORT when HARNESS_GAME_PORT is unset', async () => {
		delete process.env.HARNESS_GAME_PORT;
		process.env.PORT = '3002';
		const config = await loadConfig();
		expect(config.server.proxy['/api'].target).toBe('http://localhost:3002');
		expect(config.server.proxy['/socket.io'].target).toBe('http://localhost:3002');
	});

	it('prefers HARNESS_GAME_PORT over PORT', async () => {
		process.env.HARNESS_GAME_PORT = '3001';
		process.env.PORT = '3002';
		const config = await loadConfig();
		expect(config.server.proxy['/api'].target).toBe('http://localhost:3001');
	});
});
