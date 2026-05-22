# Fix Express Middleware Stacking in Auth Tests

Each call to `startServer()` mounts `app.use('/api', authRouter)` again, stacking duplicate Express route handlers across test server restarts. The socket layer already uses `io.removeAllListeners('connection')` to avoid stacking — the Express layer needs the same treatment. Without this fix, auth tests hit the durable `game/data/users.json` instead of the isolated temp user store, causing first registrations for `alice`/`bob` to return `409`.

## Acceptance Criteria
- Calling `startServer()` multiple times (as tests do in `beforeEach`) does **not** stack duplicate Express route handlers.
- Auth tests (`server/test/auth.test.js`) can register `alice`/`bob` and receive `201` on the first registration (not `409` from a stale durable user file).
- The temp user file path set by `setTestFilePath()` in `beforeEach` is the one actually used by the auth route during the test.
- All existing auth tests pass without modification.

## Technical Specs
- **File**: `game/server/index.js`
  - Before mounting `app.use('/api', authRouter)` inside `startServer()`, remove previously mounted routers on the `/api` mount path. The simplest approach: reset `app._router` or create a fresh `express()` instance per `startServer()` call. Alternatively, track whether routes have been mounted and skip re-mounting, but since `app` is module-level, the cleanest fix is to call `app._router.stack.splice(0)` before adding middleware, or reconstruct `app` inside `startServer()`.
  - Ensure the `express.json()` middleware is also not duplicated (it's currently added unconditionally before the auth router mount).
  - **Recommended approach**: move `const app = express()` and `app.use(express.json())` and `app.use('/api', authRouter)` into `startServer()` so each call gets a fresh Express app, then re-attach it to the HTTP server. Or alternatively, guard the mount with a flag, or clear the router stack before each mount.

- **File**: `game/server/test/auth.test.js` (verify only — no code changes needed if the fix is in `index.js`)
  - Confirm that `startTestServer()` in `beforeEach` produces a clean Express app with a single set of auth routes.

## Verification: code
