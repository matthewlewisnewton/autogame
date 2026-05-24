// Authenticated account routes — profile and settings.

const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('./auth');
const {
	findUserByAccountId,
	updateProfile,
	linkEmailIdentity,
	IDENTITY_PROVIDERS
} = require('./users');
const { getSettings, updateSettings } = require('./settings');

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
 * Build a public-safe view of an account's identities (no password hashes).
 */
function publicIdentities(user) {
	if (!user || !Array.isArray(user.identities)) return [];
	return user.identities.map(ident => ({
		provider: ident.provider,
		subject: ident.subject,
		createdAt: ident.createdAt || null
	}));
}

/**
 * GET /api/me — profile + settings + linked identities.
 *
 * `identities` exposes the providers tied to the account (username, email,
 * future SSO providers) so the client can render an account-settings page
 * that shows "Sign in with …" status and offer to link additional providers.
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
		identities: publicIdentities(user),
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
	const { username, email } = req.body || {};
	if (username === undefined && email === undefined) {
		return res.status(400).json({ error: 'No profile fields to update' });
	}

	const result = updateProfile(req.accountId, { username, email });
	if (!result.ok) {
		const status = result.reason === 'Email already in use' || result.reason === 'Username already taken'
			? 409
			: 400;
		return res.status(status).json({ error: result.reason });
	}

	const user = findUserByAccountId(req.accountId);
	const payload = {
		username: user.username,
		email: user.email || null
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

/**
 * POST /api/me/identities/email — link an email + password identity to the
 * authenticated account so it can be used as a future sign-in method.
 *
 * Body: { email, password }
 * - 201 { identities } on success.
 * - 400 / 409 { error } on validation or conflict.
 */
router.post('/me/identities/email', async (req, res) => {
	const { email, password } = req.body || {};
	if (!email || !password) {
		return res.status(400).json({ error: 'Email and password are required' });
	}
	if (typeof email !== 'string' || typeof password !== 'string') {
		return res.status(400).json({ error: 'Email and password must be strings' });
	}
	if (password.length === 0) {
		return res.status(400).json({ error: 'Password must not be empty' });
	}

	const result = await linkEmailIdentity(req.accountId, email, password);
	if (!result.ok) {
		const conflict = result.reason === 'Email already in use'
			|| result.reason === 'Email identity already linked';
		return res.status(conflict ? 409 : 400).json({ error: result.reason });
	}

	const user = findUserByAccountId(req.accountId);
	return res.status(201).json({
		email: user.email,
		identities: publicIdentities(user)
	});
});

module.exports = router;
