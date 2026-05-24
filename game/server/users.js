// User storage layer — identity-aware account records, in-memory indexes, and
// disk persistence.
//
// Design overview
// ---------------
// An *account* is the canonical user. Each account has zero or more
// *identities* — credentials a user can authenticate with. Today the supported
// identity providers are:
//
//   • `username` — local username + bcrypt password (the original auth flow).
//   • `email`    — email address + bcrypt password (this is the new option,
//                  positioned as the stepping stone toward SSO).
//
// Future SSO providers (Google, Discord, …) plug in by adding new provider
// strings with their own `subject` field (the external user id) and a null
// `passwordHash`. The `identities[]` array on a record is the contract that
// makes that extension non-disruptive.
//
// Persistence
// -----------
// Records are written to a single JSON file (atomic tmp+rename). On load the
// module migrates legacy records (`{username, passwordHash, accountId,
// email?}`) into the new shape transparently, so this refactor does not break
// existing deployments.

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let usersFilePath = process.env.USERS_FILE || path.join(__dirname, '..', 'data', 'users.json');

// ── Indexes (rebuilt on every load) ─────────────────────────────────────────
// All indexes use lowercase keys so lookups are case-insensitive but the
// stored record preserves the original casing the user typed.

/** @type {Map<string, object>} accountId → user record */
const byAccountId = new Map();
/** @type {Map<string, string>} lowercased username → accountId */
const byUsername = new Map();
/** @type {Map<string, string>} lowercased email → accountId */
const byEmail = new Map();
/** @type {Map<string, string>} `${provider}:${lowercased subject}` → accountId */
const byProviderSubject = new Map();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 32;

const IDENTITY_PROVIDERS = Object.freeze({
	USERNAME: 'username',
	EMAIL: 'email'
});

function normalizeEmail(email) {
	if (email === null || email === undefined || email === '') return null;
	return String(email).trim().toLowerCase();
}

function normalizeUsername(username) {
	if (username === null || username === undefined) return null;
	const trimmed = String(username).trim();
	return trimmed === '' ? null : trimmed;
}

function isValidEmail(email) {
	return typeof email === 'string' && EMAIL_REGEX.test(email);
}

function isValidUsername(username) {
	return typeof username === 'string'
		&& username.length >= USERNAME_MIN
		&& username.length <= USERNAME_MAX;
}

function providerKey(provider, subject) {
	return `${provider}:${String(subject).toLowerCase()}`;
}

/** Looks like an email if it contains an "@". */
function looksLikeEmail(identifier) {
	return typeof identifier === 'string' && identifier.includes('@');
}

// ── Index helpers ───────────────────────────────────────────────────────────

function indexRecord(record) {
	byAccountId.set(record.accountId, record);
	if (record.username) {
		byUsername.set(record.username.toLowerCase(), record.accountId);
	}
	if (record.email) {
		byEmail.set(record.email.toLowerCase(), record.accountId);
	}
	for (const ident of record.identities || []) {
		byProviderSubject.set(providerKey(ident.provider, ident.subject), record.accountId);
	}
}

function unindexRecord(record) {
	if (!record) return;
	byAccountId.delete(record.accountId);
	if (record.username) byUsername.delete(record.username.toLowerCase());
	if (record.email) byEmail.delete(record.email.toLowerCase());
	for (const ident of record.identities || []) {
		byProviderSubject.delete(providerKey(ident.provider, ident.subject));
	}
}

function rebuildIndexes(records) {
	byAccountId.clear();
	byUsername.clear();
	byEmail.clear();
	byProviderSubject.clear();
	for (const record of records) indexRecord(record);
}

// ── Migration ──────────────────────────────────────────────────────────────

/**
 * Convert a legacy `{ username, passwordHash, accountId, email? }` record into
 * the new identity-aware shape. Returns the same object if it is already in
 * the new shape (detected by presence of an `identities` array).
 */
