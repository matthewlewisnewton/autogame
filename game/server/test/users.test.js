import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
	hashPassword,
	comparePassword,
	createUser,
	findUserByUsername,
	findUserByAccountId,
	findUserByEmail,
	updateProfile,
	clearUsers,
	loadUsers,
	saveUsers,
	getUsersFilePath,
	setTestFilePath
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
	let tmpFile;

	beforeEach(() => {
		tmpFile = path.join(os.tmpdir(), `users-create-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
		setTestFilePath(tmpFile);
		clearUsers();
	});

	afterEach(() => {
		try { fs.unlinkSync(tmpFile); } catch {}
		try { fs.unlinkSync(tmpFile + '.tmp'); } catch {}
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
	let tmpFile;

	beforeEach(() => {
		tmpFile = path.join(os.tmpdir(), `users-find-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
		setTestFilePath(tmpFile);
		clearUsers();
	});

	afterEach(() => {
		try { fs.unlinkSync(tmpFile); } catch {}
		try { fs.unlinkSync(tmpFile + '.tmp'); } catch {}
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

// ── findUserByAccountId / email / updateProfile ──

describe('profile helpers', () => {
	let tmpFile;

	beforeEach(() => {
		tmpFile = path.join(os.tmpdir(), `users-profile-${Date.now()}.json`);
		setTestFilePath(tmpFile);
		clearUsers();
	});

	afterEach(() => {
		try { fs.unlinkSync(tmpFile); } catch {}
	});

	it('findUserByAccountId returns the user record', () => {
		createUser('prof1', 'pass');
		const user = findUserByUsername('prof1');
		expect(findUserByAccountId(user.accountId).username).toBe('prof1');
	});

	it('updateProfile sets email and rejects duplicates', () => {
		createUser('a', 'pass');
		createUser('b', 'pass');
		const a = findUserByUsername('a');
		const b = findUserByUsername('b');

		expect(updateProfile(a.accountId, { email: 'a@test.com' }).ok).toBe(true);
		expect(updateProfile(b.accountId, { email: 'a@test.com' }).ok).toBe(false);

		const renamed = updateProfile(a.accountId, { username: 'a_new' });
		expect(renamed.ok).toBe(true);
		expect(renamed.usernameChanged).toBe(true);
		expect(findUserByUsername('a_new')).not.toBeNull();
		expect(findUserByUsername('a')).toBeNull();
	});
});

// ── File-backed persistence ──

describe('file-backed persistence', () => {
	let tmpDir;
	let tmpFile;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'users-test-'));
		tmpFile = path.join(tmpDir, 'test_users.json');
		// Point the module at our temp file
		setTestFilePath(tmpFile);
		// Clear the in-memory map for a clean slate
		clearUsers();
	});

	afterEach(() => {
		// Clean up temp files
		try { fs.unlinkSync(tmpFile); } catch {}
		try { fs.unlinkSync(tmpFile + '.tmp'); } catch {}
		try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
	});

	it('saves user to disk on createUser', () => {
		createUser('alice', 'pass123');
		expect(fs.existsSync(tmpFile)).toBe(true);
		const data = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
		expect(data).toHaveLength(1);
		expect(data[0].username).toBe('alice');
		expect(data[0].accountId).toBeDefined();
		expect(data[0].passwordHash).toBeDefined();
	});

	it('loads existing users from file on loadUsers call', () => {
		// Create a user (which saves to file)
		createUser('bob', 'bobpass');
		const savedAccountId = findUserByUsername('bob').accountId;

		// Clear the in-memory map to simulate a restart
		clearUsers();
		expect(findUserByUsername('bob')).toBeNull();

		// Reload from file
		loadUsers();
		const loaded = findUserByUsername('bob');
		expect(loaded).not.toBeNull();
		expect(loaded.accountId).toBe(savedAccountId);
	});

	it('accountId stability across restarts (clear map, reload from file)', () => {
		createUser('stable_user', 'mypass');
		const originalId = findUserByUsername('stable_user').accountId;

		// Simulate restart: clear memory, reload
		clearUsers();
		loadUsers();

		const restored = findUserByUsername('stable_user');
		expect(restored).not.toBeNull();
		expect(restored.accountId).toBe(originalId);
	});

	it('handles missing file on loadUsers gracefully', () => {
		// Clear map and ensure file doesn't exist
		clearUsers();
		try { fs.unlinkSync(tmpFile); } catch {}

		// loadUsers should not throw when file is missing
		expect(() => loadUsers()).not.toThrow();
		expect(findUserByUsername('anyone')).toBeNull();
	});

	it('uses atomic write pattern (write to .tmp then rename)', () => {
		createUser('atomic_test', 'pass');
		// After save, the .json should exist, no leftover .tmp
		expect(fs.existsSync(tmpFile)).toBe(true);
		expect(fs.existsSync(tmpFile + '.tmp')).toBe(false);
	});

	it('preserves multiple users across restart', () => {
		createUser('user_a', 'pass');
		createUser('user_b', 'pass');

		const idA = findUserByUsername('user_a').accountId;
		const idB = findUserByUsername('user_b').accountId;

		// Simulate restart
		clearUsers();
		loadUsers();

		expect(findUserByUsername('user_a').accountId).toBe(idA);
		expect(findUserByUsername('user_b').accountId).toBe(idB);
	});

	it('getUsersFilePath returns the configured path', () => {
		expect(getUsersFilePath()).toBe(tmpFile);
	});
});
