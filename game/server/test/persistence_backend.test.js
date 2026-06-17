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

async function initPersistenceProvider() {
	resetGameState();
	serverIo.removeAllListeners('connection');
	clearAllTimers();
	await startServer(0);
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

	it('uses InMemoryProvider in NODE_ENV=test when no provider was injected', async () => {
		process.env.NODE_ENV = 'test';
		delete process.env.PERSISTENCE_BACKEND;
		delete process.env.DATABASE_URL;
		setTestProvider(null);

		await initPersistenceProvider();

		expect(getProvider()).toBeInstanceOf(InMemoryProvider);
	});

	it('keeps an injected provider in NODE_ENV=test', async () => {
		process.env.NODE_ENV = 'test';
		const injected = new InMemoryProvider();
		setTestProvider(injected);

		await initPersistenceProvider();

		expect(getProvider()).toBe(injected);
	});

	it('uses InMemoryProvider when PERSISTENCE_BACKEND=memory (non-test)', async () => {
		useNonTestEnv();
		process.env.PERSISTENCE_BACKEND = 'memory';
		delete process.env.DATABASE_URL;
		setTestProvider(null);
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		await initPersistenceProvider();

		expect(getProvider()).toBeInstanceOf(InMemoryProvider);
		expect(logSpy).toHaveBeenCalledWith(
			'[persistence] InMemoryProvider initialized (ephemeral — set PERSISTENCE_BACKEND=file for durable storage)'
		);
	});

	it('uses FileProvider when PERSISTENCE_BACKEND is unset (non-test)', async () => {
		useNonTestEnv();
		delete process.env.PERSISTENCE_BACKEND;
		delete process.env.DATABASE_URL;
		process.env.PERSISTENCE_PATH = tmpDir;
		setTestProvider(null);
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		await initPersistenceProvider();

		expect(getProvider()).toBeInstanceOf(FileProvider);
		expect(logSpy).toHaveBeenCalledWith(`[persistence] FileProvider initialized at ${tmpDir}`);
	});

	it('uses PostgresProvider when PERSISTENCE_BACKEND=postgres and DATABASE_URL is set', async () => {
		useNonTestEnv();
		process.env.PERSISTENCE_BACKEND = 'postgres';
		process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/testdb';
		setTestProvider(null);
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const mockProvider = { savePlayer: vi.fn(), loadPlayer: vi.fn(), close: vi.fn() };
		const createSpy = vi.spyOn(providers.PostgresProvider, 'create').mockResolvedValue(mockProvider);

		await initPersistenceProvider();

		expect(createSpy).toHaveBeenCalledWith('postgres://user:pass@localhost:5432/testdb');
		expect(getProvider()).toBe(mockProvider);
		expect(logSpy).toHaveBeenCalledWith('[persistence] PostgresProvider initialized');
	});

	it('throws before listening when PERSISTENCE_BACKEND=postgres but DATABASE_URL is missing', async () => {
		useNonTestEnv();
		process.env.PERSISTENCE_BACKEND = 'postgres';
		delete process.env.DATABASE_URL;
		setTestProvider(null);

		await expect(initPersistenceProvider()).rejects.toThrow(
			/PERSISTENCE_BACKEND=postgres requires DATABASE_URL/
		);
		expect(httpServer.listening).toBe(false);
	});

	it('throws when PERSISTENCE_BACKEND=postgres but DATABASE_URL is empty', async () => {
		useNonTestEnv();
		process.env.PERSISTENCE_BACKEND = 'postgres';
		process.env.DATABASE_URL = '   ';
		setTestProvider(null);

		await expect(initPersistenceProvider()).rejects.toThrow(
			/PERSISTENCE_BACKEND=postgres requires DATABASE_URL/
		);
		expect(httpServer.listening).toBe(false);
	});
});
