# Document shared JWT_SECRET for multi-instance hosting

Extend auth documentation so operators know horizontal scale requires an identical `JWT_SECRET` on every instance and that WebSocket/REST auth is stateless (no per-instance auth session store).

## Acceptance Criteria

- **`game/docs/auth-setup.md`** includes a **Horizontal scaling / multi-instance** section that states:
  - Every server instance must use the **same** `JWT_SECRET` value (e.g. from a shared secret manager or identical env injection).
  - Tokens are verified via `verifyToken()` using only that secret — no sticky sessions or per-instance auth state are required for JWT validation.
  - WebSocket connections authenticated in `game/server/index.js` (`io.use` middleware calling `verifyToken`) work on any instance when the secret matches.
  - Production boot still requires `JWT_SECRET` (`NODE_ENV=production` throws if unset); `ALLOW_DEV_AUTH` must not be used in production.
- Wording aligns with existing error messages and `initAuth()` behavior in `game/server/auth.js`.
- No runtime code changes.

## Technical Specs

- Edit **`game/docs/auth-setup.md`** only.
- Add a concise section (roughly half a screen) after the existing Production block covering the bullets above.
- Reference that login (`POST /api/login`) signs with `JWT_SECRET` and any instance with the same secret can validate the token for `/api/me` (`game/server/account.js`) and Socket.IO handshake auth.
- Mention that user account data persistence is separate from JWT validation (shared filesystem/DB is a different hosting concern).

## Verification: code
