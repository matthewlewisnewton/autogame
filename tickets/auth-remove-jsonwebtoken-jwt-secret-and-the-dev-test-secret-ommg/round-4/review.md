# Senior Review — Auth: remove jsonwebtoken + JWT_SECRET and dev/test secret fallbacks

## Runtime health (captured run)

- `round-4/metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block.
  Servers started on `localhost:5178`; full deterministic smoke captured.
- `round-4/console.log`: no `pageerror` / `[fatal]` lines. The only `error`-tagged
  lines are benign expected protocol responses:
  - `401 Unauthorized` x2 — the client's pre-login session probe before the user
    has authenticated (expected; client then shows the login overlay).
  - `409 Conflict` — player B's duplicate-username registration in the two-player
    smoke (expected).
  - A WebSocket "closed before connection established" warning — benign socket
    teardown noise.
- Probes confirm the **session-cookie auth path works end-to-end**: both players
  reached the squad lobby, readied up, entered gameplay (`phase: "playing"`,
  `connectionState: "connected"`), moved (W/D), and executed a dodge roll
  (`keyItemCooldownRemaining: 391`, HUD `"0.4"`). Socket.IO connections now
  authenticate purely on the `ag_session` cookie — proof the JWT removal did not
  break the live handshake.

Game starts and loads cleanly. Runtime-health gate passes.

## Acceptance criteria

The ticket has a single compound AC; assessed point by point.

### jsonwebtoken removed from deps
PASS. `game/server/package.json` drops the `jsonwebtoken` dependency and the
`ALLOW_DEV_AUTH=1` prefix from the `dev` script. `game/pnpm-lock.yaml` loses 84
lines (the jsonwebtoken tree). `git grep jsonwebtoken` over tracked
`package.json`/lockfiles returns nothing. (A copy still exists under
`game/node_modules/` only because the working-tree store wasn't pruned; not
tracked, not relevant.)

### No JWT issuance/verification or JWT_SECRET/dev-secret/test-secret code remains
PASS.
- `game/server/auth.js`: fully rewritten to session cookies — `getJWTSecret`,
  `verifyToken`, `initAuth`, `JWT_SECRET` handling, and the dev/test fallback
  secrets are all gone. Register/login/logout now create/destroy server-side
  sessions and set/clear the `ag_session` cookie. No weak-default-secret footgun.
- `game/server/account.js`: removed `require('jsonwebtoken')`, `JWT_EXPIRATION`,
  `getJwtSecret()`, and the `jwt.sign(...)` on username change. `/me/profile` now
  returns the plain profile payload with no `token` field.
- `game/server/index.js`: socket `io.use()` middleware no longer falls back to
  `handshake.auth.token` / `verifyToken`; it requires the session cookie and
  rejects when absent/invalid. `initAuth()` call removed from `startServer`, and
  `verifyToken`/`getJWTSecret` removed from `module.exports`.
- `git grep` for `JWT_SECRET|getJWTSecret|verifyToken|dev-secret|test-secret`
  across tracked source/docs finds no live code — only old `game/validation/*/
  server.log` artifacts (historical run logs, not code; see nit).

### Dockerfile / fly.toml env docs updated (no JWT_SECRET)
PASS. `game/Dockerfile` removes the `JWT_SECRET` required-env line and documents
the opaque `ag_session` cookie + Redis session store. `game/fly.toml` drops
`JWT_SECRET` from the `flyctl secrets set` example. The ticket's "document
SESSION_SECRET instead if a signing secret is later added" is correctly handled
by stating no signing secret is required today (auth-setup.md says the same).

### Full auth flow still works on sessions
PASS. Confirmed by the captured run (above) and by `websocket_session_auth.test.js`,
`integration.test.js`, and the migrated client/harness auth paths.

### Tests pass
PASS. `game/server` — 208 files / 2872 tests passed. `game/client` — 96 files /
1448 tests passed. Dead JWT test files removed (`jwt_recovery.test.js`,
`multi_instance_jwt.test.js`, `websocket_jwt_auth.test.js`); remaining `jwt`
mentions in tests are intentional **regression guards** asserting that
register/login/username-change responses *omit* any legacy token, and that socket
auth does NOT fall through to a JWT path.

### No dead JWT references
PASS for code. Client `connectionHandlers.js` narrowed its auth-error regex from
`/jwt|token|session|.../` to `/session|unauthorized|authentication/`. CONTEXT.md,
auth-setup.md, lobbies.md, gameplay-review.md, admin.js/index.js comments, and the
harness `validate/lib/auth.mjs` were all rewritten to session-cookie wording. The
sole remaining `jwt` doc mention (auth-setup.md) is an explicit "No JWT signing
secret … is required" statement — intentional, not stale.

## Consistency with design / requirements

No `game/docs/design.md` or `requirements.md` foundation is touched or regressed —
this is an auth-infrastructure cleanup. Debug scenarios: none added or changed by
this ticket (`debugScenario: null`, gate untouched), so the debug-shortcut checks
do not apply.

## Remaining gaps

None blocking. All acceptance criteria are fully and robustly met; the game runs
cleanly with session-only auth proven end-to-end in the captured run.

VERDICT: PASS
