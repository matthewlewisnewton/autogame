// Authenticated account routes — profile and settings.

const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('./auth');
const { findUserByAccountId, updateProfile } = require('./users');
const { getSettings, updateSettings } = require('./settings');
const { HAT_CATALOG, MODEL_IDS, PROPORTION_KEYS, PROPORTION_RANGES, validateCosmetic, backfillCosmetic } = require('./cosmetic');
const { hasAppearanceFieldChanges } = require('../shared/cosmeticAppearance.js');

const router = Router();
const JWT_EXPIRATION = '24h';

function getJwtSecret() {
	const auth = require('./auth');
	return auth.getJWTSecret();
}

/**
 * Require Authorization: Bearer <token>. Sets req.accountId and req.username.
 */
function requireAuth(req, res, next) {
	const header = req.headers.authorization;
	if (!header || !header.startsWith('Bearer ')) {
		return res.status(401).json({ error: 'Missing or invalid authorization' });
	}
	const token = header.slice(7);
	const decoded = verifyToken(token);
	if (!decoded || !decoded.accountId) {
		return res.status(401).json({ error: 'Invalid or expired token' });
	}
	req.accountId = decoded.accountId;
	req.username = decoded.username;
	next();
}

router.use(requireAuth);

/**
 * GET /api/me — profile + settings
 */
router.get('/me', (req, res) => {
	const user = findUserByAccountId(req.accountId);
	if (!user) {
		return res.status(404).json({ error: 'Account not found' });
	}
	const settings = getSettings(req.accountId);
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
router.patch('/me/settings', (req, res) => {
	const body = req.body;
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return res.status(400).json({ error: 'Settings body must be a JSON object' });
	}
	const settings = updateSettings(req.accountId, body);
	return res.status(200).json({ settings });
});

/**
 * PATCH /api/me/profile — username and/or email
 */
router.patch('/me/profile', (req, res) => {
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

	const result = updateProfile(req.accountId, { username, email, cosmetic });
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
	const payload = {
		username: user.username,
		email: user.email || null,
		cosmetic: user.cosmetic
	};

	if (result.usernameChanged) {
		payload.token = jwt.sign(
			{ accountId: user.accountId, username: user.username },
			getJwtSecret(),
			{ expiresIn: JWT_EXPIRATION }
		);
	}

	return res.status(200).json(payload);
});

module.exports = router;
