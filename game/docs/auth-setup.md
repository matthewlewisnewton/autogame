# Auth Setup

The server requires a JWT secret before accepting connections. There are two ways to provide one:

## Local development

Set `ALLOW_DEV_AUTH=1` to explicitly opt in to an insecure dev fallback secret (`dev-secret`). The dev script does this automatically:

```bash
pnpm run dev   # runs: ALLOW_DEV_AUTH=1 nodemon index.js
```

If you start the server without `JWT_SECRET` and without `ALLOW_DEV_AUTH=1`, it throws:

```
Missing JWT_SECRET environment variable. Set JWT_SECRET to a cryptographically random value, or set ALLOW_DEV_AUTH=1 to explicitly enable the insecure dev fallback secret. Example: JWT_SECRET=$(openssl rand -hex 32) node server/index.js
```

## Production

Set `JWT_SECRET` to a cryptographically random value. Do not use `ALLOW_DEV_AUTH` in production — the server throws if `NODE_ENV=production` and no `JWT_SECRET` is set:

```
Missing JWT_SECRET environment variable. Set JWT_SECRET to a cryptographically random value before starting the server. Example: JWT_SECRET=$(openssl rand -hex 32) node server/index.js
```

Example:

```bash
JWT_SECRET=$(openssl rand -hex 32) node server/index.js
```

## Horizontal scaling / multi-instance

When you run more than one server process behind a load balancer, every instance must use the **same** `JWT_SECRET` value — inject the identical secret on each host (for example from a shared secret manager or the same env var in your orchestrator). `initAuth()` reads `JWT_SECRET` once at boot; there is no per-instance auth session store and no sticky sessions required for JWT validation.

Auth is stateless: `verifyToken()` in `game/server/auth.js` validates tokens with only that shared secret. `POST /api/login` signs tokens with `JWT_SECRET`; any instance that shares the secret can validate those tokens for `GET /api/me` (`game/server/account.js`, `Authorization: Bearer`) and for Socket.IO handshakes (`io.use` middleware in `game/server/index.js` calls `verifyToken` on `socket.handshake.auth.token`). A client may log in on one instance and connect WebSockets or call REST on another as long as the secret matches.

Production boot rules still apply on every instance: `NODE_ENV=production` without `JWT_SECRET` throws the same `Missing JWT_SECRET environment variable` error from `initAuth()`. Do not use `ALLOW_DEV_AUTH` in production.

User account data (registrations, profiles, settings) is persisted separately from JWT validation. Ensuring all instances read the same user store (shared filesystem, database, etc.) is a different hosting concern; matching `JWT_SECRET` alone does not synchronize accounts across instances.
