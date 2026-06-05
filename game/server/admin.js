// Admin view building blocks — read-only roster aggregation and an
// ADMIN_PASSWORD-gated auth middleware. This is completely separate from the
// player JWT auth: it never reads `Authorization: Bearer` and never touches the
// player token. No HTTP route is wired here — only reusable, tested pieces.

const crypto = require('crypto');
const { getAllUsers } = require('./users');

/**
 * Default key item every account starts with. Mirrors the persistence default
 * used in progression.js so a brand-new account reads the same value here.
 */
const DEFAULT_KEY_ITEM_ID = 'dodge_roll';

/**
 * Build a read-only roster joining every account record with that account's
 * persisted character/progression data.
 *
 * The storage provider is looked up lazily (via `require('./index')`) to avoid
 * a circular require at module load time. This function is strictly read-only:
 * it never calls savePlayer/saveUsers and never mutates any account or player
 * record (account records arrive as detached copies from getAllUsers()).
 *
 * @returns {Array<object>} one entry per account.
 */
function buildAdminRoster() {
	// Lazy require to dodge the index.js ↔ admin.js circular dependency.
	const provider = require('./index').getProvider();
	const accounts = getAllUsers();

	return accounts.map((account) => {
		const accountId = account.accountId;

		let persisted = null;
		if (provider) {
			try {
				persisted = provider.loadPlayer(accountId);
			} catch (_err) {
				persisted = null;
			}
		}
		// Safe defaults when the account has never played (no persisted file).
		const player = persisted || {};

		return {
			username: account.username,
			accountId,
			email: account.email || null,
			cosmetic: account.cosmetic,
			unlockedHats: account.unlockedHats,
			unlockedQuestTiers: account.unlockedQuestTiers,
			currency: typeof player.currency === 'number' ? player.currency : 0,
			inventory: Array.isArray(player.inventory) ? player.inventory : [],
			ownedCards: player.ownedCards && typeof player.ownedCards === 'object' ? player.ownedCards : {},
			selectedDeck: Array.isArray(player.selectedDeck) ? player.selectedDeck : [],
			equippedKeyItemId: player.equippedKeyItemId || DEFAULT_KEY_ITEM_ID
		};
	});
}

/**
 * Constant-time string comparison. Returns false for unequal-length inputs
 * (length is checked before timingSafeEqual, which throws on length mismatch).
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeCompare(a, b) {
	const bufA = Buffer.from(String(a), 'utf-8');
	const bufB = Buffer.from(String(b), 'utf-8');
	if (bufA.length !== bufB.length) {
		return false;
	}
	return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Read the supplied admin password from the `x-admin-password` header or a
 * `?password=` query param.
 *
 * @param {object} req
 * @returns {string|null}
 */
function readSuppliedPassword(req) {
	const headerValue =
		(typeof req.get === 'function' && req.get('x-admin-password')) ||
		(req.headers && req.headers['x-admin-password']);
	if (headerValue) {
		return String(headerValue);
	}
	const queryValue = req.query && req.query.password;
	if (queryValue) {
		return String(queryValue);
	}
	return null;
}

/**
 * Express middleware gating admin-only routes behind the `ADMIN_PASSWORD` env
 * var. Fails closed: when `ADMIN_PASSWORD` is unset/empty, every request is
 * denied with HTTP 403. A wrong or missing supplied password is also denied;
 * only an exact (constant-time) match calls next(). It NEVER consults the
 * player JWT / `Authorization: Bearer` header.
 */
function requireAdminPassword(req, res, next) {
	const expected = process.env.ADMIN_PASSWORD;
	if (!expected) {
		// Fail closed — admin access is disabled unless an env password is set.
		return res.status(403).json({ error: 'Admin access disabled' });
	}

	const supplied = readSuppliedPassword(req);
	if (!supplied || !safeCompare(supplied, expected)) {
		return res.status(403).json({ error: 'Forbidden' });
	}

	return next();
}

module.exports = {
	buildAdminRoster,
	requireAdminPassword
};
