# Senior Review — Auth: replace JWT with Redis-backed session cookies (HTTP)

## Runtime health (gate)

- `round-2/metrics.json`: `"ok": true`, `capturePlanValid: true`, `pageerrors: []`, no
  `harness_failure` block. Full-flow smoke capture (auth → lobby → ready → movement →
  dodge with cooldown probe) completed; player reached `phase: "playing"`, connected,
  scene initialized, 2 canvases, HUD populated.
- `round-2/console.log` is clean — only `[vite] connecting/connected`, `initScene`, and
  `launchBooth ready-up` lines. No `pageerror` / `[fatal]` from game code.
- Auth flow exercised implicitly: the capture logged in / readied two players, so the new
  session-cookie path is what carried the run. Game starts and loads cleanly. **Gate passes.**

## Per-criterion findings

The single acceptance criterion bundles several sub-requirements; taken in turn:

**1. POST /api/login and /api/register set an httpOnly session cookie (Secure in production,
SameSite=Lax) and create a Redis session.**
- `auth.js` login (273-274) and register (218-219) call `createSession(accountId)` then
  `setSessionCookie(res, token)`.
- `cookies.js:5-11` builds attributes `Path=/; HttpOnly; SameSite=Lax`, appending `Secure`
  only when `NODE_ENV === 'production'` — matches the ticket exactly (local http dev works).
- `sessions.js:27-41` generates `crypto.randomBytes(32).toString('base64url')`, stores a
  `session:<token>` hash `{accountId, createdAt, lastSeen}` with a 24h sliding TTL. ✓
- Tested: `auth.test.js` asserts `HttpOnly` + `SameSite=Lax` on Set-Cookie, that the cookie
  maps back to the registered accountId, and that a Redis session record is created. ✓

**2. requireAuth validates via the cookie (401 when missing/expired/destroyed).**
- `account.js:28-50` reads the token via `getSessionTokenFromRequest`, 401 if absent;
  `getSession` lookup, 401 if missing/expired/destroyed; additionally re-validates the
  stored `accountId` against `SAFE_ACCOUNT_ID_REGEX` before trusting it (defense against path
  traversal) and sets `req.accountId`/`req.username`. Bearer-JWT validation is gone from the
  HTTP auth boundary. ✓
- Tested in `account.test.js` (16 tests, including missing/invalid cookie → 401). ✓

**3. POST /api/logout destroys the session + cookie so subsequent requests 401 (revocation).**
- `auth.js:288-300` destroys the session if a token is present, clears the cookie, returns
  204; idempotent 204 when no cookie. `clearSessionCookie` emits `Max-Age=0`. ✓
- Tested: logout → `/api/me` returns 401, the Redis key is gone afterward, and no-cookie
  logout returns 204. ✓ Revocation works (the original JWT motivation).

**4. Sessions shared across instances via Redis (ioredis-mock); works with in-memory shim
when REDIS_URL unset.**
- `sessions.js` goes through `getRedisClient()`; `redis.js` shim implements
  `hset/hget/hgetall/del/expire` with TTL semantics, so the store works transparently when
  `REDIS_URL` is unset.
- `sessions.test.js` covers both: the in-memory shim path (token shape, sliding-window
  refresh, destroy semantics) and an `ioredis-mock` cross-instance test where a session
  survives `closeRedis()` + a fresh `getRedisClient()` lifecycle. ✓

**5. No signing secret needed for sessions; bcrypt kept; JWT code not removed yet.**
- Session tokens are random + server-stored — no secret involved. bcrypt compare retained in
  login (`comparePasswordAsync`). JWT machinery (`initAuth`, `verifyToken`, secret handling)
  is intact, and per sub-ticket 06 a JWT is still returned in the login/register body for the
  socket bridge — consistent with "do NOT remove JWT yet; cookie path becomes primary." ✓

**6. Auth tests updated and passing.**
- Ran `vitest run` on sessions/cookies/auth/account: **69 passed, 0 failed.** ✓

## Consistency / regressions

- No debug scenarios were added or changed by this ticket — the debug-scenario checklist does
  not apply. (`metrics.json` shows `debugScenario: null`, `debugScenarioAllowed: true`,
  unchanged.)
- No design.md or requirements.md regression — this is server-side auth plumbing; gameplay
  capture is unaffected and ran to `playing`.
- Code quality is good: clear JSDoc, the accountId regex re-check is a thoughtful hardening
  step, rate limiting and password-length caps preserved.

## Remaining gaps

None blocking. The acceptance criterion is fully and robustly met, the game runs and loads
cleanly, and the test suite passes. Minor non-blocking polish is recorded in `nits.md`.

VERDICT: PASS