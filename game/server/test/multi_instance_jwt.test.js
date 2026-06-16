import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import jwt from 'jsonwebtoken';

// Use createRequire so we exercise the same CJS auth module instance as the server.
const requireCJS = createRequire(import.meta.url);
const {
	initAuth,
	resetAuthSecret,
	verifyToken,
	getJWTSecret
} = requireCJS('../auth.js');

const SHARED_SECRET = 'shared-hosting-secret';
const OTHER_SECRET = 'other-instance-secret';
const TEST_PAYLOAD = { accountId: 'acct-multi', username: 'player' };

describe('multi-instance JWT verification', () => {
	const origNodeEnv = process.env.NODE_ENV;
	const origJwtSecret = process.env.JWT_SECRET;

	beforeEach(() => {
		resetAuthSecret();
	});

	afterEach(() => {
		process.env.NODE_ENV = origNodeEnv;
		if (origJwtSecret === undefined) {
			delete process.env.JWT_SECRET;
		} else {
			process.env.JWT_SECRET = origJwtSecret;
		}
		resetAuthSecret();
	});

	it('verifies token after resetAuthSecret and re-init with the same JWT_SECRET', () => {
		process.env.JWT_SECRET = SHARED_SECRET;
		initAuth();

		const token = jwt.sign(TEST_PAYLOAD, getJWTSecret(), { expiresIn: '24h' });

		// Simulate a second server boot: secret module state cleared, env unchanged.
		resetAuthSecret();
		initAuth();

		const decoded = verifyToken(token);
		expect(decoded).not.toBeNull();
		expect(decoded.accountId).toBe(TEST_PAYLOAD.accountId);
		expect(decoded.username).toBe(TEST_PAYLOAD.username);
	});

	it('returns null after re-init with a different JWT_SECRET', () => {
		process.env.JWT_SECRET = SHARED_SECRET;
		initAuth();

		const token = jwt.sign(TEST_PAYLOAD, getJWTSecret(), { expiresIn: '24h' });

		resetAuthSecret();
		process.env.JWT_SECRET = OTHER_SECRET;
		initAuth();

		expect(verifyToken(token)).toBeNull();
	});

	it('getJWTSecret returns the env value (stateless secret, no session map)', () => {
		process.env.JWT_SECRET = SHARED_SECRET;
		initAuth();
		expect(getJWTSecret()).toBe(SHARED_SECRET);

		// Token minted on "instance A" is rejected once the module secret changes.
		const token = jwt.sign(TEST_PAYLOAD, SHARED_SECRET, { expiresIn: '24h' });
		resetAuthSecret();
		process.env.JWT_SECRET = OTHER_SECRET;
		initAuth();
		expect(getJWTSecret()).toBe(OTHER_SECRET);
		expect(verifyToken(token)).toBeNull();
	});
});

describe('initAuth() production guard', () => {
	const origNodeEnv = process.env.NODE_ENV;
	const origJwtSecret = process.env.JWT_SECRET;

	beforeEach(() => {
		resetAuthSecret();
		delete process.env.JWT_SECRET;
	});

	afterEach(() => {
		process.env.NODE_ENV = origNodeEnv;
		if (origJwtSecret === undefined) {
			delete process.env.JWT_SECRET;
		} else {
			process.env.JWT_SECRET = origJwtSecret;
		}
		resetAuthSecret();
	});

	it('throws Missing JWT_SECRET when NODE_ENV=production and secret is unset', () => {
		process.env.NODE_ENV = 'production';
		expect(() => initAuth()).toThrow('Missing JWT_SECRET');
	});
});
