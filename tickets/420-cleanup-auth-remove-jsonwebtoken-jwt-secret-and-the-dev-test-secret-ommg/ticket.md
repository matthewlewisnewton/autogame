# Cleanup nits from auth-remove-jsonwebtoken-jwt-secret-and-the-dev-test-secret-ommg

> **Staleness note.** This follow-up ticket was written against commit
> `495708b7` (2026-06-17). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `auth-remove-jsonwebtoken-jwt-secret-and-the-dev-test-secret-ommg`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Stale JWT_SECRET log lines in tracked validation artifacts
The committed `game/validation/*/server.log` files contain hundreds of historical
`[auth] JWT_SECRET not set — using dev fallback secret (ALLOW_DEV_AUTH=1)...` lines
from old validation runs. These are run artifacts, not code, so they do not affect
behavior — but they reference auth machinery that no longer exists and are
confusing to anyone grepping for `JWT_SECRET`. They are arguably build output that
should not be tracked at all.

### Acceptance Criteria
- `git grep JWT_SECRET -- game/` returns no matches (the stale `server.log`
  artifacts are removed from version control, or the `game/validation/` log
  outputs are gitignored).
- No game source/test/doc behavior changes.