function migrateRecord(raw) {
	if (raw && Array.isArray(raw.identities)) {
		// Defensive: synthesize a username identity for legacy in-place edits
		// where someone manually removed the password hash from identities[].
		if (raw.passwordHash && !raw.identities.some(i => i.provider === IDENTITY_PROVIDERS.USERNAME)) {
			raw.identities.push({
				provider: IDENTITY_PROVIDERS.USERNAME,
				subject: raw.username,
				passwordHash: raw.passwordHash,
				createdAt: raw.createdAt || Date.now()
			});
		}
		delete raw.passwordHash;
		return raw;
	}
	const now = Date.now();
	const migrated = {
		accountId: raw.accountId,
		username: raw.username,
		email: raw.email || null,
		identities: [],
		createdAt: raw.createdAt || now
	};
	if (raw.username && raw.passwordHash) {
		migrated.identities.push({
			provider: IDENTITY_PROVIDERS.USERNAME,
			subject: raw.username,
			passwordHash: raw.passwordHash,
			createdAt: migrated.createdAt
		});
	}
	// NOTE: legacy `email` is treated as contact-only — no credential identity
	// is implied. Users need to explicitly link an email login via the
	// `/api/me/identities/email` endpoint (or future SSO flow).
	return migrated;
}

// ── Disk I/O ───────────────────────────────────────────────────────────────

function loadUsers() {
	try {
		const raw = fs.readFileSync(usersFilePath, 'utf-8');
		const rawRecords = JSON.parse(raw);
		const migrated = [];
		let migrationsApplied = 0;
		for (const r of rawRecords) {
			const before = JSON.stringify(r);
			const m = migrateRecord(r);
			migrated.push(m);
			if (JSON.stringify(m) !== before) migrationsApplied++;
		}
		rebuildIndexes(migrated);
		console.log(`[users] Loaded ${byAccountId.size} user record(s) from ${usersFilePath}` +
			(migrationsApplied ? ` (migrated ${migrationsApplied} legacy record(s))` : ''));
		// Persist migrated form so subsequent reads avoid the migration step.
		if (migrationsApplied > 0) {
			try { saveUsers(); } catch (err) { console.error('[users] Failed to persist migrated records:', err.message); }
		}
	} catch (err) {
		if (err.code === 'ENOENT') {
			console.log(`[users] No existing user file at ${usersFilePath} — starting fresh`);
		} else {
			console.error(`[users] Failed to load users from ${usersFilePath}:`, err.message);
		}
	}
}

function saveUsers() {
	const records = Array.from(byAccountId.values());
	const json = JSON.stringify(records, null, 2);
	const dir = path.dirname(usersFilePath);
	fs.mkdirSync(dir, { recursive: true });
	const tmpPath = usersFilePath + '.tmp';
	fs.writeFileSync(tmpPath, json, 'utf-8');
	fs.renameSync(tmpPath, usersFilePath);
}

loadUsers();

// ── Password hashing ────────────────────────────────────────────────────────

function hashPassword(plainPassword) {
	return bcrypt.hashSync(plainPassword, 10);
}

function hashPasswordAsync(plainPassword) {
	return bcrypt.hash(plainPassword, 10);
}

function comparePassword(plainPassword, hash) {
	return bcrypt.compareSync(plainPassword, hash);
}

function comparePasswordAsync(plainPassword, hash) {
	return bcrypt.compare(plainPassword, hash);
}

// ── Identity helpers ────────────────────────────────────────────────────────

/**
 * Find an identity on a record by provider + subject (case-insensitive).
 * @returns {object|null}
 */
function findIdentity(record, provider, subject) {
	if (!record || !Array.isArray(record.identities)) return null;
	const normalizedSubject = String(subject || '').toLowerCase();
	for (const ident of record.identities) {
		if (ident.provider === provider
			&& String(ident.subject || '').toLowerCase() === normalizedSubject) {
			return ident;
		}
	}
	return null;
}

