# Senior Review — Auth: remove jsonwebtoken + JWT_SECRET and dev/test secret fallbacks

## Runtime health (captured run)

- `metrics.json`: `ok: true`, `pageerrors: []`, no `harness_failure`, `capturePlanValid: true`.
- `console.log`: only the expected pre-login `401 (Unauthorized)` session probe and the
  resulting transient WebSocket-closed warning, then both clients reach `[initScene]` and
  ready up. No `[fatal]` lines, no uncaught page errors from game code.
- Probes confirm the full flow works on session auth: both players reach `phase: "playing"`,
  `connectionState: "connected"`, movement (W/D) registers, and the dodge-roll key item shows
  a live cooldown (`keyItemCooldownRemaining: 342`, HUD `0.3`) that recovers to 0.

The game starts and loads cleanly. The 401/ws-closed lines are the normal unauthenticated
pre-login state before the session cookie is established — benign.

## Per-criterion findings

The single AC bundles several clauses; taken individually:

- **jsonwebtoken removed from deps** — ✅ `game/server/package.json` deps are
  `@socket.io/redis-adapter, bcrypt, express, ioredis, pg, socket.io`; `jsonwebtoken` gone.
  `game/pnpm-lock.yaml` updated (84 lines removed).
- **No JWT issuance/verification or JWT_SECRET/dev-secret/test-secret code** — ✅
  `game/server/auth.js` is fully session-based (`createSession`/`setSessionCookie`); no
  `verifyToken`, `getJWTSecret`, `JWT_SECRET`, or dev/test secret fallback remains. The socket
  handshake in `game/server/index.js` (~L1929) authenticates via the `ag_session` cookie +
  `getSession()` only. The insecure weak-default-secret footgun is gone.
- **Dockerfile / fly.toml env docs updated** — ✅ `game/Dockerfile` documents session storage
  with "no signing secret required today"; `game/fly.toml` no longer lists `JWT_SECRET`.
  `game/docs/auth-setup.md` correctly states no JWT secret is required.
- **Full auth flow still works on sessions** — ✅ confirmed by the captured run (above).
- **Tests pass** — ✅ `vitest run server/test/{auth,account,websocket_session_auth}.test.js`
  → 48 passed. JWT-only suites (`jwt_recovery`, `multi_instance_jwt`, `websocket_jwt_auth`)
  correctly deleted.
- **No dead JWT references** — ❌ NOT met. Three documentation/comment locations still
  describe or reference the removed JWT path (see gaps). One of them, `gameplay-review.md`,
  explicitly claims to describe "how the game actually behaves today" yet documents the old
  JWT flow — actively misleading about the auth mechanism this ticket just removed.

## Consistency with design / requirements

Consistent with the session-cookie auth direction; no foundation regression. The captured
run exercises lobby create/join, ready transition, movement, and key-item cooldown without
errors.

## Remaining gaps

The security-critical removal is complete and correct, and the game runs. The ticket fails
only on the explicit "no dead JWT references" / "Remove any remaining references to the JWT
path" clause: two docs (`gameplay-review.md`, `lobbies.md`) and the `admin.js` comments still
present JWT as the live auth mechanism. `gameplay-review.md` is a "current behavior" doc and
is now factually wrong about authentication, so this is more than cosmetic. See `gaps.md`.

VERDICT: FAIL
