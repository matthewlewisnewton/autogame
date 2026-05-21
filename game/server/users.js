// User storage layer — in-memory Map with bcrypt password hashing.
// Provides the pure-data foundation for all later auth sub-tickets.

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const users = new Map();

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
 * Clear all users from the in-memory store (test-only).
 */
function clearUsers() {
	users.clear();
}

module.exports = {
	hashPassword,
	comparePassword,
	createUser,
	findUserByUsername,
	clearUsers
};
