// Auth routes — POST /register and POST /login
const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { createUserAsync, findUserByUsername, comparePasswordAsync } = require('./users');

const router = Router();

let JWT_SECRET = null;
const JWT_EXPIRATION = '24h';
const RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || 10);
const RATE_LIMIT_SWEEP_INTERVAL_MS = 60_000;
const rateLimitBuckets = new Map();
let _rateLimitSweepInterval = null;

/**
 * Iterate `rateLimitBuckets` and delete entries whose window has expired.
 * Exported so tests can invoke it directly (and assert Map size shrinks).
 */
function pruneExpiredBuckets() {
	const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
	for (const [key, bucket] of rateLimitBuckets) {
		if (bucket.windowStart <= cutoff) {
			rateLimitBuckets.delete(key);
		}
	}
}

/**
 * Start the periodic sweep that prunes expired rate-limit buckets.
 * Returns the interval ID (stored in `_rateLimitSweepInterval`).
 * Idempotent — calling again when already started is a no-op.
 */
function startRateLimitSweep() {
	if (_rateLimitSweepInterval) return _rateLimitSweepInterval;
	_rateLimitSweepInterval = setInterval(pruneExpiredBuckets, RATE_LIMIT_SWEEP_INTERVAL_MS);
	return _rateLimitSweepInterval;
}

/**
 * Stop the periodic sweep.  Exported for test cleanup.
 */
function stopRateLimitSweep() {
	if (_rateLimitSweepInterval) {
		clearInterval(_rateLimitSweepInterval);
		_rateLimitSweepInterval = null;
	}
}

function rateLimitKey(req, action, username) {
	const ip = req.ip || req.socket?.remoteAddress || 'unknown';
	const normalizedUsername = typeof username === 'string' ? username.toLowerCase() : '';
	return `${action}:${ip}:${normalizedUsername}`;
}

function isRateLimited(req, action, username, increment = true) {
	if (process.env.NODE_ENV === 'test' && process.env.AUTH_RATE_LIMIT_IN_TESTS !== '1') {
		return false;
	}
	const now = Date.now();
	const key = rateLimitKey(req, action, username);
	const bucket = rateLimitBuckets.get(key);
	if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
		if (increment) {
			rateLimitBuckets.set(key, { windowStart: now, attempts: 1 });
		}
		return false;
	}
	if (increment) {
		bucket.attempts += 1;
	}
	// When not incrementing (check-only mode), use >= because the
	// separate increment call on failure would otherwise allow one
	// extra request through (off-by-one in check-then-increment pattern).
	return increment
		? bucket.attempts > RATE_LIMIT_MAX_ATTEMPTS
		: bucket.attempts >= RATE_LIMIT_MAX_ATTEMPTS;
}

/**
 * Increment (or create) a rate-limit bucket for a given request.
 * Used when rate limiting should only count failures (e.g. admin auth).
 * Call `isRateLimited(req, action, username, false)` first to check,
 * then call this only on failure.
 *
 * @returns {boolean} true if the bucket now exceeds the max attempts.
 */
