// Standalone, read-only /admin roster view. Gated by its OWN ADMIN_PASSWORD
// environment variable — completely separate from player JWT auth. It performs
// no writes and never mutates user/character state.

const { Router } = require('express');
const { buildAdminRoster } = require('./adminRoster');

const router = Router();

/**
 * Escape a value for safe interpolation into an HTML body. Strings are escaped;
 * objects/arrays are JSON-stringified first so a malicious username (or any
 * account-derived string) cannot inject markup.
 */
function escapeHtml(value) {
	const str = typeof value === 'string' ? value : JSON.stringify(value);
	return String(str === undefined ? '' : str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Require the admin password. Reads it from `?password=` or the
 * `X-Admin-Password` request header and compares against
 * `process.env.ADMIN_PASSWORD`.
 *
 * - When ADMIN_PASSWORD is unset/empty, every request is denied (403) — the
 *   view never opens up with no password configured.
 * - A missing or mismatched password is denied (401).
 *
 * This is intentionally independent of the player JWT middleware: a valid
 * player token grants no access; only ADMIN_PASSWORD does.
 */
function requireAdminPassword(req, res, next) {
	const expected = process.env.ADMIN_PASSWORD;
	if (!expected) {
		return res.status(403).type('text/plain').send('Admin view is not configured.');
	}
	const supplied = req.query.password || req.headers['x-admin-password'];
	if (!supplied || supplied !== expected) {
		return res.status(401).type('text/plain').send('Unauthorized');
	}
	return next();
}

function renderEntry(entry) {
	return `
		<section class="account">
			<h2>${escapeHtml(entry.username)}</h2>
			<dl>
				<dt>Account ID</dt><dd>${escapeHtml(entry.accountId)}</dd>
				<dt>Currency</dt><dd>${escapeHtml(entry.currency)}</dd>
				<dt>Equipped hat</dt><dd>${escapeHtml(entry.equippedHat)}</dd>
				<dt>Unlocked hats</dt><dd>${escapeHtml(entry.unlockedHats)}</dd>
				<dt>Cosmetic</dt><dd>${escapeHtml(entry.cosmetic)}</dd>
				<dt>Quest-tier / level-2 unlocks</dt><dd>${escapeHtml(entry.unlockedQuestTiers)}</dd>
				<dt>Selected deck</dt><dd>${escapeHtml(entry.selectedDeck)}</dd>
				<dt>Owned cards</dt><dd>${escapeHtml(entry.ownedCards)}</dd>
			</dl>
		</section>`;
}

function renderRoster(roster) {
	const rows = roster.map(renderEntry).join('\n');
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>Admin roster</title>
	<style>
		body { font-family: system-ui, sans-serif; margin: 2rem; background: #111; color: #eee; }
		.account { border: 1px solid #333; border-radius: 6px; padding: 1rem; margin: 1rem 0; }
		h1 { font-size: 1.4rem; }
		h2 { font-size: 1.1rem; margin: 0 0 0.5rem; }
		dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; margin: 0; }
		dt { color: #9ad; font-weight: 600; }
		dd { margin: 0; word-break: break-word; }
	</style>
</head>
<body>
	<h1>Admin roster (${escapeHtml(roster.length)} account${roster.length === 1 ? '' : 's'})</h1>
${rows}
</body>
</html>`;
}

/**
 * GET /admin — read-only HTML page of every account/character record.
 */
router.get('/admin', requireAdminPassword, (req, res) => {
	const roster = buildAdminRoster();
	return res.status(200).type('text/html').send(renderRoster(roster));
});

module.exports = router;
module.exports.escapeHtml = escapeHtml;
module.exports.requireAdminPassword = requireAdminPassword;
