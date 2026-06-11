# Add rate limiting to /admin endpoint

The `/admin` route has no rate limiting, so the admin password can be brute-forced from any IP. The auth module (`game/server/auth.js`) already has a working `isRateLimited()` bucket mechanism covering `/register` and `/login`. Export that helper and apply it to the `requireAdminPassword` middleware so repeated failed admin auth attempts from a single IP return HTTP 429.

## Acceptance Criteria

- `isRateLimited` is exported from `game/server/auth.js` so `admin.js` can import it
- `requireAdminPassword` in `game/server/admin.js` checks rate limiting before evaluating the password; a rate-limited request returns HTTP 429 (not 403)
- After more than `RATE_LIMIT_MAX_ATTEMPTS` failed admin auth attempts from the same IP within `RATE_LIMIT_WINDOW_MS`, subsequent attempts return 429
- Successful admin auth does NOT count toward the rate limit bucket (only failures increment)
- Rate limiting is disabled in tests unless `AUTH_RATE_LIMIT_IN_TESTS=1` (same behavior as auth routes)
- Tests cover: (a) repeated failures trigger 429, (b) successful auth does not reset or increment the counter, (c) `_resetRateLimits` clears admin buckets

## Technical Specs

- **File:** `game/server/auth.js` — add `isRateLimited` to the module.exports (line ~191 area). The function already exists and is used by `/register` and `/login`; it just needs to be exported.
- **File:** `game/server/admin.js` — import `isRateLimited` from `./auth`, then in `requireAdminPassword`: check rate limiting first (using action `'admin'` and username `''` or `'admin'`), increment on failure, skip increment on success. Return `res.status(429).json({ error: 'Too many admin login attempts. Please try again later.' })` when rate limited.
- **File:** `game/server/test/admin_roster.test.js` — add tests for rate limiting on the admin middleware: send >10 failed requests with `AUTH_RATE_LIMIT_IN_TESTS=1`, verify 429; verify successful auth doesn't count; verify `_resetRateLimits` clears the bucket.

## Verification: code
