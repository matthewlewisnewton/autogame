import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('isDebugScenarioAllowed header spoofing', () => {
	let prevAllowDebug;
	let prevNodeEnv;

	beforeEach(() => {
		prevAllowDebug = process.env.ALLOW_DEBUG_SCENARIOS;
		prevNodeEnv = process.env.NODE_ENV;
		// Unset so the address check is exercised (not the env-var shortcuts)
		delete process.env.ALLOW_DEBUG_SCENARIOS;
		delete process.env.NODE_ENV;
	});

	afterEach(() => {
		if (prevAllowDebug === undefined) {
			delete process.env.ALLOW_DEBUG_SCENARIOS;
		} else {
			process.env.ALLOW_DEBUG_SCENARIOS = prevAllowDebug;
		}
		if (prevNodeEnv === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = prevNodeEnv;
		}
	});

	it('rejects socket with non-loopback address despite localhost-looking Origin/Host headers', () => {
		const { isDebugScenarioAllowed } = require('../index.js');
		const mockSocket = {
			handshake: {
				address: '1.2.3.4',
				headers: {
					origin: 'http://localhost:5173',
					host: 'localhost:5173',
				},
			},
		};
		expect(isDebugScenarioAllowed(mockSocket)).toBe(false);
	});

	it('allows socket with IPv4 loopback address (regression guard)', () => {
		const { isDebugScenarioAllowed } = require('../index.js');
		const mockSocket = {
			handshake: {
				address: '127.0.0.1',
				headers: {},
			},
		};
		expect(isDebugScenarioAllowed(mockSocket)).toBe(true);
	});

	it('allows socket with IPv6 loopback address (regression guard)', () => {
		const { isDebugScenarioAllowed } = require('../index.js');
		const mockSocket = {
			handshake: {
				address: '::1',
				headers: {},
			},
		};
		expect(isDebugScenarioAllowed(mockSocket)).toBe(true);
	});

	it('allows socket with IPv4-mapped loopback address (::ffff:127.0.0.1)', () => {
		const { isDebugScenarioAllowed } = require('../index.js');
		const mockSocket = {
			handshake: {
				address: '::ffff:127.0.0.1',
				headers: {},
			},
		};
		expect(isDebugScenarioAllowed(mockSocket)).toBe(true);
	});

	it('rejects socket with public IP even with matching localhost headers', () => {
		const { isDebugScenarioAllowed } = require('../index.js');
		const mockSocket = {
			handshake: {
				address: '203.0.113.50',
				headers: {
					origin: 'http://127.0.0.1:5173',
					host: '127.0.0.1:5173',
				},
			},
		};
		expect(isDebugScenarioAllowed(mockSocket)).toBe(false);
	});

	it('rejects socket with empty address', () => {
		const { isDebugScenarioAllowed } = require('../index.js');
		const mockSocket = {
			handshake: {
				address: '',
				headers: {
					origin: 'http://localhost:5173',
					host: 'localhost:5173',
				},
			},
		};
		expect(isDebugScenarioAllowed(mockSocket)).toBe(false);
	});

	it('rejects socket with missing handshake.address', () => {
		const { isDebugScenarioAllowed } = require('../index.js');
		const mockSocket = {
			handshake: {
				headers: {
					origin: 'http://localhost:5173',
					host: 'localhost:5173',
				},
			},
		};
		expect(isDebugScenarioAllowed(mockSocket)).toBe(false);
	});

	it('rejects non-loopback peers in production without ALLOW_DEBUG_SCENARIOS', () => {
		process.env.NODE_ENV = 'production';
		const { isDebugScenarioAllowed } = require('../index.js');
		const mockSocket = {
			handshake: {
				address: '1.2.3.4',
				headers: {
					origin: 'http://localhost:5173',
					host: 'localhost:5173',
				},
			},
		};
		expect(isDebugScenarioAllowed(mockSocket)).toBe(false);
	});
});
