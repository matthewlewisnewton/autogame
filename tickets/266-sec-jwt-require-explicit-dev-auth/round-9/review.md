# Senior Review — 266-sec-jwt-require-explicit-dev-auth

## Runtime health (gate)

The captured run in `round-9/metrics.json` is healthy:
- `"ok": true`, URL served at `http://localhost:5177/`.
- `pageerrors` is `[]`.
- No `harness_failure` block.
- `console.log` shows clean Three.js scene init and full gameplay (auth → lobby →
  ready → movement → dodge with cooldown HUD). The only `[error]` line is a
  benign `409 (Conflict)` on a resource fetch (lobby-create race the client
  recovers from); the game proceeds to `phase: "playing"`, 2 players connected,
  5 enemies spawned, dodge cooldown probe (`keyItemCooldownRemaining: 411`,
  `0.4s` HUD) confirmed. No uncaught page error or `[fatal]`.

The game starts and loads cleanly with `ALLOW_DEV_AUTH=1` supplied by the
harness — which is exactly the new opt-in this ticket introduces, so the capture
also proves the dev path still works.

## Acceptance criteria

**AC: Require an explicit opt-in (e.g. ALLOW_DEV_AUTH=1) for the dev-secret
fallback; otherwise fail closed (throw) when JWT_SECRET is unset. Test.** — MET.

`game/server/auth.js:46-83` (`initAuth()`) now resolves the secret in this order:
1. `JWT_SECRET` env if set (any NODE_ENV).
2. `test-secret` when `NODE_ENV === 'test'`.
3. Throws when `NODE_ENV === 'production'` and no secret.
4. Dev fallback `dev-secret` **only** when `ALLOW_DEV_AUTH === '1'` (with a loud
   `console.warn`).
5. Otherwise throws with an actionable message naming both `JWT_SECRET` and
   `ALLOW_DEV_AUTH=1`.

This closes the original vulnerability: previously any non-production NODE_ENV
silently used the known `dev-secret`. Now the insecure fallback requires an
explicit operator opt-in; a staging/public deploy that forgets
`NODE_ENV=production` will **throw at startup** rather than sign JWTs with a
known key.

Fail-closed is real, not cosmetic: `initAuth()` is invoked at the top of
`startServer()` (`game/server/index.js:1172`) before routes are mounted or the
port is bound, so a misconfigured server refuses to start instead of accepting
connections.

Tested: `game/server/test/auth.test.js:312-375` adds a dedicated `initAuth()
dev fallback` suite covering: throws in dev with PORT but no opt-in, dev
fallback with `ALLOW_DEV_AUTH=1`, production throws, `JWT_SECRET` honored
regardless of NODE_ENV, test-secret path, and `JWT_SECRET` precedence over
`ALLOW_DEV_AUTH`. I ran the suite: **23/23 passing**.

## Integration / consistency

The opt-in is wired everywhere the server is launched without a real secret, so
nothing regresses:
- `game/server/package.json` dev script: `ALLOW_DEV_AUTH=1 nodemon index.js`.
- `harness/steps/game.py:219` injects `ALLOW_DEV_AUTH: "1"` into the server env.
- `harness/tests/unit/test_game_start.py:205` asserts the env var is passed.
- Smoke-test server spawn and several client e2e scripts updated likewise
  (per diff stat).
- `game/docs/auth-setup.md` documents the local vs production setup and both
  throw messages.

No conflict with `game/docs/design.md` / `requirements.md` — this is a
server-side security hardening with no gameplay surface change, and the capture
confirms gameplay is intact.

## Code quality

Clean. The branch ordering is correct and short-circuits idempotently
(`if (JWT_SECRET) return`). Warning on the insecure path is appropriate. Error
messages are actionable. No dead code in the shipped state (the PORT-based
fallback that appeared mid-history was removed in commit `9ac0e5ab`; the working
tree has no PORT heuristic). No debug-scenario shortcuts were added by this
ticket.

## Remaining gaps

None blocking. Minor nits recorded in `nits.md` (a slightly stale inline comment
and smoke-script header comments).

VERDICT: PASS
