# Senior Review — 266-sec-jwt-require-explicit-dev-auth (round 8)

## Runtime health

**FAIL — game did not start in round-8 capture.**

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `false` |
| `pageerrors` | absent / empty |
| `failure_kind` | `"capture_failed"` |
| `console.log` | missing (capture never reached browser) |

Server log (`round-8/server.log`):

```
Error: Missing JWT_SECRET environment variable. … or set ALLOW_DEV_AUTH=1 …
    at initAuth (game/server/auth.js:77:8)
```

Vite started on port 5177; the game server exited before listening. This is the **intended fail-closed path** when neither `JWT_SECRET` nor `ALLOW_DEV_AUTH=1` is present — not a browser page error and not an EADDRINUSE signature.

**Independent verification (current working tree):** A fresh `capture_run()` on ports 5179/3006 succeeds (`metrics.json` `ok: true`; server log shows `[auth] … using dev fallback secret (ALLOW_DEV_AUTH=1)` and `Server listening`). Round-3 and round-6 artifacts also captured successfully. `harness/steps/game.py` line 219 sets `ALLOW_DEV_AUTH: "1"` in the server Popen env (unit-tested in `harness/tests/unit/test_game_start.py`). The round-8 subprocess did not receive that env var despite correct source wiring — same pattern as round-7.

## Harness blockers

Round-8 `capture_diagnosis` shows servers did not come up. Client Vite was ready; server crashed at auth init:

```
[server] Dungeon bounds: x [-36.0, 36.0], z [-18.0, 36.0]
Error: Missing JWT_SECRET environment variable. … ALLOW_DEV_AUTH=1 …
```

No `harness_failure` block (not a port-leak signature). Root cause: capture subprocess started the server without `ALLOW_DEV_AUTH=1` in effect. **Would have passed on code merits** if capture had used the wired env (confirmed by independent `capture_run()`).

## Acceptance criteria

### Require explicit opt-in (`ALLOW_DEV_AUTH=1`) for the dev-secret fallback

**Met.** `initAuth()` in `game/server/auth.js` assigns `'dev-secret'` only when `process.env.ALLOW_DEV_AUTH === '1'` (with `JWT_SECRET` unset and `NODE_ENV` neither `test` nor `production`). A `console.warn` precedes the fallback. No implicit bypass paths remain — the round-6 PORT-based bypass was removed in commits `9ac0e5ab` / `a035d2f7`.

### Fail closed (throw) when `JWT_SECRET` is unset without opt-in

**Met.** Non-test, non-production environments without `JWT_SECRET` and without `ALLOW_DEV_AUTH=1` throw with an actionable message naming both remedies. Production without `JWT_SECRET` still throws regardless of other env vars. Staging/PaaS deploys with `PORT` set but no secret and no opt-in now fail closed — closing the vulnerability in the ticket goal.

### Test coverage

**Met.** `game/server/test/auth.test.js` covers:

- throws in dev mode with `PORT` but without `ALLOW_DEV_AUTH`
- uses fallback when `ALLOW_DEV_AUTH=1`
- throws in production without `JWT_SECRET`
- accepts `JWT_SECRET` regardless of `NODE_ENV`
- uses `test-secret` in `NODE_ENV=test` without requiring `ALLOW_DEV_AUTH`
- `JWT_SECRET` takes precedence over `ALLOW_DEV_AUTH`

Round-8 `coverage.log`: 40/40 auth-related tests pass (3 files).

## Design & foundation consistency

No changes to gameplay mechanics, multiplayer flows, or `game/docs/design.md`. `game/docs/auth-setup.md` documents `ALLOW_DEV_AUTH=1` for local dev and `JWT_SECRET` for production. Foundation requirements (3D render, server-client WebSocket, movement sync) are unaffected; successful captures (round-3, round-6, independent run) exercised full gameplay.

## Dev / harness wiring

| Path | `ALLOW_DEV_AUTH=1` wired? |
|------|---------------------------|
| `game/server/package.json` dev script | Yes (`ALLOW_DEV_AUTH=1 nodemon`) |
| `harness/steps/game.py` `start_game()` | Yes (line 219) |
| Client smoke scripts (deck-loadout, quest-completion, card-evolution, telepipe, world-stage) | Yes |
| Vitest (`NODE_ENV=test`) | Uses `test-secret` — no opt-in needed |

## Debug scenarios

Not applicable — this ticket did not add or change any `?debugScenario=` shortcuts.

## Code quality

- `initAuth()` logic is clear, idempotent, and well-documented.
- No dead code or regressions in the auth path.
- One unrelated flaky test (`field_medic_kit.test.js` magicStones timing) fails in `pnpm test:quick` — not in this ticket's changed files and not auth-related.

## Remaining gaps

1. **Round-8 has no captured proof the game runs.** `metrics.json` `ok: false`; server exited at `auth.js:77` because `ALLOW_DEV_AUTH` was not in effect during that capture despite correct harness wiring in source. Code and acceptance criteria are satisfied; the harness operator must re-run capture from a fresh process (see `gaps.md`). Do not reintroduce a PORT bypass in `game/` to paper over this.

VERDICT: FAIL
