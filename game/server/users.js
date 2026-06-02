// User storage layer — in-memory Map with bcrypt password hashing.
// Persists user records to disk so accounts survive server restarts.

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let usersFilePath = process.env.USERS_FILE || path.join(__dirname, '..', 'data', 'users.json');

const users = new Map();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Cosmetic customization ──

// Allowed body shapes for a character. Validation rejects anything else.
const BODY_SHAPES = ['box', 'cylinder', 'cone', 'capsule'];

// Server-side hex color rule. Colors must be a 6-digit #RRGGBB string.
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

// Default cosmetic applied to new accounts and backfilled onto legacy records.
const DEFAULT_COSMETIC = {
	bodyColor: '#4f8fdf',
	accentColor: '#f0c040',
	bodyShape: 'capsule'
};

function isValidHexColor(value) {
	return typeof value === 'string' && HEX_COLOR_REGEX.test(value);
}

/**
 * Validate and normalize a partial cosmetic object. Unknown keys are ignored;
 * provided keys are validated strictly (invalid values are rejected, never
 * silently coerced). Hex colors are lower-cased for consistency.
 *
 * @param {object} partial
 * @returns {{ ok: true, value: object } | { ok: false, reason: string }}
 */
function normalizeCosmetic(partial) {
	if (partial === null || typeof partial !== 'object' || Array.isArray(partial)) {
		return { ok: false, reason: 'cosmetic must be an object' };
	}

	const value = {};

	if (partial.bodyColor !== undefined) {
		if (!isValidHexColor(partial.bodyColor)) {
			return { ok: false, reason: 'bodyColor must be a hex color like #4f8fdf' };
		}
		value.bodyColor = partial.bodyColor.toLowerCase();
	}

	if (partial.accentColor !== undefined) {
		if (!isValidHexColor(partial.accentColor)) {
			return { ok: false, reason: 'accentColor must be a hex color like #f0c040' };
		}
		value.accentColor = partial.accentColor.toLowerCase();
	}

	if (partial.bodyShape !== undefined) {
		if (!BODY_SHAPES.includes(partial.bodyShape)) {
			return { ok: false, reason: `bodyShape must be one of ${BODY_SHAPES.join(', ')}` };
		}
		value.bodyShape = partial.bodyShape;
	}

	return { ok: true, value };
}

/**
 * Return a complete cosmetic object, filling any missing/invalid keys from
 * DEFAULT_COSMETIC. Used to backfill legacy records on load.
 */
function withCosmeticDefaults(existing) {
	const source = (existing && typeof existing === 'object' && !Array.isArray(existing)) ? existing : {};
	return {
		bodyColor: isValidHexColor(source.bodyColor) ? source.bodyColor.toLowerCase() : DEFAULT_COSMETIC.bodyColor,
		accentColor: isValidHexColor(source.accentColor) ? source.accentColor.toLowerCase() : DEFAULT_COSMETIC.accentColor,
		bodyShape: BODY_SHAPES.includes(source.bodyShape) ? source.bodyShape : DEFAULT_COSMETIC.bodyShape
	};
}

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
			// Backfill cosmetic defaults onto legacy records missing the field.
			record.cosmetic = withCosmeticDefaults(record.cosmetic);
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
 * Async variant used by HTTP routes so password work does not block the
 * Socket.IO game loop.
 */
function hashPasswordAsync(plainPassword) {
	return bcrypt.hash(plainPassword, 10);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 * Returns true if the password matches, false otherwise.
 */
function comparePassword(plainPassword, hash) {
	return bcrypt.compareSync(plainPassword, hash);
}

/**
 * Async variant used by HTTP routes so login attempts cannot stall realtime
 * socket traffic.
 */
function comparePasswordAsync(plainPassword, hash) {
	return bcrypt.compare(plainPassword, hash);
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
		accountId,
		cosmetic: { ...DEFAULT_COSMETIC }
	};

	users.set(username, record);
	saveUsers();
	return { ok: true };
}

/**
 * Async create variant for HTTP registration. It checks for duplicate usernames
 * both before and after hashing so concurrent requests do not overwrite records.
 */
async function createUserAsync(username, plainPassword) {
	if (users.has(username)) {
		return { ok: false, reason: 'Username already taken' };
	}

	const passwordHash = await hashPasswordAsync(plainPassword);
	if (users.has(username)) {
		return { ok: false, reason: 'Username already taken' };
	}

	const accountId = crypto.randomUUID();
	const record = {
		username,
		passwordHash,
		accountId,
		cosmetic: { ...DEFAULT_COSMETIC }
	};

	users.set(username, record);
	saveUsers();
	return { ok: true, accountId };
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

	// Validate cosmetic up front (before any mutation) so an invalid value
	// rejects without touching the record.
	let cosmeticUpdate = null;
	if (fields.cosmetic !== undefined) {
		const result = normalizeCosmetic(fields.cosmetic);
		if (!result.ok) {
			return { ok: false, reason: result.reason };
		}
		cosmeticUpdate = result.value;
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

	if (cosmeticUpdate) {
		// Partial update: merge validated keys onto the existing cosmetic so
		// unspecified keys are left untouched.
		user.cosmetic = { ...withCosmeticDefaults(user.cosmetic), ...cosmeticUpdate };
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
	hashPasswordAsync,
	comparePassword,
	comparePasswordAsync,
	createUser,
	createUserAsync,
	findUserByUsername,
	findUserByAccountId,
	findUserByEmail,
	updateProfile,
	normalizeEmail,
	normalizeCosmetic,
	withCosmeticDefaults,
	DEFAULT_COSMETIC,
	BODY_SHAPES,
	clearUsers,
	loadUsers,
	saveUsers,
	getUsersFilePath,
	setTestFilePath
};
