# Wire profile read paths to async provider lookup

HTTP `GET /api/me`, `requireAuth`, and Socket.IO session middleware still call sync `findUserByAccountId`, which returns stale cached data on instance B after instance A updates Postgres. Switch these hot profile-read paths to `findUserByAccountIdAsync` and add an integration test covering the ticket's stale-read symptom.

## Acceptance Criteria

- `game/server/account.js`
  - `requireAuth`: resolves `req.username` via `await findUserByAccountIdAsync(session.accountId)`
  - `GET /api/me`: loads profile via `await findUserByAccountIdAsync(req.accountId)` instead of sync cache lookup
  - `PATCH /api/me/profile` response path uses the post-update record from `findUserByAccountIdAsync` (or the object returned by the already-fixed `updateProfile`)
- `game/server/index.js` Socket.IO `io.use()` middleware: resolves username with `await findUserByAccountIdAsync(session.accountId)`; still rejects with `Session account not found` when null
- Cross-instance stale-read regression in `game/server/test/users_postgres_provider.test.js` (or a focused new test file):
  - Instance A updates email to `crosstest@example.com`
  - Instance B (warm stale cache, no intervening write): `await findUserByAccountIdAsync` then a simulated `GET /api/me` payload built from that record returns `email: 'crosstest@example.com'` (not `null` or the pre-update value)
- Full server test suite (`pnpm test` from `game/`) passes

## Technical Specs

- **File:** `game/server/account.js` — import `findUserByAccountIdAsync`; make `requireAuth` and `GET /api/me` await the async lookup
- **File:** `game/server/index.js` — socket auth middleware (~line 1960): replace sync `findUserByAccountId` with `await findUserByAccountIdAsync`
- **File:** `game/server/test/users_postgres_provider.test.js` — add stale-read regression case; optionally extract a small helper to build the `/api/me` profile shape for assertion without standing up two HTTP ports
- Do **not** change `settings.js`, player persistence, or unrelated `findUserByAccountId` call sites (quest gating, lobby handlers) in this sub-ticket — profile HTTP/socket read paths only

## Verification: code
