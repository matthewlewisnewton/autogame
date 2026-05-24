import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
	hashPassword,
	comparePassword,
	createUser,
	createAccountWithEmail,
	createAccountWithEmailAsync,
	linkEmailIdentity,
	findUserByUsername,
	findUserByAccountId,
	findUserByEmail,
	findUserByIdentifier,
	verifyPasswordForIdentifier,
	updateProfile,
	clearUsers,
	loadUsers,
	saveUsers,
	getUsersFilePath,
	setTestFilePath,
	IDENTITY_PROVIDERS,
	isValidEmail,
	looksLikeEmail
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

	it('creates a user and returns { ok: true, accountId }', () => {
		const result = createUser('alice', 'password123');
		expect(result.ok).toBe(true);
		expect(typeof result.accountId).toBe('string');
	});

	it('stores a user record with username, identity-bound passwordHash, and accountId', () => {
		createUser('bob', 'bobpass');
		const user = findUserByUsername('bob');
		expect(user).not.toBeNull();
		expect(user.username).toBe('bob');
		expect(Array.isArray(user.identities)).toBe(true);
		expect(user.identities).toHaveLength(1);
		const identity = user.identities[0];
		expect(identity.provider).toBe('username');
		expect(identity.subject).toBe('bob');
		expect(typeof identity.passwordHash).toBe('string');
		expect(identity.passwordHash).toMatch(/^\$2[aby]?\$\d+\$.{53}$/);
		expect(typeof user.accountId).toBe('string');
		// accountId should be a valid UUID v4 format
		expect(user.accountId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		);
	});

	it('verifies the stored password hash with comparePassword', () => {
		createUser('carol', 'carolpass');
		const user = findUserByUsername('carol');
		expect(comparePassword('carolpass', user.identities[0].passwordHash)).toBe(true);
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
		createUser('aaa', 'pass');
		createUser('bbb', 'pass');
		const a = findUserByUsername('aaa');
		const b = findUserByUsername('bbb');

		expect(updateProfile(a.accountId, { email: 'a@test.com' }).ok).toBe(true);
		expect(updateProfile(b.accountId, { email: 'a@test.com' }).ok).toBe(false);

		const renamed = updateProfile(a.accountId, { username: 'aaa_new' });
		expect(renamed.ok).toBe(true);
		expect(renamed.usernameChanged).toBe(true);
		expect(findUserByUsername('aaa_new')).not.toBeNull();
		expect(findUserByUsername('aaa')).toBeNull();
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
		expect(Array.isArray(data[0].identities)).toBe(true);
		expect(data[0].identities[0].provider).toBe('username');
		expect(data[0].identities[0].passwordHash).toBeDefined();
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

// ── Email-based identities ─────────────────────────────────────────────────

describe('email identities', () => {
	let tmpFile;

	beforeEach(() => {
		tmpFile = path.join(os.tmpdir(), `users-email-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
		setTestFilePath(tmpFile);
		clearUsers();
	});

	afterEach(() => {
		try { fs.unlinkSync(tmpFile); } catch {}
	});

	it('createAccountWithEmail registers an email identity', () => {
		const result = createAccountWithEmail({ email: 'Alice@Example.com', password: 'secret' });
		expect(result.ok).toBe(true);
		expect(result.accountId).toBeDefined();
		expect(result.username).toBeDefined();

		const user = findUserByEmail('alice@example.com');
		expect(user).not.toBeNull();
		expect(user.email).toBe('alice@example.com');
		expect(user.identities).toHaveLength(1);
		expect(user.identities[0].provider).toBe(IDENTITY_PROVIDERS.EMAIL);
		expect(user.identities[0].subject).toBe('alice@example.com');
	});

	it('createAccountWithEmail derives a username from the email when none is supplied', () => {
		const result = createAccountWithEmail({ email: 'derived.user@example.com', password: 'pw' });
		expect(result.ok).toBe(true);
		expect(result.username).toContain('derived');
		expect(findUserByUsername(result.username)).not.toBeNull();
	});

	it('createAccountWithEmail accepts an explicit username', () => {
		const result = createAccountWithEmail({ email: 'choice@example.com', password: 'pw', username: 'chosen' });
		expect(result.ok).toBe(true);
		expect(result.username).toBe('chosen');
		expect(findUserByUsername('chosen').email).toBe('choice@example.com');
	});

	it('createAccountWithEmail rejects malformed emails', () => {
		expect(createAccountWithEmail({ email: 'not-an-email', password: 'pw' }).ok).toBe(false);
		expect(createAccountWithEmail({ email: '', password: 'pw' }).ok).toBe(false);
	});

	it('createAccountWithEmail rejects duplicate emails (case-insensitive)', () => {
		const a = createAccountWithEmail({ email: 'dup@example.com', password: 'pw' });
		expect(a.ok).toBe(true);
		const b = createAccountWithEmail({ email: 'DUP@example.com', password: 'pw2' });
		expect(b.ok).toBe(false);
		expect(b.reason).toMatch(/already in use/i);
	});

	it('createAccountWithEmail rejects username collisions with username-only accounts', () => {
		createUser('taken', 'pw');
		const result = createAccountWithEmail({ email: 'taken@example.com', password: 'pw', username: 'taken' });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/Username/);
	});

	it('createAccountWithEmailAsync mirrors the sync helper', async () => {
		const result = await createAccountWithEmailAsync({ email: 'async@example.com', password: 'pw' });
		expect(result.ok).toBe(true);
		const user = findUserByEmail('async@example.com');
		expect(user).not.toBeNull();
		expect(user.identities[0].provider).toBe(IDENTITY_PROVIDERS.EMAIL);
	});

	it('findUserByIdentifier dispatches by @-detection', () => {
		createUser('bob', 'pw');
		createAccountWithEmail({ email: 'carol@example.com', password: 'pw' });

		expect(findUserByIdentifier('bob').username).toBe('bob');
		expect(findUserByIdentifier('carol@example.com').email).toBe('carol@example.com');
		expect(findUserByIdentifier('Carol@Example.com').email).toBe('carol@example.com');
		expect(findUserByIdentifier('unknown')).toBeNull();
	});

	it('verifyPasswordForIdentifier checks the right identity', async () => {
		createUser('ronda', 'usernamePw');
		createAccountWithEmail({ email: 'multi@example.com', password: 'emailPw' });

		const rondaUser = findUserByUsername('ronda');
		expect(await verifyPasswordForIdentifier(rondaUser, 'ronda', 'usernamePw')).toBe(true);
		expect(await verifyPasswordForIdentifier(rondaUser, 'ronda', 'wrong')).toBe(false);

		const multiUser = findUserByEmail('multi@example.com');
		expect(await verifyPasswordForIdentifier(multiUser, 'multi@example.com', 'emailPw')).toBe(true);
		expect(await verifyPasswordForIdentifier(multiUser, 'multi@example.com', 'wrong')).toBe(false);
	});

	it('linkEmailIdentity attaches an email login to an existing username account', async () => {
		createUser('linker', 'usernamePw');
		const user = findUserByUsername('linker');

		const result = await linkEmailIdentity(user.accountId, 'linker@example.com', 'emailPw');
		expect(result.ok).toBe(true);

		const refreshed = findUserByAccountId(user.accountId);
		expect(refreshed.identities).toHaveLength(2);
		expect(refreshed.email).toBe('linker@example.com');
		expect(findUserByEmail('linker@example.com').accountId).toBe(user.accountId);

		// User can now authenticate via either identifier
		expect(await verifyPasswordForIdentifier(refreshed, 'linker', 'usernamePw')).toBe(true);
		expect(await verifyPasswordForIdentifier(refreshed, 'linker@example.com', 'emailPw')).toBe(true);
	});

	it('linkEmailIdentity rejects emails already used by another account', async () => {
		createUser('owner-a', 'pw');
		createAccountWithEmail({ email: 'shared@example.com', password: 'pw' });
		const a = findUserByUsername('owner-a');
		const result = await linkEmailIdentity(a.accountId, 'shared@example.com', 'pw');
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/already in use/i);
	});

	it('linkEmailIdentity rejects duplicate email identities on the same account', async () => {
		createUser('linker2', 'pw');
		const u = findUserByUsername('linker2');
		expect((await linkEmailIdentity(u.accountId, 'l2@example.com', 'pw')).ok).toBe(true);
		const repeat = await linkEmailIdentity(u.accountId, 'l2@example.com', 'pw');
		expect(repeat.ok).toBe(false);
	});

	it('linkEmailIdentity rejects unknown account ids', async () => {
		const result = await linkEmailIdentity('non-existent-account', 'x@example.com', 'pw');
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/not found/i);
	});

	it('updateProfile updates the username identity subject so future logins still resolve', async () => {
		createUser('renamer', 'pw');
		const user = findUserByUsername('renamer');
		const renamed = updateProfile(user.accountId, { username: 'renamed' });
		expect(renamed.ok).toBe(true);
		expect(renamed.usernameChanged).toBe(true);

		const updated = findUserByUsername('renamed');
		expect(updated).not.toBeNull();
		expect(updated.identities.find(i => i.provider === IDENTITY_PROVIDERS.USERNAME).subject).toBe('renamed');
		expect(await verifyPasswordForIdentifier(updated, 'renamed', 'pw')).toBe(true);
	});

	it('looksLikeEmail / isValidEmail behave as expected', () => {
		expect(looksLikeEmail('a@b')).toBe(true);
		expect(looksLikeEmail('user')).toBe(false);
		expect(isValidEmail('alice@example.com')).toBe(true);
		expect(isValidEmail('not-email')).toBe(false);
		expect(isValidEmail('')).toBe(false);
	});
});

// ── Legacy record migration ────────────────────────────────────────────────

describe('legacy record migration', () => {
	let tmpDir;
	let tmpFile;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'users-migrate-'));
		tmpFile = path.join(tmpDir, 'users.json');
		clearUsers();
	});

	afterEach(() => {
		try { fs.unlinkSync(tmpFile); } catch {}
		try { fs.unlinkSync(tmpFile + '.tmp'); } catch {}
		try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
	});

	it('reads legacy { username, passwordHash, accountId, email } records and migrates to identities[]', async () => {
		const hash = hashPassword('pw');
		const legacy = [{
			accountId: 'legacy-id-1',
			username: 'legacy-user',
			passwordHash: hash,
			email: 'legacy@example.com'
		}];
		fs.writeFileSync(tmpFile, JSON.stringify(legacy, null, 2), 'utf-8');

		setTestFilePath(tmpFile);

		const user = findUserByUsername('legacy-user');
		expect(user).not.toBeNull();
		expect(Array.isArray(user.identities)).toBe(true);
		expect(user.identities).toHaveLength(1);
		expect(user.identities[0].provider).toBe(IDENTITY_PROVIDERS.USERNAME);
		expect(user.identities[0].passwordHash).toBe(hash);
		// Legacy email is preserved as contact email but NOT as a credential.
		expect(user.email).toBe('legacy@example.com');
		expect(user.identities.find(i => i.provider === IDENTITY_PROVIDERS.EMAIL)).toBeUndefined();

		// The migrated form is persisted (no passwordHash field at top level).
		const disk = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
		expect(disk[0].passwordHash).toBeUndefined();
		expect(disk[0].identities).toBeDefined();

		// Username login still works against the migrated identity.
		expect(await verifyPasswordForIdentifier(user, 'legacy-user', 'pw')).toBe(true);
	});

	it('preserves existing identity records on load without re-migrating', () => {
		const hash = hashPassword('pw');
		const modern = [{
			accountId: 'modern-1',
			username: 'modern-user',
			email: 'modern@example.com',
			identities: [
				{ provider: 'username', subject: 'modern-user', passwordHash: hash, createdAt: 1 }
			],
			createdAt: 1
		}];
		fs.writeFileSync(tmpFile, JSON.stringify(modern, null, 2), 'utf-8');
		setTestFilePath(tmpFile);

		const user = findUserByUsername('modern-user');
		expect(user).not.toBeNull();
		expect(user.identities).toHaveLength(1);
		expect(user.createdAt).toBe(1);
	});
});