/** Derive a default username from an email when only an email is supplied. */
function deriveUsernameFromEmail(email) {
	const localPart = String(email).split('@')[0] || 'user';
	const sanitized = localPart.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, USERNAME_MAX - 4);
	const base = sanitized.length >= USERNAME_MIN ? sanitized : 'user';
	if (!byUsername.has(base.toLowerCase())) return base;
	// Collision — append a short random suffix.
	for (let attempt = 0; attempt < 5; attempt++) {
		const suffix = crypto.randomBytes(2).toString('hex'); // 4 chars
		const candidate = `${base.slice(0, USERNAME_MAX - 5)}-${suffix}`;
		if (!byUsername.has(candidate.toLowerCase())) return candidate;
	}
	return `${base.slice(0, USERNAME_MAX - 9)}-${crypto.randomBytes(4).toString('hex')}`;
}

// ── Account creation ────────────────────────────────────────────────────────

/**
 * Create a user with a username identity (the original flow).
 * Synchronous variant retained for callers that don't need async hashing.
 */
function createUser(username, plainPassword) {
	if (!isValidUsername(username)) {
		return { ok: false, reason: 'Username must be 3–32 characters' };
	}
	if (byUsername.has(username.toLowerCase())) {
		return { ok: false, reason: 'Username already taken' };
	}

	const passwordHash = hashPassword(plainPassword);
	const accountId = crypto.randomUUID();
	const now = Date.now();
	const record = {
		accountId,
		username,
		email: null,
		identities: [
			{ provider: IDENTITY_PROVIDERS.USERNAME, subject: username, passwordHash, createdAt: now }
		],
		createdAt: now
	};
	indexRecord(record);
	saveUsers();
	return { ok: true, accountId };
}

async function createUserAsync(username, plainPassword) {
	if (!isValidUsername(username)) {
		return { ok: false, reason: 'Username must be 3–32 characters' };
	}
	if (byUsername.has(username.toLowerCase())) {
		return { ok: false, reason: 'Username already taken' };
	}

	const passwordHash = await hashPasswordAsync(plainPassword);
	if (byUsername.has(username.toLowerCase())) {
		return { ok: false, reason: 'Username already taken' };
	}

	const accountId = crypto.randomUUID();
	const now = Date.now();
	const record = {
		accountId,
		username,
		email: null,
		identities: [
			{ provider: IDENTITY_PROVIDERS.USERNAME, subject: username, passwordHash, createdAt: now }
		],
		createdAt: now
	};
	indexRecord(record);
	saveUsers();
	return { ok: true, accountId };
}

/**
 * Create an account anchored on an email identity. If no username is supplied
 * one is derived from the email local-part with a uniqueness check.
 *
 * @param {{ email: string, password: string, username?: string }} args
 * @returns {{ ok: true, accountId: string, username: string } | { ok: false, reason: string }}
 */
function createAccountWithEmail({ email, password, username }) {
	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
		return { ok: false, reason: 'Invalid email format' };
	}
	if (byEmail.has(normalizedEmail)) {
		return { ok: false, reason: 'Email already in use' };
	}

	let finalUsername = normalizeUsername(username) || deriveUsernameFromEmail(normalizedEmail);
	if (!isValidUsername(finalUsername)) {
		return { ok: false, reason: 'Username must be 3–32 characters' };
	}
	if (byUsername.has(finalUsername.toLowerCase())) {
		return { ok: false, reason: 'Username already taken' };
	}

	const passwordHash = hashPassword(password);
	const accountId = crypto.randomUUID();
	const now = Date.now();
	const record = {
		accountId,
		username: finalUsername,
		email: normalizedEmail,
		identities: [
			{ provider: IDENTITY_PROVIDERS.EMAIL, subject: normalizedEmail, passwordHash, createdAt: now }
		],
		createdAt: now
	};
	indexRecord(record);
	saveUsers();
	return { ok: true, accountId, username: finalUsername };
}

/**
 * Async variant for HTTP routes.
 */
