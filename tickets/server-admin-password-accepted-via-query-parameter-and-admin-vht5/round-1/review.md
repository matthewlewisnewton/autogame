# Senior review: Server admin password via query parameter and /admin rate limit

**Ticket:** `server-admin-password-accepted-via-query-parameter-and-admin-vht5`  
**Baseline:** `52947b560936bba0c319d98e6e04eb9858385dd1`  
**Commits reviewed:** `c7e0dc86` (remove query-param fallback), `720b3d6a` (add admin rate limiting)  
**Changed files:** `game/server/admin.js`, `game/server/auth.js`, `game/server/test/admin_roster.test.js`

## Runtime health (capture proof)

| Check | Result |
| --- | --- |
| `metrics.json` present | Yes |
| `metrics.json` `"ok": true` | Yes |
| `pageerrors` | Empty `[]` |
| `failure_kind` | Absent |
| `harness_failure` | Absent |
| `console.log` | Clean — Vite connect logs and normal `[initScene]` / `[launchBooth]` only; no `pageerror` or `[fatal]` lines |
| `pageerrors.json` | `[]` |
| Gameplay capture | Full smoke flow reached squad lobby, dungeon deploy, movement, dodge with cooldown HUD |

The captured run proves the game starts and plays normally. This ticket is server-side middleware only; the fallback gameplay capture is appropriate evidence that nothing regressed in the client/runtime path.

## Acceptance criteria

### 1. Query-param password is rejected (header only)

**Met.**

`readSuppliedPassword()` in `game/server/admin.js` now reads only the `x-admin-password` header. The `req.query.password` fallback was removed entirely.

Evidence:

- Middleware tests assert `?password=secret` returns 403 and does not call `next()`.
- HTTP integration test `GET /admin?password=topsecret` returns 403 and response body does not leak roster data (`alice`).
- Header auth path unchanged: `x-admin-password: topsecret` still returns 200 with roster HTML.

No client code references admin auth or query-param passwords. Grep across `game/` shows no remaining `query.password` usage outside tests that assert rejection.

### 2. Repeated failed admin auth attempts from one IP are rate limited

**Met.**

`requireAdminPassword` imports `isRateLimited` and `incrementRateLimit` from `game/server/auth.js` and applies the same bucket mechanism used by `/register` and `/login`:

- Rate-limit check runs **before** password evaluation (`isRateLimited(req, 'admin', 'admin', false)`).
- Only failed attempts increment the bucket (`incrementRateLimit` on 403 path).
- Successful auth does not increment.
- Rate-limited requests return **429** with a clear error message, not 403.
- Disabled in tests unless `AUTH_RATE_LIMIT_IN_TESTS=1`, matching auth routes.

The `auth.js` refactor adds an `increment` parameter (default `true`) to preserve existing register/login behavior, plus a dedicated `incrementRateLimit` helper for the check-then-increment admin pattern. The `>=` vs `>` distinction in check-only mode correctly avoids an off-by-one that would allow an extra brute-force attempt.

`GET /admin` in `game/server/index.js` mounts `requireAdminPassword` directly — no alternate code path bypasses the middleware.

### 3. Tests cover both behaviors

**Met.**

`game/server/test/admin_roster.test.js` (21 tests, all passing):

| Behavior | Tests |
| --- | --- |
| Query param rejected (middleware) | `rejects the password via ?password= query param`, `rejects query param even when header is absent` |
| Query param rejected (HTTP) | `rejects the admin password via ?password= query param` |
| Rate limit 429 after max failures | `returns 429 after RATE_LIMIT_MAX_ATTEMPTS failed attempts from the same IP` |
| Success does not count | `successful auth does not increment the rate-limit counter` |
| Reset helper | `_resetRateLimits clears admin rate-limit buckets` |

Harness coverage run (`coverage.log`): 67/67 tests passed across affected server suites; `admin_roster.test.js` and `auth.test.js` both green. Independent re-run of those two files during review: 44/44 passed.

## Design and requirements consistency

- **design.md:** No conflict. Ticket is admin-route hardening; core gameplay loop unchanged.
- **requirements.md:** No admin-auth requirements to violate. No gameplay regression observed in capture probes (lobby → deploy → playing phase, movement, dodge cooldown).
- **Debug scenarios:** None added or modified. N/A.

## Code quality

- Focused diff (~240 lines, mostly tests). No dead code introduced.
- Security properties preserved: fail-closed when `ADMIN_PASSWORD` unset, constant-time compare, Bearer token still ignored for admin.
- `auth.js` export surface expanded minimally for reuse; register/login call sites unchanged.
- Comments in `admin.js` and `auth.js` document the check-then-increment pattern and why check-only uses `>=`.

## Sub-ticket integration

Both sub-tickets integrate cleanly:

1. **01-remove-query-param-password** — query fallback removed; tests inverted from expect-200 to expect-403.
2. **02-add-admin-rate-limit** — bucket logic reused from auth; middleware wired before password check.

No gaps between sub-ticket scope and top-level acceptance criteria.

## Remaining gaps

None. All acceptance criteria are fully and robustly satisfied; runtime capture is clean.

VERDICT: PASS
