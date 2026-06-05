# Senior Review — 266-sec-jwt-require-explicit-dev-auth (round 4)

## Runtime health (blocking)

**Round-4 capture: FAIL.** `round-4/metrics.json` reports `"ok": false` with `"failure_kind": "capture_failed"`. There is no `console.log` in the round-4 artifact directory. `pageerrors` is absent (no browser JS defects).

The server exited during startup before accepting connections:

```
Error: Missing JWT_SECRET environment variable. … or set ALLOW_DEV_AUTH=1 …
    at initAuth (game/server/auth.js:77:8)
```

Vite started on port 5177; the game-server port (3004) had no listener. The game did not load in the browser for this round.

**Independent verification (current working tree):** A fresh `capture_run()` with the present code succeeds (`metrics.json` `ok: true`, `pageerrors: []`, server log shows `[auth] … using dev fallback secret (ALLOW_DEV_AUTH=1)` and `Server listening`). `pnpm test:quick` passes (1901 tests). Round-3 capture artifacts in this ticket also show a successful run with the same wiring. The round-4 failure is therefore a **harness capture infra issue** — the capture subprocess did not receive `ALLOW_DEV_AUTH=1` even though `harness/steps/game.py` line 219 sets it and `harness/tests/unit/test_game_start.py` asserts it. Do not modify `game/` to fix this; re-run capture from a fresh harness process.

## Acceptance criteria

### Require explicit opt-in (`ALLOW_DEV_AUTH=1`) for the dev-secret fallback

**Met.** `initAuth()` in `game/server/auth.js` only assigns `'dev-secret'` when `process.env.ALLOW_DEV_AUTH === '1'` (with `JWT_SECRET` unset and `NODE_ENV` neither `test` nor `production`). A `console.warn` precedes the fallback.

### Otherwise fail closed (throw) when `JWT_SECRET` is unset

**Met.** Non-test, non-production environments without `JWT_SECRET` and without `ALLOW_DEV_AUTH=1` throw with an actionable message naming both remedies. Production without `JWT_SECRET` still throws (unchanged). The staging/public bypass described in the ticket goal is closed.

### Test

**Met.** `game/server/test/auth.test.js` adds six `initAuth() dev fallback` cases: throws without opt-in, uses fallback with `ALLOW_DEV_AUTH=1`, production throw, `JWT_SECRET` precedence, test-env shortcut, and `JWT_SECRET` over `ALLOW_DEV_AUTH`. Round-4 `coverage.log` shows all 23 auth tests passing.

## Launch-path wiring (integration)

All known server spawn paths that run outside `NODE_ENV=test` now supply the opt-in:

| Path | `ALLOW_DEV_AUTH=1` |
|------|-------------------|
| `harness/steps/game.py` `start_game()` | Yes (Popen env) |
| `game/server/package.json` `"dev"` script | Yes (`ALLOW_DEV_AUTH=1 nodemon …`) |
| Five Playwright smoke scripts spawning `node index.js` | Yes |

`game/docs/auth-setup.md` documents the requirement for local dev and production.

## Design & regression

- No conflict with `game/docs/design.md` (auth is orthogonal to gameplay design).
- No regression against `game/docs/requirements.md` (no prior JWT env contract documented there).
- This ticket does not add or change debug scenarios (`?debugScenario=`).

## Code quality

- Change is minimal and focused on `initAuth()`; no dead code introduced.
- Tests properly save/restore `ALLOW_DEV_AUTH` in `beforeEach`/`afterEach`.
- Harness unit test now asserts `ALLOW_DEV_AUTH` in server Popen env (commit `46a50408`).

## Remaining gaps

1. **Round-4 has no captured proof the game runs.** `metrics.json` `ok: false`; server died at `auth.js:77` because `ALLOW_DEV_AUTH` was not in effect during that capture. Code and wiring are correct; the harness operator must re-run capture (see `gaps.md`).

VERDICT: FAIL