async function createAccountWithEmailAsync({ email, password, username }) {
	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
		return { ok: false, reason: 'Invalid email format' };
	}
	if (byEmail.has(normalizedEmail)) {
		return { ok: false, reason: 'Email already in use' };
	}

	let finalUsername = normalizeUsername(username) || deriveUsernameFromEmail(normalizedEmail);
	if (!isValidUsername(finalUsername)) {
		return { ok: false, reason: 'Username must be 3–32 characters' };
	}
	if (byUsername.has(finalUsername.toLowerCase())) {
		return { ok: false, reason: 'Username already taken' };
	}

	const passwordHash = await hashPasswordAsync(password);
	if (byEmail.has(normalizedEmail) || byUsername.has(finalUsername.toLowerCase())) {
		return { ok: false, reason: 'Email already in use' };
	}

	const accountId = crypto.randomUUID();
	const now = Date.now();
	const record = {
		accountId,
		username: finalUsername,
		email: normalizedEmail,
		identities: [
			{ provider: IDENTITY_PROVIDERS.EMAIL, subject: normalizedEmail, passwordHash, createdAt: now }
		],
		createdAt: now
	};
	indexRecord(record);
	saveUsers();
	return { ok: true, accountId, username: finalUsername };
}

/**
 * Attach an email-login identity to an existing account. Used so a username-
 * registered player can later "graduate" to email login (the natural lead-in
 * to SSO).
 *
 * @param {string} accountId
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
async function linkEmailIdentity(accountId, email, password) {
	const record = byAccountId.get(accountId);
	if (!record) return { ok: false, reason: 'Account not found' };

	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
		return { ok: false, reason: 'Invalid email format' };
	}
	if (findIdentity(record, IDENTITY_PROVIDERS.EMAIL, normalizedEmail)) {
		return { ok: false, reason: 'Email identity already linked' };
	}
	const owner = byEmail.get(normalizedEmail);
	if (owner && owner !== accountId) {
		return { ok: false, reason: 'Email already in use' };
	}

	const passwordHash = await hashPasswordAsync(password);

	// Re-check after async work
	if (findIdentity(record, IDENTITY_PROVIDERS.EMAIL, normalizedEmail)) {
		return { ok: false, reason: 'Email identity already linked' };
	}
	const ownerAfter = byEmail.get(normalizedEmail);
	if (ownerAfter && ownerAfter !== accountId) {
		return { ok: false, reason: 'Email already in use' };
	}

	const now = Date.now();
	record.identities.push({
		provider: IDENTITY_PROVIDERS.EMAIL,
		subject: normalizedEmail,
		passwordHash,
		createdAt: now
	});
	// Set the contact email if not already set, and keep the email index fresh.
	if (!record.email) {
		record.email = normalizedEmail;
	}
	byEmail.set(normalizedEmail, accountId);
	byProviderSubject.set(providerKey(IDENTITY_PROVIDERS.EMAIL, normalizedEmail), accountId);
	saveUsers();
	return { ok: true };
}

// ── Lookups ────────────────────────────────────────────────────────────────

function findUserByUsername(username) {
	if (!username || typeof username !== 'string') return null;
	const accountId = byUsername.get(username.toLowerCase());
	return accountId ? byAccountId.get(accountId) : null;
}

function findUserByAccountId(accountId) {
	return byAccountId.get(accountId) || null;
}

function findUserByEmail(email) {
	const normalized = normalizeEmail(email);
	if (!normalized) return null;
	const accountId = byEmail.get(normalized);
	return accountId ? byAccountId.get(accountId) : null;
}

/**
 * Look up an account by an arbitrary identifier (email or username). Used by
 * the unified login endpoint and `/api/me` flows.
 */
function findUserByIdentifier(identifier) {
	if (!identifier || typeof identifier !== 'string') return null;
	return looksLikeEmail(identifier)
		? findUserByEmail(identifier)
		: findUserByUsername(identifier);
}

/**
 * Verify a plaintext password against the identity the caller is logging in
 * with. Picks the email identity for email-like identifiers, the username
 * identity otherwise. Falls back to any identity that has a password hash so
 * legacy accounts (with only a username identity) still work when the user
 * types their username.
 */
