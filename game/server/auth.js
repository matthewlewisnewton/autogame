// Auth routes — POST /register and POST /login.
//
// Registration supports two flows:
//   1. Username + password (legacy).
//   2. Email + password (new, optional `username` for display).
//
// Login accepts either a `username` or an `email` field, or a unified
// `identifier` field that auto-detects which one was supplied. This keeps
// existing clients working while paving the way for an SSO-shaped login form
// (where the same "Sign in" button eventually dispatches to a provider screen).
const { Router } = require('express');
const jwt = require('jsonwebtoken');
const {
	createUserAsync,
	createAccountWithEmailAsync,
	findUserByUsername,
	findUserByIdentifier,
	verifyPasswordForIdentifier,
	isValidEmail,
	normalizeEmail,
	looksLikeEmail
} = require('./users');

const router = Router();

let JWT_SECRET = null;
const JWT_EXPIRATION = '24h';
const RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || 10);
const rateLimitBuckets = new Map();

function rateLimitKey(req, action, identifier) {
	const ip = req.ip || req.socket?.remoteAddress || 'unknown';
	const normalized = typeof identifier === 'string' ? identifier.toLowerCase() : '';
	return `${action}:${ip}:${normalized}`;
}

function isRateLimited(req, action, identifier) {
	if (process.env.NODE_ENV === 'test' && process.env.AUTH_RATE_LIMIT_IN_TESTS !== '1') {
		return false;
	}
	const now = Date.now();
	const key = rateLimitKey(req, action, identifier);
	const bucket = rateLimitBuckets.get(key);
	if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
		rateLimitBuckets.set(key, { windowStart: now, attempts: 1 });
		return false;
	}
	bucket.attempts += 1;
	return bucket.attempts > RATE_LIMIT_MAX_ATTEMPTS;
}

/**
 * Initialize the JWT secret. Must be called before the server starts
 * accepting connections. Reads `JWT_SECRET` from `process.env`; falls back
 * to a fixed test secret when `NODE_ENV === 'test'`; falls back to a
 * dev-only secret when `NODE_ENV` is neither `'test'` nor `'production'`;
 * throws when `NODE_ENV === 'production'` and no secret is set.
 *
 * @returns {string} The resolved secret.
 */
function initAuth() {
	if (JWT_SECRET) return JWT_SECRET; // idempotent — safe for repeated calls in tests

	if (process.env.JWT_SECRET) {
		JWT_SECRET = process.env.JWT_SECRET;
		return JWT_SECRET;
	}

	if (process.env.NODE_ENV === 'test') {
		JWT_SECRET = 'test-secret';
		return JWT_SECRET;
	}

	if (process.env.NODE_ENV === 'production') {
		throw new Error(
			'Missing JWT_SECRET environment variable. ' +
			'Set JWT_SECRET to a cryptographically random value before starting the server. ' +
			'Example: JWT_SECRET=$(openssl rand -hex 32) node server/index.js'
		);
	}

	// Dev fallback — allows `pnpm run dev` to start without JWT_SECRET
	console.warn(
		'[auth] JWT_SECRET not set — using dev fallback secret. ' +
		'Do not use this in production. Set JWT_SECRET to a cryptographically random value.'
	);
	JWT_SECRET = 'dev-secret';
	return JWT_SECRET;
}

/**
 * Verify a JWT token and return the decoded payload, or null on failure.
 * Used by the WebSocket connection handler to authenticate socket clients.
 */
function verifyToken(token) {
	if (!token || typeof token !== 'string') return null;
	try {
		return jwt.verify(token, JWT_SECRET);
	} catch (e) {
		return null;
	}
}

function signSessionToken(user) {
	return jwt.sign(
		{ accountId: user.accountId, username: user.username },
		JWT_SECRET,
		{ expiresIn: JWT_EXPIRATION }
	);
}

/**
 * POST /api/register
 *
 * Body forms:
 *   • { username, password }              — username identity (legacy).
 *   • { email, password, username? }      — email identity (new).
 *
 * Responses:
 *   • 201 { accountId, username } on success.
 *   • 409 { error } when the username or email is already in use.
 *   • 400 { error } when inputs are invalid.
 */
