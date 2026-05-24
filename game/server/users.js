// User storage layer — in-memory Map with bcrypt password hashing.
// Persists user records to disk so accounts survive server restarts.

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let usersFilePath = process.env.USERS_FILE || path.join(__dirname, '..', 'data', 'users.json');

const users = new Map();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
	if (email === null || email === undefined || email === '') return null;
	return String(email).trim().toLowerCase();
}

function isValidUsername(username) {
	return typeof username === 'string' && username.length >= 3 && username.length <= 32;
}

/**
 * Load existing user records from disk into the in-memory Map.
 * Silently ignores file-not-found errors (first run). Logs other errors.
 * Called automatically at module initialization.
 */
function loadUsers() {
	try {
		const raw = fs.readFileSync(usersFilePath, 'utf-8');
		const records = JSON.parse(raw);
		for (const record of records) {
			users.set(record.username, record);
		}
		console.log(`[users] Loaded ${users.size} user record(s) from ${usersFilePath}`);
	} catch (err) {
		if (err.code === 'ENOENT') {
			console.log(`[users] No existing user file at ${usersFilePath} — starting fresh`);
		} else {
			console.error(`[users] Failed to load users from ${usersFilePath}:`, err.message);
		}
	}
}

/**
 * Serialize the in-memory user Map to a JSON file using an atomic write
 * pattern (write to .tmp, then rename). Creates parent directories if needed.
 */
function saveUsers() {
	const records = Array.from(users.values());
	const json = JSON.stringify(records, null, 2);
	const dir = path.dirname(usersFilePath);
	fs.mkdirSync(dir, { recursive: true });
	const tmpPath = usersFilePath + '.tmp';
	fs.writeFileSync(tmpPath, json, 'utf-8');
	fs.renameSync(tmpPath, usersFilePath);
}

// Load existing users on module initialization.
loadUsers();

/**
 * Hash a plaintext password using bcrypt with a cost factor of 10.
 * Returns a bcrypt hash string.
 */
function hashPassword(plainPassword) {
	return bcrypt.hashSync(plainPassword, 10);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 * Returns true if the password matches, false otherwise.
 */
function comparePassword(plainPassword, hash) {
	return bcrypt.compareSync(plainPassword, hash);
}

/**
 * Create a new user record with the given username and password.
 * Persists the new record to disk immediately after adding it to the in-memory map.
 *
 * Returns { ok: true } on success.
 * Returns { ok: false, reason: 'Username already taken' } if the username exists.
 */
function createUser(username, plainPassword) {
	if (users.has(username)) {
		return { ok: false, reason: 'Username already taken' };
	}

	const passwordHash = hashPassword(plainPassword);
	const accountId = crypto.randomUUID();

	const record = {
		username,
		passwordHash,
		accountId
	};

	users.set(username, record);
	saveUsers();
	return { ok: true };
}

/**
 * Find a user record by username.
 * Returns the user record object or null if not found.
 */
function findUserByUsername(username) {
	return users.get(username) || null;
}

/**
 * Find a user record by accountId.
 * @param {string} accountId
 * @returns {object|null}
 */
function findUserByAccountId(accountId) {
	for (const record of users.values()) {
		if (record.accountId === accountId) return record;
	}
	return null;
}

/**
 * Find a user record by normalized email.
 * @param {string} email - raw or normalized email
 * @returns {object|null}
 */
function findUserByEmail(email) {
	const normalized = normalizeEmail(email);
	if (!normalized) return null;
	for (const record of users.values()) {
		if (record.email === normalized) return record;
	}
	return null;
}

/**
 * Update profile fields for an account.
 * @param {string} accountId
 * @param {{ username?: string, email?: string|null }} fields
 * @returns {{ ok: true, usernameChanged?: boolean } | { ok: false, reason: string }}
 */
function updateProfile(accountId, fields) {
	const user = findUserByAccountId(accountId);
	if (!user) {
		return { ok: false, reason: 'Account not found' };
	}

	let usernameChanged = false;
	const oldUsername = user.username;

	if (fields.username !== undefined) {
		const newUsername = fields.username;
		if (!isValidUsername(newUsername)) {
			return { ok: false, reason: 'Username must be 3–32 characters' };
		}
		if (newUsername !== oldUsername) {
			if (users.has(newUsername)) {
				return { ok: false, reason: 'Username already taken' };
			}
			users.delete(oldUsername);
			user.username = newUsername;
			users.set(newUsername, user);
			usernameChanged = true;
		}
	}

	if (fields.email !== undefined) {
		const normalized = normalizeEmail(fields.email);
		if (normalized && !EMAIL_REGEX.test(normalized)) {
			return { ok: false, reason: 'Invalid email format' };
		}
		if (normalized) {
			const existing = findUserByEmail(normalized);
			if (existing && existing.accountId !== accountId) {
				return { ok: false, reason: 'Email already in use' };
			}
		}
		user.email = normalized;
	}

	saveUsers();
	return { ok: true, usernameChanged };
}

/**
 * Clear all users from the in-memory store (test-only).
 */
function clearUsers() {
	users.clear();
}

/**
 * Return the configured path to the users JSON file.
 * Useful for test cleanup.
 */
function getUsersFilePath() {
	return usersFilePath;
}

/**
 * Override the users file path (test-only). After calling this,
 * subsequent loadUsers() / saveUsers() / createUser() use the new path.
 * Also clears the in-memory map and attempts to load from the new path
 * so that a fresh temp file starts with an empty store.
 */
function setTestFilePath(filePath) {
	usersFilePath = filePath;
	users.clear();
	loadUsers();
}

module.exports = {
	hashPassword,
	comparePassword,
	createUser,
	findUserByUsername,
	findUserByAccountId,
	findUserByEmail,
	updateProfile,
	normalizeEmail,
	clearUsers,
	loadUsers,
	saveUsers,
	getUsersFilePath,
	setTestFilePath
};
