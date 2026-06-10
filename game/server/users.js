// User storage layer — in-memory Map with bcrypt password hashing.
// Persists user records to disk so accounts survive server restarts.

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
	DEFAULT_COSMETIC,
	DEFAULT_UNLOCKED_HATS,
	HAT_IDS,
	validateCosmetic,
	backfillCosmetic,
	backfillUnlockedHats
} = require('./cosmetic');
const { isValidQuestId, isValidQuestSelection, normalizeUnlockRequires, getQuest } = require('./quests');

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
 * Normalize persisted quest-tier unlock map: quest id → deduped tier numbers ≥ 2.
 * Tier 1 is never stored (always available). Invalid keys/tiers are dropped.
 *
 * @param {Record<string, number[]>|undefined|null} existing
 * @returns {Record<string, number[]>}
 */
function backfillUnlockedQuestTiers(existing) {
	const out = {};
	if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
		return out;
	}
	for (const questId of Object.keys(existing)) {
		if (!isValidQuestId(questId)) {
			continue;
		}
		const rawTiers = existing[questId];
		if (!Array.isArray(rawTiers)) {
			continue;
		}
		const tiers = [];
		const seen = new Set();
		for (const tier of rawTiers) {
			const n = Number(tier);
			if (!Number.isInteger(n) || n < 2) {
				continue;
			}
			if (!isValidQuestSelection(questId, n)) {
				continue;
			}
			if (!seen.has(n)) {
				seen.add(n);
				tiers.push(n);
			}
		}
		if (tiers.length > 0) {
			tiers.sort((a, b) => a - b);
			out[questId] = tiers;
		}
	}
	return out;
}

/**
 * Normalize persisted quest-tier completion map: quest id → deduped completed tier numbers.
 * Invalid keys/tiers are dropped.
 *
 * @param {Record<string, number[]>|undefined|null} existing
 * @returns {Record<string, number[]>}
 */
function backfillCompletedQuestTiers(existing) {
	const out = {};
	if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
		return out;
	}
	for (const questId of Object.keys(existing)) {
		if (!isValidQuestId(questId)) {
			continue;
		}
		const rawTiers = existing[questId];
		if (!Array.isArray(rawTiers)) {
			continue;
		}
		const tiers = [];
		const seen = new Set();
		for (const tier of rawTiers) {
			const n = Number(tier);
			if (!Number.isInteger(n) || n < 1) {
				continue;
			}
			if (!isValidQuestSelection(questId, n)) {
				continue;
			}
			if (!seen.has(n)) {
				seen.add(n);
				tiers.push(n);
			}
		}
		if (tiers.length > 0) {
			tiers.sort((a, b) => a - b);
			out[questId] = tiers;
		}
	}
	return out;
}

