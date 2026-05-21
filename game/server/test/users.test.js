import { describe, it, expect, beforeEach } from 'vitest';
import {
	hashPassword,
	comparePassword,
	createUser,
	findUserByUsername,
	clearUsers
} from '../users.js';

// ── hashPassword ──

describe('hashPassword', () => {
	it('returns a bcrypt hash string', () => {
		const hash = hashPassword('secret123');
		expect(typeof hash).toBe('string');
		expect(hash).toMatch(/^\$2[aby]?\$\d+\$.{53}$/);
	});

	it('produces a different hash on each call (salted)', () => {
		const hash1 = hashPassword('same_password');
		const hash2 = hashPassword('same_password');
		expect(hash1).not.toBe(hash2);
	});
});

// ── comparePassword ──

describe('comparePassword', () => {
	it('returns true for a correct password', () => {
		const hash = hashPassword('my_password');
		expect(comparePassword('my_password', hash)).toBe(true);
	});

	it('returns false for an incorrect password', () => {
		const hash = hashPassword('my_password');
		expect(comparePassword('wrong_password', hash)).toBe(false);
	});

	it('returns false for an empty string against a valid hash', () => {
		const hash = hashPassword('something');
		expect(comparePassword('', hash)).toBe(false);
	});
});

// ── createUser ──

describe('createUser', () => {
	beforeEach(() => {
		clearUsers();
	});

	it('creates a user and returns { ok: true }', () => {
		const result = createUser('alice', 'password123');
		expect(result).toEqual({ ok: true });
	});

	it('stores a user record with username, passwordHash, and accountId', () => {
		createUser('bob', 'bobpass');
		const user = findUserByUsername('bob');
		expect(user).not.toBeNull();
		expect(user.username).toBe('bob');
		expect(typeof user.passwordHash).toBe('string');
		expect(user.passwordHash).toMatch(/^\$2[aby]?\$\d+\$.{53}$/);
		expect(typeof user.accountId).toBe('string');
		// accountId should be a valid UUID v4 format
		expect(user.accountId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		);
	});

	it('verifies the stored password hash with comparePassword', () => {
		createUser('carol', 'carolpass');
		const user = findUserByUsername('carol');
		expect(comparePassword('carolpass', user.passwordHash)).toBe(true);
	});

	it('rejects duplicate usernames', () => {
		createUser('dave', 'davepass');
		const result = createUser('dave', 'different_pass');
		expect(result).toEqual({ ok: false, reason: 'Username already taken' });
	});

	it('generates unique accountIds for different users', () => {
		createUser('user1', 'pass');
		createUser('user2', 'pass');
		const u1 = findUserByUsername('user1');
		const u2 = findUserByUsername('user2');
		expect(u1.accountId).not.toBe(u2.accountId);
	});
});

// ── findUserByUsername ──

describe('findUserByUsername', () => {
	beforeEach(() => {
		clearUsers();
	});

	it('returns the user record for an existing username', () => {
		createUser('frank', 'frankpass');
		const user = findUserByUsername('frank');
		expect(user).not.toBeNull();
		expect(user.username).toBe('frank');
	});

	it('returns null for a non-existent username', () => {
		expect(findUserByUsername('nonexistent')).toBeNull();
	});

	it('returns null for an empty string', () => {
		expect(findUserByUsername('')).toBeNull();
	});
});
