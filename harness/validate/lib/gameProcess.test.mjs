import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServerEnv } from './gameProcess.mjs';

const RELEVANT_KEYS = [
	'PERSISTENCE_BACKEND',
	'DATABASE_URL',
	'REDIS_URL',
	'PORT',
	'ALLOW_DEBUG_SCENARIOS',
	'ALLOW_DEV_AUTH',
];

function saveEnv() {
	const saved = {};
	for (const key of RELEVANT_KEYS) {
		saved[key] = process.env[key];
	}
	return saved;
}

function restoreEnv(saved) {
	for (const key of RELEVANT_KEYS) {
		if (saved[key] === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = saved[key];
		}
	}
}

describe('buildServerEnv', () => {
	let saved;

	beforeEach(() => {
		saved = saveEnv();
	});

	afterEach(() => {
		restoreEnv(saved);
	});

	it('falls back to memory when PERSISTENCE_BACKEND is unset', () => {
		delete process.env.PERSISTENCE_BACKEND;
		const env = buildServerEnv(3200);
		expect(env.PERSISTENCE_BACKEND).toBe('memory');
	});

	it('passes through PERSISTENCE_BACKEND=postgres to server child', () => {
		process.env.PERSISTENCE_BACKEND = 'postgres';
		const env = buildServerEnv(3200);
		expect(env.PERSISTENCE_BACKEND).toBe('postgres');
	});

	it('passes through PERSISTENCE_BACKEND=redis to server child', () => {
		process.env.PERSISTENCE_BACKEND = 'redis';
		const env = buildServerEnv(3200);
		expect(env.PERSISTENCE_BACKEND).toBe('redis');
	});

	it('passes through DATABASE_URL when set in parent env', () => {
		process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/autogame';
		const env = buildServerEnv(3200);
		expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/autogame');
	});

	it('passes through REDIS_URL when set in parent env', () => {
		process.env.REDIS_URL = 'redis://localhost:6379/0';
		const env = buildServerEnv(3200);
		expect(env.REDIS_URL).toBe('redis://localhost:6379/0');
	});

	it('sets PORT, ALLOW_DEBUG_SCENARIOS, and ALLOW_DEV_AUTH', () => {
		const env = buildServerEnv(4000);
		expect(env.PORT).toBe('4000');
		expect(env.ALLOW_DEBUG_SCENARIOS).toBe('1');
		expect(env.ALLOW_DEV_AUTH).toBe('1');
	});

	it('preserves parent env variables that are not overridden', () => {
		process.env.HARNESS_CUSTOM_VAR = 'test-value';
		const env = buildServerEnv(3200);
		expect(env.HARNESS_CUSTOM_VAR).toBe('test-value');
		// Clean up
		delete process.env.HARNESS_CUSTOM_VAR;
	});
});
