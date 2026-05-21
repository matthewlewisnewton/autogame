// Auth routes — POST /register and POST /login
const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { createUser, findUserByUsername, comparePassword } = require('./users');

const router = Router();

let JWT_SECRET = null;
const JWT_EXPIRATION = '24h';

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

/**
 * POST /api/register
 * Body: { username, password }
 * - 201 { accountId } on success
 * - 409 { error: 'Username taken' } when username already exists
 * - 400 { error: '...' } when inputs are invalid
 */
router.post('/register', (req, res) => {
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

	const result = createUser(username, password);
	if (!result.ok) {
		return res.status(409).json({ error: 'Username taken' });
	}

	// createUser succeeded — look up the accountId we just created
	const user = findUserByUsername(username);
	return res.status(201).json({ accountId: user.accountId });
});

/**
 * POST /api/login
 * Body: { username, password }
 * - 200 { token } with JWT containing { accountId, username }
 * - 401 { error: 'Invalid credentials' } on wrong password or unknown username
 */
router.post('/login', (req, res) => {
	const { username, password } = req.body || {};

	// Validate presence
	if (!username || !password) {
		return res.status(400).json({ error: 'Username and password are required' });
	}

	// Validate types
	if (typeof username !== 'string' || typeof password !== 'string') {
		return res.status(400).json({ error: 'Username and password must be strings' });
	}

	const user = findUserByUsername(username);
	if (!user) {
		return res.status(401).json({ error: 'Invalid credentials' });
	}

	const valid = comparePassword(password, user.passwordHash);
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