function normalizeUnlockTier(tier) {
	const n = Number(tier);
	return Number.isInteger(n) && n > 0 ? n : null;
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
			// Backfill cosmetic on legacy records missing it (or missing fields).
			record.cosmetic = backfillCosmetic(record.cosmetic);
			// Backfill unlocked hats on legacy records (or missing/invalid values).
			record.unlockedHats = backfillUnlockedHats(record.unlockedHats);
			record.unlockedQuestTiers = backfillUnlockedQuestTiers(record.unlockedQuestTiers);
			record.completedQuestTiers = backfillCompletedQuestTiers(record.completedQuestTiers);
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
 * pattern (write to a unique .tmp file, then rename). Creates parent directories if needed.
 */
function saveUsers() {
	const records = Array.from(users.values());
	const json = JSON.stringify(records, null, 2);
	const dir = path.dirname(usersFilePath);
	fs.mkdirSync(dir, { recursive: true });
	const tmpPath = `${usersFilePath}.${process.pid}.${Date.now()}.tmp`;
	try {
		fs.writeFileSync(tmpPath, json, 'utf-8');
		fs.renameSync(tmpPath, usersFilePath);
	} catch (err) {
		try { fs.unlinkSync(tmpPath); } catch (_) {}
		throw err;
	}
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
		cosmetic: { ...DEFAULT_COSMETIC },
		unlockedHats: [...DEFAULT_UNLOCKED_HATS],
		unlockedQuestTiers: {},
		completedQuestTiers: {}
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
		cosmetic: { ...DEFAULT_COSMETIC },
		unlockedHats: [...DEFAULT_UNLOCKED_HATS],
		unlockedQuestTiers: {},
		completedQuestTiers: {}
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
 * @param {{ username?: string, email?: string|null, cosmetic?: object }} fields
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

	if (fields.cosmetic !== undefined) {
		const result = validateCosmetic(fields.cosmetic);
		if (!result.ok) {
			return { ok: false, reason: result.reason };
		}
		// Equipping a hat is only allowed for hats the account has unlocked.
		if (result.value.hat !== undefined) {
			const unlocked = backfillUnlockedHats(user.unlockedHats);
			if (!unlocked.includes(result.value.hat)) {
				return { ok: false, reason: 'Hat is not unlocked for this account' };
			}
		}
		// Merge only the provided sub-fields onto the existing cosmetic.
		const base = backfillCosmetic(user.cosmetic);
		// Deep-merge proportions so a partial update (e.g. { height: 1.1 })
		// does not erase other keys (armLength, legLength, …).
		if (result.value.proportions && typeof result.value.proportions === 'object') {
			user.cosmetic = {
				...base,
				...result.value,
				proportions: { ...base.proportions, ...result.value.proportions }
			};
		} else {
			user.cosmetic = { ...base, ...result.value };
		}
	}

	saveUsers();
	return { ok: true, usernameChanged };
}

/**
 * Permanently record a hat unlock on an account. Validates the account exists
 * and the hatId is a known catalog id; appends to `unlockedHats` (deduped) and
 * persists. Idempotent — unlocking an already-unlocked hat is a success and
 * leaves the list unchanged.
 *
 * @param {string} accountId
 * @param {string} hatId
 * @returns {{ ok: true, unlockedHats: string[] } | { ok: false, reason: string }}
 */
function unlockHat(accountId, hatId) {
	const user = findUserByAccountId(accountId);
	if (!user) {
		return { ok: false, reason: 'Account not found' };
	}
	if (typeof hatId !== 'string' || !HAT_IDS.has(hatId)) {
		return { ok: false, reason: 'Unknown hat id' };
	}

	user.unlockedHats = backfillUnlockedHats(user.unlockedHats);
	if (!user.unlockedHats.includes(hatId)) {
		user.unlockedHats.push(hatId);
		saveUsers();
	}

	return { ok: true, unlockedHats: user.unlockedHats };
}

/**
 * Return the persisted quest-tier unlock map for an account (tiers ≥ 2 only).
 *
 * @param {string} accountId
 * @returns {Record<string, number[]>|null}
 */
function getUnlockedQuestTiers(accountId) {
	const user = findUserByAccountId(accountId);
	if (!user) {
		return null;
	}
	return backfillUnlockedQuestTiers(user.unlockedQuestTiers);
}

/**
 * Whether a quest tier is available for an account. Tier 1 is always unlocked
 * for valid catalog quests; higher tiers require a persisted unlock and every
 * `unlockRequires` prerequisite on that tier to be completed.
 *
 * @param {string} accountId
 * @param {string} questId
 * @param {number} tier
 * @returns {boolean}
 */
function isQuestTierUnlocked(accountId, questId, tier) {
	const normalizedTier = normalizeUnlockTier(tier);
	if (normalizedTier === null || !isValidQuestSelection(questId, normalizedTier)) {
		return false;
	}
	if (normalizedTier === 1) {
		return true;
	}
	const user = findUserByAccountId(accountId);
	if (!user) {
		return false;
	}
	const map = backfillUnlockedQuestTiers(user.unlockedQuestTiers);
	const tiers = map[questId];
	if (!Array.isArray(tiers) || !tiers.includes(normalizedTier)) {
		return false;
	}
	const quest = getQuest(questId, normalizedTier);
	if (!quest) {
		return false;
	}
	return areUnlockPrereqsMet(accountId, quest.unlockRequires);
}

/**
 * Record a quest tier unlock on an account. Validates catalog ids; tier 1 is
 * never stored (always available). Idempotent for duplicate unlocks.
 *
 * @param {string} accountId
 * @param {string} questId
 * @param {number} tier
 * @returns {{ ok: true, unlockedQuestTiers: Record<string, number[]> } | { ok: false, reason: string }}
 */
function unlockQuestTier(accountId, questId, tier) {
	const user = findUserByAccountId(accountId);
	if (!user) {
		return { ok: false, reason: 'Account not found' };
	}
	const normalizedTier = normalizeUnlockTier(tier);
	if (normalizedTier === null || !isValidQuestSelection(questId, normalizedTier)) {
		return { ok: false, reason: 'Unknown quest or tier' };
	}

	user.unlockedQuestTiers = backfillUnlockedQuestTiers(user.unlockedQuestTiers);

	if (normalizedTier === 1) {
		return { ok: true, unlockedQuestTiers: user.unlockedQuestTiers };
	}

	const existing = user.unlockedQuestTiers[questId] || [];
	if (!existing.includes(normalizedTier)) {
		user.unlockedQuestTiers = {
			...user.unlockedQuestTiers,
			[questId]: [...existing, normalizedTier].sort((a, b) => a - b)
		};
		saveUsers();
	}

	return { ok: true, unlockedQuestTiers: user.unlockedQuestTiers };
}

/**
 * Record quest-tier completion on an account. Validates catalog ids; idempotent.
 *
 * @param {string} accountId
 * @param {string} questId
 * @param {number} tier
 * @returns {{ ok: true, completedQuestTiers: Record<string, number[]> } | { ok: false, reason: string }}
 */
function completeQuestTier(accountId, questId, tier) {
	const user = findUserByAccountId(accountId);
	if (!user) {
		return { ok: false, reason: 'Account not found' };
	}
	const normalizedTier = normalizeUnlockTier(tier);
	if (normalizedTier === null || !isValidQuestSelection(questId, normalizedTier)) {
		return { ok: false, reason: 'Unknown quest or tier' };
	}

	user.completedQuestTiers = backfillCompletedQuestTiers(user.completedQuestTiers);

	const existing = user.completedQuestTiers[questId] || [];
	if (!existing.includes(normalizedTier)) {
		user.completedQuestTiers = {
			...user.completedQuestTiers,
			[questId]: [...existing, normalizedTier].sort((a, b) => a - b)
		};
		saveUsers();
	}

	return { ok: true, completedQuestTiers: user.completedQuestTiers };
}

/**
 * Whether an account has completed a quest tier. Tier N completion is indicated
 * by a persisted unlock for tier N+1 (or higher) on the same quest id.
 *
 * @param {string} accountId
 * @param {string} questId
 * @param {number} tier
 * @returns {boolean}
 */
function hasCompletedQuestTier(accountId, questId, tier) {
	const normalizedTier = normalizeUnlockTier(tier);
	if (normalizedTier === null || !isValidQuestSelection(questId, normalizedTier)) {
		return false;
	}
	const user = findUserByAccountId(accountId);
	if (!user) {
		return false;
	}
	const completedMap = backfillCompletedQuestTiers(user.completedQuestTiers);
	const completedTiers = completedMap[questId];
	if (Array.isArray(completedTiers) && completedTiers.includes(normalizedTier)) {
		return true;
	}
	const map = backfillUnlockedQuestTiers(user.unlockedQuestTiers);
	const tiers = map[questId];
	if (!Array.isArray(tiers) || tiers.length === 0) {
		return false;
	}
	return tiers.some((unlockedTier) => unlockedTier > normalizedTier);
}

/**
 * Whether every normalized unlock prerequisite is completed (AND semantics).
 * Missing or invalid `unlockRequires` values are treated as no prerequisites.
 *
 * @param {string} accountId
 * @param {import('./quests').UnlockRequires | null | undefined} unlockRequires
 * @returns {boolean}
 */
function areUnlockPrereqsMet(accountId, unlockRequires) {
	const prereqs = normalizeUnlockRequires(unlockRequires);
	if (!prereqs) {
		return true;
	}
	return prereqs.every((entry) => hasCompletedQuestTier(accountId, entry.questId, entry.tier));
}

/**
 * Return a snapshot of every in-memory account record as shallow copies.
 * The copies are detached from the live Map values so callers (e.g. the admin
 * roster) cannot mutate stored accounts. The bcrypt `passwordHash` is stripped
 * so it never leaks into read-only views.
 *
 * @returns {object[]}
 */
function getAllUsers() {
	return Array.from(users.values()).map((record) => {
		const { passwordHash, ...rest } = record;
		return { ...rest };
	});
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
	unlockHat,
	getUnlockedQuestTiers,
	isQuestTierUnlocked,
	unlockQuestTier,
	completeQuestTier,
	hasCompletedQuestTier,
	areUnlockPrereqsMet,
	normalizeEmail,
	getAllUsers,
	clearUsers,
	loadUsers,
	saveUsers,
	getUsersFilePath,
	setTestFilePath
};
