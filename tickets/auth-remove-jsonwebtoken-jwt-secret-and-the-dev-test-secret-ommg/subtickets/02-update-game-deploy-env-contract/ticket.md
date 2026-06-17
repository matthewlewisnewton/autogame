# Update game deploy env contract (session cookies, no JWT_SECRET)

Update operator-facing deploy config and in-repo auth documentation under `game/` so they describe session-cookie auth only. Remove all `JWT_SECRET` / `ALLOW_DEV_AUTH` / JWT-verification requirements. This sub-ticket is scoped to `game/**` only — repo-root `CONTEXT.md` is handled separately in sub-ticket 05.

## Acceptance Criteria

- `game/Dockerfile` required-runtime-env comment no longer mentions `JWT_SECRET`; it documents opaque httpOnly `ag_session` cookies backed by Redis when `REDIS_URL` is set.
- `game/fly.toml` secrets comment no longer mentions `JWT_SECRET` (lists `DATABASE_URL`, `REDIS_URL`, etc. only).
- `game/docs/auth-setup.md` documents session-cookie auth for HTTP and WebSocket; no JWT verification, shared signing secret, or `ALLOW_DEV_AUTH` dev-fallback instructions remain.
- `rg -i 'JWT_SECRET|jsonwebtoken|verifyToken|ALLOW_DEV_AUTH' game/Dockerfile game/fly.toml game/docs/auth-setup.md` returns no matches.

## Technical Specs

- **`game/Dockerfile`** — Replace any `JWT_SECRET=<strong shared secret…>` line in the header comment with session-cookie auth notes (sessions stored in Redis when `REDIS_URL` is set; no signing secret required today).
- **`game/fly.toml`** — Update the `flyctl secrets set` example to omit `JWT_SECRET`.
- **`game/docs/auth-setup.md`** — Rewrite local dev, HTTP, WebSocket, production, and multi-instance sections:
  - HTTP: opaque `ag_session` cookie validated via Redis-backed `getSession()`.
  - WebSocket: same cookie forwarded on the upgrade handshake.
  - Multi-instance: shared `REDIS_URL` for session lookup (not a shared JWT secret).
  - Remove production `Missing JWT_SECRET` boot-failure docs and dev `ALLOW_DEV_AUTH=1` fallback docs.
  - Optionally mention that a future `SESSION_SECRET` env var could sign cookies if implemented later.
- Do **not** edit `CONTEXT.md` or any file outside `game/`.

## Verification: code