router.post('/register', async (req, res) => {
	const body = req.body || {};
	const { password } = body;
	const username = typeof body.username === 'string' ? body.username : undefined;
	const email = typeof body.email === 'string' ? body.email : undefined;

	if (!password) {
		return res.status(400).json({ error: 'Password is required' });
	}
	if (typeof password !== 'string') {
		return res.status(400).json({ error: 'Password must be a string' });
	}
	if (password.length === 0) {
		return res.status(400).json({ error: 'Password must not be empty' });
	}

	if (!username && !email) {
		return res.status(400).json({ error: 'Username or email is required' });
	}

	// Validate username when supplied (it's required for the legacy flow and
	// optional for the email flow — we still reject obviously bad values).
	if (username !== undefined) {
		if (typeof username !== 'string') {
			return res.status(400).json({ error: 'Username must be a string' });
		}
		if (username.length < 3 || username.length > 32) {
			return res.status(400).json({ error: 'Username must be between 3 and 32 characters' });
		}
	}

	if (email !== undefined) {
		if (typeof email !== 'string') {
			return res.status(400).json({ error: 'Email must be a string' });
		}
		const normalized = normalizeEmail(email);
		if (!normalized || !isValidEmail(normalized)) {
			return res.status(400).json({ error: 'Invalid email format' });
		}
	}

	const rateLimitIdent = email || username;
	if (isRateLimited(req, 'register', rateLimitIdent)) {
		return res.status(429).json({ error: 'Too many registration attempts. Please try again later.' });
	}

	try {
		if (email) {
			const result = await createAccountWithEmailAsync({ email, password, username });
			if (!result.ok) {
				const status = result.reason === 'Email already in use' || result.reason === 'Username already taken'
					? 409
					: 400;
				return res.status(status).json({ error: result.reason });
			}
			return res.status(201).json({ accountId: result.accountId, username: result.username });
		}

		// Username-only registration.
		const result = await createUserAsync(username, password);
		if (!result.ok) {
			// Preserve the original "Username taken" message for legacy clients.
			const errMsg = result.reason === 'Username already taken' ? 'Username taken' : result.reason;
			const status = result.reason === 'Username already taken' ? 409 : 400;
			return res.status(status).json({ error: errMsg });
		}
		return res.status(201).json({ accountId: result.accountId, username });
	} catch (err) {
		console.error('[auth] registration failed:', err.message);
		return res.status(500).json({ error: 'Registration failed' });
	}
});

/**
 * POST /api/login
 *
 * Body forms:
 *   • { username, password }   — login by username (legacy).
 *   • { email, password }      — login by email (new).
 *   • { identifier, password } — auto-detect by `@`.
 *
 * Always returns 401 / `Invalid credentials` for unknown identifiers and
 * wrong passwords so we don't leak which identifiers exist.
 */
router.post('/login', async (req, res) => {
	const body = req.body || {};
	const { password } = body;
	const explicitIdentifier = typeof body.identifier === 'string'
		? body.identifier
		: (typeof body.email === 'string' ? body.email
			: (typeof body.username === 'string' ? body.username : undefined));

	if (!explicitIdentifier || !password) {
		return res.status(400).json({ error: 'Identifier and password are required' });
	}
	if (typeof password !== 'string') {
		return res.status(400).json({ error: 'Password must be a string' });
	}

	const identifier = explicitIdentifier.trim();
	if (!identifier) {
		return res.status(400).json({ error: 'Identifier and password are required' });
	}

	if (isRateLimited(req, 'login', identifier)) {
		return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
	}

	const user = looksLikeEmail(identifier)
		? findUserByIdentifier(identifier)
		: findUserByUsername(identifier);
	if (!user) {
		return res.status(401).json({ error: 'Invalid credentials' });
	}

	const valid = await verifyPasswordForIdentifier(user, identifier, password);
	if (!valid) {
		return res.status(401).json({ error: 'Invalid credentials' });
	}

	const token = signSessionToken(user);
	return res.status(200).json({ token });
});

module.exports = router;
module.exports.initAuth = initAuth;
module.exports.getJWTSecret = function getJWTSecret() { return JWT_SECRET; };
module.exports.verifyToken = verifyToken;
module.exports.signSessionToken = signSessionToken;
module.exports.resetAuthSecret = function resetAuthSecret() { JWT_SECRET = null; };
module.exports._resetRateLimits = function _resetRateLimits() { rateLimitBuckets.clear(); };
