## Stale inline comment on initAuth() call

`game/server/index.js:1171` comments that `initAuth()` "throws if JWT_SECRET is
missing (unless NODE_ENV === 'test')". After this ticket the dev fallback also
requires `ALLOW_DEV_AUTH=1`, so the comment understates the conditions and could
mislead a reader into thinking any non-test env is permissive.

### Acceptance Criteria
- The comment at `game/server/index.js:1171` reflects both the `NODE_ENV==='test'`
  exemption and the `ALLOW_DEV_AUTH=1` dev opt-in (or points to
  `auth.js` / `auth-setup.md` for the full resolution order).

## Update smoke-script header comments for ALLOW_DEV_AUTH

Several client smoke scripts now pass `ALLOW_DEV_AUTH: '1'` when spawning the
server, but their file-header comments still list only `ALLOW_DEBUG_SCENARIOS=1`
(e.g. `test-world-stage-transition.mjs`, `test-telepipe-suspend-resume.mjs`).
Updating the comments avoids confusion for future maintainers.

### Acceptance Criteria
- The header comments of the updated smoke scripts mention `ALLOW_DEV_AUTH=1`
  alongside the other env vars they set.
