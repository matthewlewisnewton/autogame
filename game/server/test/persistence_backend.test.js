import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	setTestProvider,
	getProvider,
} from '../index.js';
import { resetAuthSecret } from '../auth.js';

const require = createRequire(import.meta.url);
const providers = require('../providers.js');
const { InMemoryProvider, FileProvider } = providers;

const ENV_KEYS = ['NODE_ENV', 'PERSISTENCE_BACKEND', 'DATABASE_URL', 'PERSISTENCE_PATH', 'JWT_SECRET'];

function saveEnv() {
	const saved = {};
	for (const key of ENV_KEYS) {
		saved[key] = process.env[key];
	}
	return saved;
}

function restoreEnv(saved) {
	for (const key of ENV_KEYS) {
		if (saved[key] === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = saved[key];
		}
	}
}

function useNonTestEnv() {
	process.env.NODE_ENV = 'development';
	process.env.JWT_SECRET = 'persistence-backend-test-secret';
}

async function teardownServer() {
	try {
		serverIo.disconnectSockets(true);
	} catch (_) {}
	if (!httpServer.listening) {
		return;
	}
	await new Promise((resolve) => {
		const t = setTimeout(resolve, 5000);
		httpServer.close(() => {
			clearTimeout(t);
			resolve();
		});
		if (typeof httpServer.closeAllConnections === 'function') {
			try {
				httpServer.closeAllConnections();
			} catch (_) {}
		}
	});
}

function initPersistenceProvider() {
	resetGameState();
	serverIo.removeAllListeners('connection');
	clearAllTimers();
	startServer(0);
}

describe('persistence backend selection in startServer', () => {
	let savedEnv;
	let tmpDir;

	beforeEach(async () => {
		savedEnv = saveEnv();
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'persistence-backend-'));
		resetAuthSecret();
		await teardownServer();
	});

	afterEach(async () => {
		const provider = getProvider();
		if (provider && typeof provider.close === 'function') {
			try {
				provider.close();
			} catch (_) {}
		}
		setTestProvider(null);
		resetAuthSecret();
		vi.restoreAllMocks();
		restoreEnv(savedEnv);
		await teardownServer();
		if (tmpDir) {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it('uses InMemoryProvider in NODE_ENV=test when no provider was injected', () => {
		process.env.NODE_ENV = 'test';
		delete process.env.PERSISTENCE_BACKEND;
		delete process.env.DATABASE_URL;
		setTestProvider(null);

		initPersistenceProvider();

		expect(getProvider()).toBeInstanceOf(InMemoryProvider);
	});

	it('keeps an injected provider in NODE_ENV=test', () => {
		process.env.NODE_ENV = 'test';
		const injected = new InMemoryProvider();
		setTestProvider(injected);

		initPersistenceProvider();

		expect(getProvider()).toBe(injected);
	});

	it('uses InMemoryProvider when PERSISTENCE_BACKEND=memory (non-test)', () => {
		useNonTestEnv();
		process.env.PERSISTENCE_BACKEND = 'memory';
		delete process.env.DATABASE_URL;
		setTestProvider(null);
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		initPersistenceProvider();

		expect(getProvider()).toBeInstanceOf(InMemoryProvider);
		expect(logSpy).toHaveBeenCalledWith(
			'[persistence] InMemoryProvider initialized (ephemeral — set PERSISTENCE_BACKEND=file for durable storage)'
		);
	});

	it('uses FileProvider when PERSISTENCE_BACKEND is unset (non-test)', () => {
		useNonTestEnv();
		delete process.env.PERSISTENCE_BACKEND;
		delete process.env.DATABASE_URL;
		process.env.PERSISTENCE_PATH = tmpDir;
		setTestProvider(null);
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		initPersistenceProvider();

		expect(getProvider()).toBeInstanceOf(FileProvider);
		expect(logSpy).toHaveBeenCalledWith(`[persistence] FileProvider initialized at ${tmpDir}`);
	});

	it('uses PostgresProvider when PERSISTENCE_BACKEND=postgres and DATABASE_URL is set', () => {
		useNonTestEnv();
		process.env.PERSISTENCE_BACKEND = 'postgres';
		process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/testdb';
		setTestProvider(null);
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const mockProvider = { savePlayer: vi.fn(), loadPlayer: vi.fn(), close: vi.fn() };
		const ctorSpy = vi.spyOn(providers, 'PostgresProvider').mockImplementation((url) => {
			expect(url).toBe('postgres://user:pass@localhost:5432/testdb');
			return mockProvider;
		});

		initPersistenceProvider();

		expect(ctorSpy).toHaveBeenCalledWith('postgres://user:pass@localhost:5432/testdb');
		expect(getProvider()).toBe(mockProvider);
		expect(logSpy).toHaveBeenCalledWith('[persistence] PostgresProvider initialized');
	});

	it('throws before listening when PERSISTENCE_BACKEND=postgres but DATABASE_URL is missing', async () => {
		useNonTestEnv();
		process.env.PERSISTENCE_BACKEND = 'postgres';
		delete process.env.DATABASE_URL;
		setTestProvider(null);

		expect(() => initPersistenceProvider()).toThrow(
			/PERSISTENCE_BACKEND=postgres requires DATABASE_URL/
		);
		expect(httpServer.listening).toBe(false);
	});

	it('throws when PERSISTENCE_BACKEND=postgres but DATABASE_URL is empty', () => {
		useNonTestEnv();
		process.env.PERSISTENCE_BACKEND = 'postgres';
		process.env.DATABASE_URL = '   ';
		setTestProvider(null);

		expect(() => initPersistenceProvider()).toThrow(
			/PERSISTENCE_BACKEND=postgres requires DATABASE_URL/
		);
		expect(httpServer.listening).toBe(false);
	});
});
