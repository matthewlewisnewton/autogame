# Senior Review — 266-sec-jwt-require-explicit-dev-auth (round 7)

## Runtime health

Round-7 capture does **not** prove the game runs.

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | **`false`** |
| `failure_kind` | `"capture_failed"` |
| `pageerrors` | absent (no browser load occurred) |
| `console.log` | **missing** |
| Vite client | Started on `:5177` |
| Game server | **Crashed at startup** — `auth.js:77` throw |

Server log from round-7:

```
Error: Missing JWT_SECRET environment variable. … or set ALLOW_DEV_AUTH=1 …
    at initAuth (game/server/auth.js:77:8)
    at startServer (game/server/index.js:1172:3)
```

This is the **intended fail-closed behavior** when neither `JWT_SECRET` nor `ALLOW_DEV_AUTH=1` is present — not a browser page error and not an EADDRINUSE infra signature. The capture subprocess did not receive `ALLOW_DEV_AUTH=1` even though `harness/steps/game.py` line 219 sets it in the Popen env (unit-tested in `harness/tests/unit/test_game_start.py`).

**Independent verification (current working tree):** A fresh `capture_run()` on ports 5178/3005 succeeds (`metrics.json` `ok: true`, server log shows `[auth] … using dev fallback secret (ALLOW_DEV_AUTH=1)` and `Server listening`). Round-3 and round-6 artifacts also captured successfully (round-6 relied on the since-removed PORT bypass; round-7 correctly exposes the env-propagation gap). `pnpm test:quick` passes all 1901 tests.

Per review rules, the official round-7 artifact is a broken run regardless of code quality elsewhere.

**Runtime verdict: FAIL (no captured proof).**

## Acceptance criteria

### Require explicit opt-in (`ALLOW_DEV_AUTH=1`) for the dev-secret fallback

**Met.** `initAuth()` in `game/server/auth.js` assigns `'dev-secret'` only when `process.env.ALLOW_DEV_AUTH === '1'` (with `JWT_SECRET` unset and `NODE_ENV` neither `test` nor `production`). A `console.warn` precedes the fallback.

The round-6 blocking gap — a PORT-based implicit bypass — is **resolved**. Commits `9ac0e5ab` / `a035d2f7` removed the `if (process.env.PORT)` block and updated tests to expect throw when only `PORT` is set without `ALLOW_DEV_AUTH=1`. No other implicit opt-in paths remain.

### Otherwise fail closed (throw) when `JWT_SECRET` is unset

**Met.** Non-test, non-production environments without `JWT_SECRET` and without `ALLOW_DEV_AUTH=1` throw with an actionable message naming both remedies. Production without `JWT_SECRET` still throws regardless of other env vars. A staging/PaaS deploy with `PORT` set but no secret and no opt-in now fails closed — closing the vulnerability described in the ticket goal.

Round-7's server crash during capture is itself evidence that fail-closed works; the capture failure is because the harness did not supply the dev opt-in for that run.

### Test

**Met.** `game/server/test/auth.test.js` includes six `initAuth() dev fallback` cases:

- throws in dev mode with `PORT` but without `ALLOW_DEV_AUTH`
- uses fallback when `ALLOW_DEV_AUTH=1`
- throws in production without `JWT_SECRET`
- accepts explicit `JWT_SECRET` regardless of `NODE_ENV`
- uses `test-secret` in `NODE_ENV=test` without opt-in
- `JWT_SECRET` takes precedence over `ALLOW_DEV_AUTH`

Round-7 `coverage.log` shows all 23 auth tests and 40 changed-file tests passing.

## Ticket goal alignment

The original bypass — `NODE_ENV != production` silently using `dev-secret` — is closed. Staging deploys that forget `NODE_ENV=production` but also omit `JWT_SECRET` and `ALLOW_DEV_AUTH=1` now crash at startup instead of signing JWTs with a known key. Production remains protected by the existing production-only throw.

## Design & requirements consistency

No changes to gameplay mechanics, multiplayer flows, or `game/docs/design.md`. `game/docs/auth-setup.md` documents `ALLOW_DEV_AUTH=1` for local dev and `JWT_SECRET` for production. Foundation requirements (3D render, server-client WebSocket, movement sync) are unaffected; round-6 capture probes showed full gameplay when the server starts.

## Debug scenarios

Not applicable — this ticket did not add or modify `?debugScenario=` shortcuts.

## Harness & integration wiring

| Path | `ALLOW_DEV_AUTH=1` wired? |
|------|---------------------------|
| `game/server/package.json` `"dev"` | Yes |
| `harness/steps/game.py` `start_game()` | Yes (unit-tested) |
| Client smoke scripts (5 scripts that spawn server) | Yes |
| Round-7 capture server log | **No** — env not in effect for that subprocess |

## Code quality

- `initAuth()` is idempotent, well-documented, and has no dead branches.
- Tests properly save/restore env vars via `beforeEach`/`afterEach`.
- No browser page errors (browser never loaded in round-7).
- No regressions observed in test suite or independent capture.

## Remaining gaps

1. **Round-7 has no captured proof the game runs.** `metrics.json` `ok: false`; server exited at `auth.js:77` because `ALLOW_DEV_AUTH` was not in effect during that capture despite correct harness wiring in source. Code and acceptance criteria are satisfied; the harness operator must re-run capture from a fresh process (see `gaps.md`). Do not reintroduce a PORT bypass in `game/` to paper over this.

VERDICT: FAIL
