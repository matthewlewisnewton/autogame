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
