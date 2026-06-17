// Authenticated account routes — profile and settings.

const { Router } = require('express');
const { getSessionTokenFromRequest } = require('./cookies.js');
const { getSession } = require('./sessions.js');
const { findUserByAccountId, updateProfile } = require('./users');
const { getSettings, updateSettings } = require('./settings');
const { HAT_CATALOG, MODEL_IDS, PROPORTION_KEYS, PROPORTION_RANGES, validateCosmetic, backfillCosmetic } = require('./cosmetic');
const { hasAppearanceFieldChanges } = require('../shared/cosmeticAppearance.js');

const router = Router();

// Safe accountId shape (server-issued UUIDs). Reject anything else at the auth
// boundary so a forged/leaked-secret token cannot drive path traversal in
// settings/player file paths derived from the accountId claim.
const SAFE_ACCOUNT_ID_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * Require the opaque session cookie. Sets req.accountId and req.username.
 */
async function requireAuth(req, res, next) {
	try {
		const token = getSessionTokenFromRequest(req);
		if (!token) {
			return res.status(401).json({ error: 'Missing or invalid authorization' });
		}
		const session = await getSession(token);
		if (!session || !session.accountId) {
			return res.status(401).json({ error: 'Invalid or expired token' });
		}
		if (typeof session.accountId !== 'string' || !SAFE_ACCOUNT_ID_REGEX.test(session.accountId)) {
			return res.status(401).json({ error: 'Invalid or expired token' });
		}
		req.accountId = session.accountId;
		const user = findUserByAccountId(session.accountId);
		if (user) {
			req.username = user.username;
		}
		next();
	} catch (err) {
		next(err);
	}
}

router.use(requireAuth);

/**
 * GET /api/me — profile + settings
 */
router.get('/me', async (req, res) => {
	const user = findUserByAccountId(req.accountId);
	if (!user) {
		return res.status(404).json({ error: 'Account not found' });
	}
	const settings = await getSettings(req.accountId);
	return res.status(200).json({
		accountId: user.accountId,
		username: user.username,
		email: user.email || null,
		cosmetic: user.cosmetic,
		unlockedHats: user.unlockedHats,
		hatCatalog: HAT_CATALOG,
		modelIds: MODEL_IDS,
		proportionConfig: { keys: PROPORTION_KEYS, ranges: PROPORTION_RANGES },
		settings
	});
});

/**
 * PATCH /api/me/settings — partial settings update
 */
router.patch('/me/settings', async (req, res) => {
	const body = req.body;
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return res.status(400).json({ error: 'Settings body must be a JSON object' });
	}
	const result = await updateSettings(req.accountId, body);
	if (!result.ok) {
		return res.status(400).json({ error: result.reason });
	}
	return res.status(200).json({ settings: result.settings });
});

/**
 * PATCH /api/me/profile — username and/or email
 */
router.patch('/me/profile', async (req, res) => {
	const { username, email, cosmetic } = req.body || {};
	if (username === undefined && email === undefined && cosmetic === undefined) {
		return res.status(400).json({ error: 'No profile fields to update' });
	}

	if (cosmetic !== undefined) {
		const { hasLiveLobbyPlayerForAccount } = require('./index');
		if (hasLiveLobbyPlayerForAccount(req.accountId)) {
			const user = findUserByAccountId(req.accountId);
			const validation = validateCosmetic(cosmetic);
			if (validation.ok && user) {
				const base = backfillCosmetic(user.cosmetic);
				const value = validation.value;
				const merged = value.proportions
					? { ...base, ...value, proportions: { ...base.proportions, ...value.proportions } }
					: { ...base, ...value };
				if (hasAppearanceFieldChanges(base, merged)) {
					return res.status(400).json({
						error: 'Appearance changes in lobby must use applyAppearanceChange',
					});
				}
			}
		}
	}

	const result = await updateProfile(req.accountId, { username, email, cosmetic });
	if (!result.ok) {
		const status = result.reason === 'Email already in use' || result.reason === 'Username already taken'
			? 409
			: 400;
		return res.status(status).json({ error: result.reason });
	}

	const user = findUserByAccountId(req.accountId);
	if (cosmetic !== undefined) {
		const { syncLivePlayerCosmetic } = require('./index');
		syncLivePlayerCosmetic(req.accountId, user.cosmetic);
	}
	if (result.usernameChanged) {
		const { syncLivePlayerUsername } = require('./index');
		syncLivePlayerUsername(req.accountId, user.username);
	}

	return res.status(200).json({
		username: user.username,
		email: user.email || null,
		cosmetic: user.cosmetic
	});
});

module.exports = router;
