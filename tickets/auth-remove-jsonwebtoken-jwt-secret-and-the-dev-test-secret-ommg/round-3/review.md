# Senior Review — Auth: remove jsonwebtoken + JWT_SECRET and dev/test secret fallbacks

## Runtime health (gate)

- `round-3/metrics.json`: `ok: true`, `pageerrors: []`, no `harness_failure` block.
- `round-3/console.log`: no `pageerror` / `[fatal]` / uncaught lines from game code.
- Capture (fallback full-flow smoke) drove auth → squad lobby → ready → gameplay
  → dodge-roll cooldown probe successfully (`phase: "playing"`, `connectionState:
  "connected"`, dodge cooldown HUD transitions 397→44ms across probes). The game
  starts and loads cleanly on session-cookie auth.

The game is RUNNABLE. The gate passes; the verdict turns on the acceptance criteria below.

## Per-criterion findings

The single AC bundles several requirements; taken one at a time:

### jsonwebtoken removed from deps — MET
`game/server/package.json` dependencies no longer list `jsonwebtoken`; the
package is fully removed from `game/pnpm-lock.yaml` (84 lines deleted). The only
remaining on-disk copies are stale `game/node_modules/.pnpm/jsonwebtoken@9.0.3/`
artifacts (install cache) and `game/coverage/` — neither is source.

### No JWT issuance/verification or JWT_SECRET/dev-secret/test-secret code — MET
`game/server/auth.js` is now pure session-cookie auth: `register`/`login` create
a server-side session via `createSession` and `setSessionCookie`, returning only
`{ accountId }`. All of `verifyToken`, `getJWTSecret`, `JWT_SECRET`,
`JWT_EXPIRATION`, the `'test-secret'` and `'dev-secret'` fallbacks, and the
`jwt.sign`/`jwt.verify` calls are gone (confirmed against the baseline diff).
`game/server/index.js` socket auth now reads the `ag_session` cookie and calls
`getSession` instead of `verifyToken(handshake.auth.token)`. The weak-default-secret
footgun is eliminated.

### Dockerfile/fly.toml env docs updated (no JWT_SECRET) — MET
`game/Dockerfile` and `game/fly.toml` contain no `JWT_SECRET` references.
`game/docs/auth-setup.md` correctly documents the opaque httpOnly `ag_session`
cookie and explicitly states no JWT signing secret is required.

### Full auth flow still works on sessions — MET
Proven by the round-3 capture (above) and by the server integration suite.

### Tests pass — MET (for game tests)
Ran `vitest` on `server/test/auth.test.js`, `account.test.js`,
`websocket_session_auth.test.js`, `integration.test.js`: 220 passed, 0 failed.
JWT-only suites (`jwt_recovery.test.js`, `multi_instance_jwt.test.js`,
`websocket_jwt_auth.test.js`) were correctly deleted; session equivalents remain.

### No dead JWT references — NOT MET (blocking)
Sub-ticket 04 migrated every `game/client/scripts/*.mjs` smoke script off the
JWT-token-injection pattern onto the new `game/client/scripts/session-auth.mjs`
helper (register/login via fetch + `credentials: 'include'`, relying on the
`ag_session` Set-Cookie). However, the **parallel** harness helper
`harness/validate/lib/auth.mjs` — same JWT pattern, the harness's own copy — was
not migrated and is now broken dead code:

- `registerUser()` returns `body.token`, but this ticket removed the `token`
  field from the `/api/register` and `/api/login` responses. `body.token` is now
  always `undefined`, so it falls through to login, also gets no token, and
  throws `"Auth failed for ..."`.
- `injectToken()` sets `localStorage('autogame_token')`, but no client code reads
  `autogame_token` anymore (verified: zero non-test matches under `game/client/`).

This helper is consumed by `harness/validate/playthrough.mjs`, exposed as the
`validate:playthrough` npm script in `harness/package.json`, so that script now
throws on the first `registerUser` call. The ticket goal explicitly says
"Remove any remaining references to the JWT path," and the AC requires "no dead
JWT references." This file is exactly such a reference and is the integration
gap the per-sub-ticket QA missed.

(The active QA/capture path uses `harness/screenshot.mjs`, which drives the
register UI form directly — that is why the round-3 capture still passed despite
this broken helper.)

## Remaining gaps

1. `harness/validate/lib/auth.mjs` is still JWT-token-injection code and is now
   broken (server returns no `token`; client ignores `autogame_token`), breaking
   `harness/validate/playthrough.mjs` / `npm run validate:playthrough`. This
   violates the "no dead JWT references" AC. Migrate it to session-cookie auth
   mirroring `game/client/scripts/session-auth.mjs` (in-page register/login with
   `credentials: 'include'`, then reload; drop `body.token` and the
   `autogame_token` localStorage injection).

## Nits (non-blocking)

- `game/client/test/main.test.js:3468` comment `// ── connect_error handler (JWT
  recovery) ──` is stale — the handler now recovers session-auth errors, not JWT.

VERDICT: FAIL
