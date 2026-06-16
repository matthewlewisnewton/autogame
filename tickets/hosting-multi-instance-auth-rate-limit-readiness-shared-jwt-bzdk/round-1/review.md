# Senior Review — Hosting: multi-instance auth + rate-limit readiness (shared JWT secret)

## Runtime health (gate)

The captured run is clean and the game is runnable:
- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block.
- `console.log`: no `pageerror` / `[fatal]` lines from game code.
- Probes show a full normal flow (lobby → ready → playing, movement, dodge-roll
  with cooldown HUD). Auth/WS handshake succeeded (`connectionState: connected`,
  `Latency: 1ms`), which is the relevant exercise for this ticket.

This ticket is intentionally a *readiness + documentation* deliverable. The only
production-code change is a one-line doc comment in `auth.js`; everything else is
a new test file and docs. So "no behavior change for single-instance" is true by
construction.

## Acceptance criteria

The single AC bundles several sub-requirements; taking them in turn:

**JWT verification confirmed stateless + secret-driven** — PASS.
`verifyToken()` (`game/server/auth.js:163`) validates with only the module-level
`JWT_SECRET` (`jwt.verify(token, JWT_SECRET)`); there is no session/identity map.
`initAuth()` reads `process.env.JWT_SECRET` once at boot (`auth.js:120`), and
`index.js:1777` calls it before serving. New test
`server/test/multi_instance_jwt.test.js` proves a token minted under a shared
secret still verifies after a simulated second-instance boot
(`resetAuthSecret()` + `initAuth()`), and is rejected when the second instance
uses a different secret. This is exactly the cross-instance property required.

**Clear boot failure if JWT_SECRET missing in production** — PASS.
`initAuth()` throws `Missing JWT_SECRET environment variable…` when
`NODE_ENV=production` and the secret is unset (`auth.js:133`). Covered by the new
`initAuth() production guard` test (`expect(() => initAuth()).toThrow('Missing JWT_SECRET')`).

**Rate-limiting Redis-backed OR documented per-instance** — PASS (documented).
The ticket explicitly permits keeping it per-instance if documented.
`game/docs/auth-setup.md` adds a thorough "Auth rate limiting (multi-instance)"
section: states the in-memory/per-process policy, the keying
(`action:ip:username`), defaults (10 / 60s, env-overridable), the 429 behavior,
the implementation (`rateLimitBuckets`, `pruneExpiredBuckets`,
`startRateLimitSweep`), the multi-instance brute-force implication (attempts
multiply by instance count — explicitly accepted), and concrete triggers for
revisiting a shared Redis store. The `startRateLimitSweep()` JSDoc now points to
this doc. I spot-checked the doc claims against code: keying, defaults, the
`io.use` WS verify path, and `index.js:1838` calling `startRateLimitSweep()` at
boot all match.

**Existing auth tests pass** — PASS. Ran the suites locally:
- `multi_instance_jwt.test.js` — 4 passed (new).
- `auth.test.js`, `websocket_jwt_auth.test.js`, `admin_roster.test.js` — 59 passed.

**Single-instance behavior unchanged** — PASS. No logic touched; only a comment
added to `auth.js` plus docs/tests.

## Design / foundation consistency

This is a backend hosting concern and does not touch gameplay; nothing in
`design.md`/`requirements.md` is affected, and the captured run confirms no
gameplay regression. No debug scenarios were added or changed.

## Code quality

The test correctly uses `createRequire` to exercise the same CJS module the
server uses (consistent with the project's known dual-module-instance gotcha),
saves/restores `NODE_ENV` and `JWT_SECRET` around each block, and resets module
secret state in before/after hooks. Documentation is accurate and actionable. No
dead code, no console errors.

## Remaining gaps

None blocking. The ticket is fully and robustly satisfied.

VERDICT: PASS
