# Register and Login REST Endpoints

Add Express routes (`POST /api/register`, `POST /api/login`) that accept a JSON body `{ username, password }`, validate inputs, and return a JWT on successful login. Uses `jsonwebtoken` for token issuance.

## Acceptance Criteria
- `jsonwebtoken` is listed as a server dependency.
- `POST /api/register` accepts `{ username, password }`:
  - Returns `201 { accountId }` on success.
  - Returns `409 { error: 'Username taken' }` when the username already exists.
  - Returns `400 { error: '...' }` when username or password is missing/empty, or username is <3 or >32 chars.
- `POST /api/login` accepts `{ username, password }`:
  - Returns `200 { token }` with a JWT containing `{ accountId, username }` on success.
  - Returns `401 { error: 'Invalid credentials' }` on wrong password or unknown username.
- JWT is signed with a secret read from `JWT_SECRET` env var (falls back to `'dev-secret'` for local dev).
- Token expiration is set to 24 hours (`'24h'`).
- Routes are mounted in `game/server/index.js` via `app.use(express.json())` and `app.use('/api', router)`.
- Unit tests exist for both endpoints (happy path + error cases); all pass.

## Technical Specs
- **New file**: `game/server/auth.js` — Express Router with `/register` and `/login` routes. Uses `createUser`, `findUserByUsername`, `comparePassword` from `./users.js` and `jwt.sign()` from `jsonwebtoken`.
- **Modify**: `game/server/index.js` — add `const authRouter = require('./auth');` and `app.use('/api', authRouter);` before `startServer()` call. Ensure `app.use(express.json())` is present for body parsing.
- **Modify**: `game/server/package.json` — add `"jsonwebtoken": "^9.0.2"` to dependencies.
- In `startServer()`, add `app.use(express.json())` if not already present.

## Verification: code
