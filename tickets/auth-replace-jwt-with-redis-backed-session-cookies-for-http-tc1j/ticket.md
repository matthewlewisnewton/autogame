# Auth: replace JWT with Redis-backed session cookies for HTTP (login/register/logout/requireAuth)

## Difficulty: hard

## Goal

Stop using JWTs for sessions (per decision: revocation, weak-secret footguns; and we already have shared Redis). Replace JWT-based HTTP auth with opaque server-side sessions stored in Redis. Add a session module (game/server/sessions.js) that generates an opaque random token (crypto.randomBytes(32) base64url), stores session:<token> -> {accountId, createdAt, lastSeen} in Redis (via game/server/redis.js) with a sliding TTL, and supports create/get/destroy/refresh. On successful /api/login and /api/register, create a session and set it as an httpOnly cookie (Secure only when NODE_ENV=production so local http dev still works, SameSite=Lax, Path=/) via Set-Cookie INSTEAD of returning a JWT in the body. Add POST /api/logout that destroys the session + clears the cookie. account.js requireAuth (and any HTTP auth) validates by reading the session cookie and looking it up in Redis (401 if missing/expired/destroyed), setting req.accountId. Add minimal cookie parsing. Keep bcrypt. Tokens are random + server-stored so NO signing secret is needed. When REDIS_URL is unset (single-instance/dev/test) the existing in-memory Redis shim backs the store transparently. Do NOT remove JWT code yet (a later bead does that after socket+client migrate) — but the cookie path becomes primary.

## Acceptance Criteria

- POST /api/login and /api/register set an httpOnly session cookie (Secure in production, SameSite=Lax) and create a Redis session; requireAuth validates via the cookie (401 when missing/expired/destroyed); POST /api/logout destroys the session+cookie so subsequent requests 401 (revocation works); sessions shared across instances via Redis (tested with ioredis-mock); works with the in-memory shim when REDIS_URL unset; auth tests updated and passing.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