async function verifyPasswordForIdentifier(record, identifier, plainPassword) {
	if (!record || !Array.isArray(record.identities) || record.identities.length === 0) {
		return false;
	}
	const provider = looksLikeEmail(identifier)
		? IDENTITY_PROVIDERS.EMAIL
		: IDENTITY_PROVIDERS.USERNAME;
	let identity = findIdentity(record, provider, identifier);
	if (!identity) {
		// Fall back to any other local-password identity on the account so
		// legacy records (pre-migration) and accounts that linked extra
		// identities still authenticate.
		identity = record.identities.find(i => i.passwordHash);
	}
	if (!identity || !identity.passwordHash) return false;
	return comparePasswordAsync(plainPassword, identity.passwordHash);
}

// ── Profile updates ─────────────────────────────────────────────────────────

/**
 * Update profile fields for an account.
 *
 * Setting `email` here only changes the *contact* email — it does not create
 * an email credential. Use `linkEmailIdentity` for that.
 *
 * @param {string} accountId
 * @param {{ username?: string, email?: string|null }} fields
 */
function updateProfile(accountId, fields) {
	const record = byAccountId.get(accountId);
	if (!record) return { ok: false, reason: 'Account not found' };

	let usernameChanged = false;

	if (fields.username !== undefined) {
		const newUsername = fields.username;
		if (!isValidUsername(newUsername)) {
			return { ok: false, reason: 'Username must be 3–32 characters' };
		}
		if (newUsername !== record.username) {
			const existing = byUsername.get(newUsername.toLowerCase());
			if (existing && existing !== accountId) {
				return { ok: false, reason: 'Username already taken' };
			}
			byUsername.delete(record.username.toLowerCase());
			// If the user authenticates via the `username` identity, update its
			// subject so future logins with the new username still resolve.
			for (const ident of record.identities) {
				if (ident.provider === IDENTITY_PROVIDERS.USERNAME
					&& String(ident.subject).toLowerCase() === record.username.toLowerCase()) {
					byProviderSubject.delete(providerKey(IDENTITY_PROVIDERS.USERNAME, ident.subject));
					ident.subject = newUsername;
					byProviderSubject.set(providerKey(IDENTITY_PROVIDERS.USERNAME, newUsername), accountId);
				}
			}
			record.username = newUsername;
			byUsername.set(newUsername.toLowerCase(), accountId);
			usernameChanged = true;
		}
	}

	if (fields.email !== undefined) {
		const normalized = normalizeEmail(fields.email);
		if (normalized && !isValidEmail(normalized)) {
			return { ok: false, reason: 'Invalid email format' };
		}
		if (normalized) {
			const existing = byEmail.get(normalized);
			if (existing && existing !== accountId) {
				return { ok: false, reason: 'Email already in use' };
			}
		}
		if (record.email) byEmail.delete(record.email.toLowerCase());
		record.email = normalized;
		if (normalized) byEmail.set(normalized, accountId);
	}

	saveUsers();
	return { ok: true, usernameChanged };
}

// ── Test helpers ────────────────────────────────────────────────────────────

function clearUsers() {
	byAccountId.clear();
	byUsername.clear();
	byEmail.clear();
	byProviderSubject.clear();
}

function getUsersFilePath() {
	return usersFilePath;
}

/**
 * Override the users file path (test-only).
 */
function setTestFilePath(filePath) {
	usersFilePath = filePath;
	clearUsers();
	loadUsers();
}

module.exports = {
	IDENTITY_PROVIDERS,
	hashPassword,
	hashPasswordAsync,
	comparePassword,
	comparePasswordAsync,
	createUser,
	createUserAsync,
	createAccountWithEmail,
	createAccountWithEmailAsync,
	linkEmailIdentity,
	findUserByUsername,
	findUserByAccountId,
	findUserByEmail,
	findUserByIdentifier,
	verifyPasswordForIdentifier,
	updateProfile,
	normalizeEmail,
	isValidEmail,
	isValidUsername,
	looksLikeEmail,
	clearUsers,
	loadUsers,
	saveUsers,
	getUsersFilePath,
	setTestFilePath
};
