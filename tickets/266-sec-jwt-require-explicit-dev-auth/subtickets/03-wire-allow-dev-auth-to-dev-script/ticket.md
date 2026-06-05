# 03-wire-allow-dev-auth-to-dev-script

Add `ALLOW_DEV_AUTH=1` to the server dev script so `pnpm run dev` starts without throwing from `initAuth()`.

## Acceptance Criteria

- `game/server/package.json` dev script prefixes `ALLOW_DEV_AUTH=1` before the nodemon command.
- Running `pnpm run dev` from `game/server/` starts the server successfully (no `Missing JWT_SECRET` error).

## Technical Specs

- **File**: `game/server/package.json`
- Change `"dev": "nodemon index.js"` to `"dev": "ALLOW_DEV_AUTH=1 nodemon index.js"`

## Verification: code