function incrementRateLimit(req, action, username) {
	if (process.env.NODE_ENV === 'test' && process.env.AUTH_RATE_LIMIT_IN_TESTS !== '1') {
		return false;
	}
	const now = Date.now();
	const key = rateLimitKey(req, action, username);
	let bucket = rateLimitBuckets.get(key);
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
 * dev-only secret when `NODE_ENV` is neither `'test'` nor `'production'`
 * AND `ALLOW_DEV_AUTH=1` is explicitly set; throws when
 * `NODE_ENV === 'production'` and no secret is set; also throws in dev mode
 * unless `ALLOW_DEV_AUTH=1`.
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

	// Dev mode — require explicit opt-in to use the insecure dev fallback
	if (process.env.ALLOW_DEV_AUTH === '1') {
		console.warn(
			'[auth] JWT_SECRET not set — using dev fallback secret (ALLOW_DEV_AUTH=1). ' +
			'Do not use this in production. Set JWT_SECRET to a cryptographically random value.'
		);
		JWT_SECRET = 'dev-secret';
		return JWT_SECRET;
	}

	throw new Error(
		'Missing JWT_SECRET environment variable. ' +
		'Set JWT_SECRET to a cryptographically random value, or set ALLOW_DEV_AUTH=1 to explicitly ' +
		'enable the insecure dev fallback secret. ' +
		'Example: JWT_SECRET=$(openssl rand -hex 32) node server/index.js'
	);
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

/**
 * POST /api/register
 * Body: { username, password }
 * - 201 { accountId } on success
 * - 409 { error: 'Username taken' } when username already exists
 * - 400 { error: '...' } when inputs are invalid
 */
router.post('/register', async (req, res) => {
	const { username, password } = req.body || {};

	// Validate presence
	if (!username || !password) {
		return res.status(400).json({ error: 'Username and password are required' });
	}

	// Validate types — reject non-string values
	if (typeof username !== 'string' || typeof password !== 'string') {
		return res.status(400).json({ error: 'Username and password must be strings' });
	}

	// Validate lengths
	if (username.length < 3 || username.length > 32) {
		return res.status(400).json({ error: 'Username must be between 3 and 32 characters' });
	}

	if (password.length === 0) {
		return res.status(400).json({ error: 'Password must not be empty' });
	}

	if (isRateLimited(req, 'register', username)) {
		return res.status(429).json({ error: 'Too many registration attempts. Please try again later.' });
	}

	try {
		const result = await createUserAsync(username, password);
		if (!result.ok) {
			return res.status(409).json({ error: 'Username taken' });
		}

		return res.status(201).json({ accountId: result.accountId });
	} catch (err) {
		console.error('[auth] registration failed:', err.message);
		return res.status(500).json({ error: 'Registration failed' });
	}
});

/**
 * POST /api/login
 * Body: { username, password }
 * - 200 { token } with JWT containing { accountId, username }
 * - 401 { error: 'Invalid credentials' } on wrong password or unknown username
 */
router.post('/login', async (req, res) => {
	const { username, password } = req.body || {};

	// Validate presence
	if (!username || !password) {
		return res.status(400).json({ error: 'Username and password are required' });
	}

	// Validate types
	if (typeof username !== 'string' || typeof password !== 'string') {
		return res.status(400).json({ error: 'Username and password must be strings' });
	}

	if (isRateLimited(req, 'login', username)) {
		return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
	}

	const user = findUserByUsername(username);
	if (!user) {
		return res.status(401).json({ error: 'Invalid credentials' });
	}

	const valid = await comparePasswordAsync(password, user.passwordHash);
	if (!valid) {
		return res.status(401).json({ error: 'Invalid credentials' });
	}

	const token = jwt.sign(
		{ accountId: user.accountId, username: user.username },
		JWT_SECRET,
		{ expiresIn: JWT_EXPIRATION }
	);

	return res.status(200).json({ token });
});

module.exports = router;
module.exports.initAuth = initAuth;
module.exports.getJWTSecret = function getJWTSecret() { return JWT_SECRET; };
module.exports.verifyToken = verifyToken;
module.exports.resetAuthSecret = function resetAuthSecret() { JWT_SECRET = null; };
module.exports._resetRateLimits = function _resetRateLimits() { rateLimitBuckets.clear(); };
module.exports._rateLimitBuckets = rateLimitBuckets;
module.exports.isRateLimited = isRateLimited;
module.exports.incrementRateLimit = incrementRateLimit;
module.exports.RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MS;
module.exports.RATE_LIMIT_MAX_ATTEMPTS = RATE_LIMIT_MAX_ATTEMPTS;
module.exports.pruneExpiredBuckets = pruneExpiredBuckets;
module.exports.startRateLimitSweep = startRateLimitSweep;
module.exports.stopRateLimitSweep = stopRateLimitSweep;
module.exports.getRateLimitSweepInterval = function getRateLimitSweepInterval() {
	return _rateLimitSweepInterval;
};
Object.defineProperty(module.exports, '_rateLimitSweepInterval', {
	get() { return _rateLimitSweepInterval; },
});
