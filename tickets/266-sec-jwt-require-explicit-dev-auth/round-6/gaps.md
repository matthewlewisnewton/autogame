1. PORT env var enables dev-secret without explicit ALLOW_DEV_AUTH=1, reopening the staging auth bypass the ticket closes.
   Files: game/server/auth.js (lines 78–93), game/server/test/auth.test.js (PORT fallback tests)
   Fix: Remove the `if (process.env.PORT)` dev-secret block from `initAuth()`; update tests to expect throw when only PORT is set in non-production. Ensure harness capture receives `ALLOW_DEV_AUTH=1` (server log should show `ALLOW_DEV_AUTH=1`, not `PORT=…`).
