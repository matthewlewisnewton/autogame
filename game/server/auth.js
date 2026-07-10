// Auth routes — POST /register, POST /login, POST /logout
const { Router } = require('express');
const crypto = require('crypto');
const { createUserAsync, findUserByUsernameAsync, comparePasswordAsync } = require('./users');
const { createSession, destroySession } = require('./sessions.js');
const { setSessionCookie, clearSessionCookie, getSessionTokenFromRequest } = require('./cookies.js');
const { getRedisClient, isRedisEnabled } = require('./redis.js');

const router = Router();

// Upper bound on accepted password length. bcrypt silently truncates at 72
// bytes, so long passwords sharing a 72-byte prefix would authenticate
// interchangeably; capping also avoids wasting CPU hashing on this
// unauthenticated endpoint.
const MAX_PASSWORD_LENGTH = 256;
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
 * Per-instance in-memory only; see game/docs/auth-setup.md (Auth rate limiting).
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

function distributedRateLimitKey(req, action, username) {
	const digest = crypto
		.createHash('sha256')
		.update(rateLimitKey(req, action, username))
		.digest('hex');
	return `auth-rate:${digest}`;
}

async function isAuthRateLimited(req, action, username, increment = false) {
	if (process.env.NODE_ENV === 'test' && process.env.AUTH_RATE_LIMIT_IN_TESTS !== '1') {
		return false;
	}
	if (!isRedisEnabled()) {
		return isRateLimited(req, action, username, increment);
	}

	try {
		const redis = getRedisClient();
		const key = distributedRateLimitKey(req, action, username);
		if (!increment) {
			const attempts = Number(await redis.get(key) || 0);
			return attempts >= RATE_LIMIT_MAX_ATTEMPTS;
		}
		const attempts = Number(await redis.incr(key));
		if (attempts === 1) {
			await redis.expire(key, Math.max(1, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
		}
		return attempts > RATE_LIMIT_MAX_ATTEMPTS;
	} catch (err) {
		console.error('[auth] shared rate limit failed, using local fallback:', err.message);
		return isRateLimited(req, action, username, increment);
	}
}

/**
 * POST /api/register
 * Body: { username, password }
 * - 201 { accountId } on success — an httpOnly session cookie is set for auth
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

	if (password.length > MAX_PASSWORD_LENGTH) {
		return res.status(400).json({ error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` });
	}

	if (await isAuthRateLimited(req, 'register', username, false)) {
		return res.status(429).json({ error: 'Too many registration attempts. Please try again later.' });
	}

	try {
		const result = await createUserAsync(username, password);
		if (!result.ok) {
			await isAuthRateLimited(req, 'register', username, true);
			return res.status(409).json({ error: 'Username taken' });
		}

		const sessionToken = await createSession(result.accountId);
		setSessionCookie(res, sessionToken);
		return res.status(201).json({ accountId: result.accountId });
	} catch (err) {
		console.error('[auth] registration failed:', err.message);
		return res.status(500).json({ error: 'Registration failed' });
	}
});

/**
 * POST /api/login
 * Body: { username, password }
 * - 200 { accountId } on success — an httpOnly session cookie is set/refreshed
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

	// Reject over-long passwords before the expensive bcrypt compare. Matches
	// the register cap; bcrypt truncates at 72 bytes so anything longer cannot
	// be a legitimately-stored password anyway.
	if (password.length > MAX_PASSWORD_LENGTH) {
		return res.status(400).json({ error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` });
	}

	if (await isAuthRateLimited(req, 'login', username, false)) {
		return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
	}

	const user = await findUserByUsernameAsync(username);
	if (!user) {
		await isAuthRateLimited(req, 'login', username, true);
		return res.status(401).json({ error: 'Invalid credentials' });
	}

	const valid = await comparePasswordAsync(password, user.passwordHash);
	if (!valid) {
		await isAuthRateLimited(req, 'login', username, true);
		return res.status(401).json({ error: 'Invalid credentials' });
	}

	const sessionToken = await createSession(user.accountId);
	setSessionCookie(res, sessionToken);
	return res.status(200).json({ accountId: user.accountId });
});

/**
 * POST /api/logout
 * Destroys the server-side session (when present) and clears the session cookie.
 * No cookie → 204 no-op (idempotent logout).
 */
router.post('/logout', async (req, res) => {
	try {
		const token = getSessionTokenFromRequest(req);
		if (token) {
			await destroySession(token);
		}
		clearSessionCookie(res);
		return res.status(204).end();
	} catch (err) {
		console.error('[auth] logout failed:', err.message);
		return res.status(500).json({ error: 'Logout failed' });
	}
});

module.exports = router;
module.exports._resetRateLimits = function _resetRateLimits() { rateLimitBuckets.clear(); };
module.exports._rateLimitBuckets = rateLimitBuckets;
module.exports.isRateLimited = isRateLimited;
module.exports.incrementRateLimit = incrementRateLimit;
module.exports.isAuthRateLimited = isAuthRateLimited;
module.exports.RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MS;
module.exports.RATE_LIMIT_MAX_ATTEMPTS = RATE_LIMIT_MAX_ATTEMPTS;
module.exports.MAX_PASSWORD_LENGTH = MAX_PASSWORD_LENGTH;
module.exports.pruneExpiredBuckets = pruneExpiredBuckets;
module.exports.startRateLimitSweep = startRateLimitSweep;
module.exports.stopRateLimitSweep = stopRateLimitSweep;
module.exports.getRateLimitSweepInterval = function getRateLimitSweepInterval() {
	return _rateLimitSweepInterval;
};
Object.defineProperty(module.exports, '_rateLimitSweepInterval', {
	get() { return _rateLimitSweepInterval; },
});
