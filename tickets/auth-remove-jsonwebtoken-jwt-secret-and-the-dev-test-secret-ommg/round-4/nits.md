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
