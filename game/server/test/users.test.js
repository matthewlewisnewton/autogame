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

// ── Cosmetic storage & validation ──

describe('cosmetic profile', () => {
	let tmpFile;

	beforeEach(() => {
		tmpFile = path.join(os.tmpdir(), `users-cosmetic-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
		setTestFilePath(tmpFile);
		clearUsers();
	});

	afterEach(() => {
		try { fs.unlinkSync(tmpFile); } catch {}
		try { fs.unlinkSync(tmpFile + '.tmp'); } catch {}
	});

	it('applies a default cosmetic at account creation', () => {
		createUser('cosmo', 'pass');
		const user = findUserByUsername('cosmo');
		expect(user.cosmetic).toEqual({
			bodyColor: '#4f9dde',
			accentColor: '#f2c94c',
			bodyShape: 'box',
			hat: 'none',
			modelId: 'player',
			proportions: { height: 1.0, headSize: 1.0, torsoWidth: 1.0, armLength: 1.0, legLength: 1.0, shoulderWidth: 1.0 }
		});
	});

	it('partial cosmetic update merges only provided fields', () => {
		createUser('cosmo', 'pass');
		const id = findUserByUsername('cosmo').accountId;

		const res = updateProfile(id, { cosmetic: { bodyShape: 'cone' } });
		expect(res.ok).toBe(true);
		const user = findUserByAccountId(id);
		expect(user.cosmetic.bodyShape).toBe('cone');
		expect(user.cosmetic.bodyColor).toBe('#4f9dde');
		expect(user.cosmetic.accentColor).toBe('#f2c94c');
	});

	it('rejects an invalid bodyShape without mutating or persisting', () => {
		createUser('cosmo', 'pass');
		const id = findUserByUsername('cosmo').accountId;

		const res = updateProfile(id, { cosmetic: { bodyShape: 'pyramid' } });
		expect(res.ok).toBe(false);
		expect(findUserByAccountId(id).cosmetic.bodyShape).toBe('box');
	});

	it('rejects a malformed color without mutating or persisting', () => {
		createUser('cosmo', 'pass');
		const id = findUserByUsername('cosmo').accountId;

		const res = updateProfile(id, { cosmetic: { bodyColor: 'notacolor' } });
		expect(res.ok).toBe(false);
		expect(findUserByAccountId(id).cosmetic.bodyColor).toBe('#4f9dde');
	});

	it('persists cosmetic across a simulated restart', () => {
		createUser('cosmo', 'pass');
		const id = findUserByUsername('cosmo').accountId;
		updateProfile(id, { cosmetic: { bodyColor: '#010203', bodyShape: 'capsule' } });

		clearUsers();
		loadUsers();

		const user = findUserByAccountId(id);
		expect(user.cosmetic.bodyColor).toBe('#010203');
		expect(user.cosmetic.bodyShape).toBe('capsule');
		expect(user.cosmetic.accentColor).toBe('#f2c94c');
	});

	it('backfills a complete cosmetic on a legacy record missing the field', () => {
		// Write a legacy record (no cosmetic) directly to disk, then load it.
		const legacy = [{ username: 'legacy', passwordHash: 'x', accountId: 'legacy-id' }];
		fs.writeFileSync(tmpFile, JSON.stringify(legacy), 'utf-8');
		clearUsers();
		loadUsers();

		const user = findUserByUsername('legacy');
		expect(user.cosmetic).toEqual({
			bodyColor: '#4f9dde',
			accentColor: '#f2c94c',
			bodyShape: 'box',
			hat: 'none',
			modelId: 'player',
			proportions: { height: 1.0, headSize: 1.0, torsoWidth: 1.0, armLength: 1.0, legLength: 1.0, shoulderWidth: 1.0 }
		});
	});

	it('backfills only the missing sub-fields on a partial legacy cosmetic', () => {
		const legacy = [{
			username: 'partial',
			passwordHash: 'x',
			accountId: 'partial-id',
			cosmetic: { bodyShape: 'cylinder' }
		}];
		fs.writeFileSync(tmpFile, JSON.stringify(legacy), 'utf-8');
		clearUsers();
		loadUsers();

		const user = findUserByUsername('partial');
		expect(user.cosmetic.bodyShape).toBe('cylinder');
		expect(user.cosmetic.bodyColor).toBe('#4f9dde');
		expect(user.cosmetic.accentColor).toBe('#f2c94c');
	});

	it('allows updating modelId through updateProfile', () => {
		createUser('model_user', 'pass');
		const id = findUserByUsername('model_user').accountId;

		const res = updateProfile(id, { cosmetic: { modelId: 'player' } });
		expect(res.ok).toBe(true);
		expect(findUserByAccountId(id).cosmetic.modelId).toBe('player');
	});

	it('allows updating proportions through updateProfile', () => {
		createUser('prop_user', 'pass');
		const id = findUserByUsername('prop_user').accountId;

		const res = updateProfile(id, { cosmetic: { proportions: { height: 1.1, headSize: 0.9 } } });
		expect(res.ok).toBe(true);
		const user = findUserByAccountId(id);
		expect(user.cosmetic.proportions.height).toBe(1.1);
		expect(user.cosmetic.proportions.headSize).toBe(0.9);
		// Non-provided keys retain defaults
		expect(user.cosmetic.proportions.torsoWidth).toBe(1.0);
	});

	it('allows partial proportions update (only provided keys replaced, others preserved)', () => {
		createUser('partial_prop', 'pass');
		const id = findUserByUsername('partial_prop').accountId;

		// First set all proportions to non-default values
		updateProfile(id, { cosmetic: { proportions: { height: 1.2, headSize: 1.1, torsoWidth: 0.8, armLength: 0.9, legLength: 1.0, shoulderWidth: 1.0 } } });
		// Then update only one key
		updateProfile(id, { cosmetic: { proportions: { height: 0.9 } } });

		const user = findUserByAccountId(id);
		expect(user.cosmetic.proportions.height).toBe(0.9);
		// Other keys preserved from previous update (deep merge)
		expect(user.cosmetic.proportions.headSize).toBe(1.1);
		expect(user.cosmetic.proportions.torsoWidth).toBe(0.8);
		expect(user.cosmetic.proportions.armLength).toBe(0.9);
	});

	it('rejects an unknown modelId without mutating', () => {
		createUser('bad_model', 'pass');
		const id = findUserByUsername('bad_model').accountId;

		const res = updateProfile(id, { cosmetic: { modelId: 'unknown_model' } });
		expect(res.ok).toBe(false);
		expect(findUserByAccountId(id).cosmetic.modelId).toBe('player');
	});

	it('rejects proportions with a value out of range', () => {
		createUser('bad_prop', 'pass');
		const id = findUserByUsername('bad_prop').accountId;

		const res = updateProfile(id, { cosmetic: { proportions: { height: 2.0 } } });
		expect(res.ok).toBe(false);
		expect(findUserByAccountId(id).cosmetic.proportions.height).toBe(1.0);
	});

	it('rejects proportions with an unknown key', () => {
		createUser('bad_prop_key', 'pass');
		const id = findUserByUsername('bad_prop_key').accountId;

		const res = updateProfile(id, { cosmetic: { proportions: { neckSize: 1.0 } } });
		expect(res.ok).toBe(false);
	});

	it('rejects proportions with a non-numeric value', () => {
		createUser('bad_prop_type', 'pass');
		const id = findUserByUsername('bad_prop_type').accountId;

		const res = updateProfile(id, { cosmetic: { proportions: { height: 'tall' } } });
		expect(res.ok).toBe(false);
	});

	it('rejects proportions that is not an object', () => {
		createUser('bad_prop_obj', 'pass');
		const id = findUserByUsername('bad_prop_obj').accountId;

		const res = updateProfile(id, { cosmetic: { proportions: 'all-big' } });
		expect(res.ok).toBe(false);
	});

	it('backfills modelId and proportions on a legacy record missing both', () => {
		const legacy = [{
			username: 'legacy_model',
			passwordHash: 'x',
			accountId: 'legacy-model-id',
			cosmetic: { bodyColor: '#ff0000' }
		}];
		fs.writeFileSync(tmpFile, JSON.stringify(legacy), 'utf-8');
		clearUsers();
		loadUsers();

		const user = findUserByUsername('legacy_model');
		expect(user.cosmetic.bodyColor).toBe('#ff0000');
		expect(user.cosmetic.modelId).toBe('player');
		expect(user.cosmetic.proportions).toEqual({
			height: 1.0, headSize: 1.0, torsoWidth: 1.0, armLength: 1.0, legLength: 1.0, shoulderWidth: 1.0
		});
	});

	it('persists modelId and proportions across a simulated restart', () => {
		createUser('persist_model', 'pass');
		const id = findUserByUsername('persist_model').accountId;
		updateProfile(id, { cosmetic: { modelId: 'player', proportions: { height: 1.15, shoulderWidth: 1.2 } } });

		clearUsers();
		loadUsers();

		const user = findUserByAccountId(id);
		expect(user.cosmetic.modelId).toBe('player');
		expect(user.cosmetic.proportions.height).toBe(1.15);
		expect(user.cosmetic.proportions.shoulderWidth).toBe(1.2);
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
