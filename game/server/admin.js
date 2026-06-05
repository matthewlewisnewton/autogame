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
 * Escape a value for safe interpolation into HTML text/attribute content.
 * Coerces to string first so numbers/objects don't throw.
 *
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Pretty-print a JS value (object/array) as escaped HTML for read-only display.
 *
 * @param {*} value
 * @returns {string}
 */
function renderJson(value) {
	return escapeHtml(JSON.stringify(value, null, 2));
}

/**
 * Render the full admin roster as a static, read-only HTML document. Contains
 * no forms, buttons, or scripts — purely a server-rendered view of the data.
 * Defensively strips `passwordHash` should it ever appear on an entry.
 *
 * @param {Array<object>} roster
 * @returns {string} a complete HTML document
 */
function renderAdminRosterHtml(roster) {
	const rows = roster
		.map((rawEntry) => {
			// Defensive: never leak a password hash even if upstream adds it.
			const { passwordHash, ...entry } = rawEntry || {};
			const cosmetic = entry.cosmetic && typeof entry.cosmetic === 'object' ? entry.cosmetic : {};
			const equippedHat = cosmetic.hat !== undefined && cosmetic.hat !== null ? cosmetic.hat : 'none';
			return `
		<section class="account">
			<h2>${escapeHtml(entry.username)}</h2>
			<table>
				<tr><th>Account ID</th><td>${escapeHtml(entry.accountId)}</td></tr>
				<tr><th>Email</th><td>${escapeHtml(entry.email === null || entry.email === undefined ? '—' : entry.email)}</td></tr>
				<tr><th>Currency</th><td>${escapeHtml(entry.currency)}</td></tr>
				<tr><th>Equipped hat</th><td>${escapeHtml(equippedHat)}</td></tr>
				<tr><th>Cosmetic</th><td><pre>${renderJson(cosmetic)}</pre></td></tr>
				<tr><th>Unlocked hats</th><td><pre>${renderJson(entry.unlockedHats)}</pre></td></tr>
				<tr><th>Unlocked quest tiers</th><td><pre>${renderJson(entry.unlockedQuestTiers)}</pre></td></tr>
				<tr><th>Equipped key item</th><td>${escapeHtml(entry.equippedKeyItemId)}</td></tr>
				<tr><th>Selected deck</th><td><pre>${renderJson(entry.selectedDeck)}</pre></td></tr>
				<tr><th>Owned cards</th><td><pre>${renderJson(entry.ownedCards)}</pre></td></tr>
				<tr><th>Inventory</th><td><pre>${renderJson(entry.inventory)}</pre></td></tr>
			</table>
		</section>`;
		})
		.join('\n');

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Admin — Character Roster</title>
	<style>
		body { font-family: system-ui, sans-serif; margin: 1.5rem; background: #11151c; color: #e6e6e6; }
		h1 { font-size: 1.4rem; }
		.account { border: 1px solid #2a3340; border-radius: 6px; padding: 0.75rem 1rem; margin: 1rem 0; background: #161b24; }
		.account h2 { margin: 0 0 0.5rem; font-size: 1.1rem; color: #7fb4ff; }
		table { border-collapse: collapse; width: 100%; }
		th, td { text-align: left; vertical-align: top; padding: 0.25rem 0.5rem; border-bottom: 1px solid #222a35; }
		th { width: 12rem; color: #9aa7b8; font-weight: 600; }
		pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 0.85rem; }
	</style>
</head>
<body>
	<h1>Character Roster <small>(${roster.length} account${roster.length === 1 ? '' : 's'})</small></h1>
${rows}
</body>
</html>`;
}

/**
 * Express GET handler for the read-only admin roster page. Assumes the
 * `requireAdminPassword` gate has already authorized the request. Read-only:
 * it only reads via buildAdminRoster() and renders HTML — no mutation.
 *
 * @param {object} _req
 * @param {object} res
 */
function adminHandler(_req, res) {
	const roster = buildAdminRoster();
	const html = renderAdminRosterHtml(roster);
	res.type('html').send(html);
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
	requireAdminPassword,
	renderAdminRosterHtml,
	adminHandler
};
