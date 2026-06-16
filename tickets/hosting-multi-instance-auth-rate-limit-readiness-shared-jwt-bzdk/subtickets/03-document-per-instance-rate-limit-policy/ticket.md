# Document per-instance auth rate-limit policy

Explicitly document the decision to keep login/register/admin auth rate limiting in-process (per instance) rather than Redis-backed, including operational implications for multi-instance deploys. No behavior change for single-instance runs.

## Acceptance Criteria

- Documentation records the **explicit policy**: auth rate limits (`isRateLimited`, `incrementRateLimit`, `startRateLimitSweep` in `game/server/auth.js`) remain **in-memory per process**, not Redis-backed.
- Doc explains what is rate-limited today: `register`, `login`, and admin password attempts (`game/server/admin.js`), keyed by `action:ip:username` with `AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_RATE_LIMIT_MAX_ATTEMPTS` env overrides.
- Doc states multi-instance implication: each instance maintains its own counters (an attacker could distribute attempts across instances); this is accepted for current scale with guidance on when to revisit Redis.
- Doc notes `startRateLimitSweep()` prunes expired buckets locally and that single-instance behavior is unchanged.
- Optional: one-line comment in `game/server/auth.js` above `startRateLimitSweep` pointing readers to the hosting doc (no logic change).
- No new dependencies, no Redis integration, no change to 429 thresholds or bucket logic.

## Technical Specs

- Extend **`game/docs/auth-setup.md`** (same file as sub-ticket 02) with an **Auth rate limiting (multi-instance)** subsection, or create **`game/docs/hosting-auth.md`** if the auth-setup doc becomes too long — prefer extending `auth-setup.md` unless it already exceeds ~80 lines after sub-ticket 02.
- Describe `rateLimitBuckets` (`Map` in `auth.js`), `pruneExpiredBuckets` / `RATE_LIMIT_SWEEP_INTERVAL_MS`, and that tests disable limiting unless `AUTH_RATE_LIMIT_IN_TESTS=1`.
- Optionally add a brief pointer comment in **`game/server/auth.js`** near `startRateLimitSweep` (e.g. "Per-instance; see game/docs/auth-setup.md").
- Do not modify rate-limit algorithms, env defaults, or `game/server/index.js` startup order.

## Verification: code
