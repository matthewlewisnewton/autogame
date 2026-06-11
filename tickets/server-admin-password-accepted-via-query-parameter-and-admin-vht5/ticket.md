# Server: admin password accepted via query parameter and /admin has no rate limit

## Difficulty: easy

## Goal

readSuppliedPassword (game/server/admin.js:184-196, 205-218, mounted at game/server/index.js:1512) falls back to req.query.password, so the admin secret lands in browser history and proxy/access logs. The endpoint has no rate limiting (the auth limiter only covers /register and /login), so the password can be brute-forced; constant-time compare protects timing, not throughput. The page exposes every account email, currency, and inventory. Fix: accept the header only, and reuse the isRateLimited bucket logic from game/server/auth.js for /admin. Found in code review 2026-06-09.

## Acceptance Criteria

- Query-param password is rejected (header only); repeated failed admin auth attempts from one IP are rate limited; tests cover both

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
