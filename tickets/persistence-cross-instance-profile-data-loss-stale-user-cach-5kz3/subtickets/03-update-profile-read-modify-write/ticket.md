# `updateProfile` read-modify-write against provider

Refactor `updateProfile` so it never persists a stale in-memory blob. Before applying partial field updates, reload the authoritative record from the provider (via `findUserByAccountIdAsync` / `loadUserByAccountId`), merge only the requested fields onto that fresh copy, then persist — matching the `getSettings` → `updateSettings` pattern in `settings.js`.

## Acceptance Criteria

- `updateProfile` in `game/server/users.js` begins by loading the user via `await findUserByAccountIdAsync(accountId)` (or equivalent internal reload); returns `{ ok: false, reason: 'Account not found' }` when missing
- Username, email, and cosmetic merge logic is unchanged in behavior for single-instance/file-mode tests
- Cross-instance clobber regression (pg-mem, two warm instances sharing one pool):
  - Both instances call `loadUsersAsync` so the account is cached on A and B with the same initial email (e.g. `bside@example.com`)
  - Instance A: `updateProfile(accountId, { email: 'survive@example.com' })` → ok
  - Direct SQL/pg-mem query: `data->>'email'` is `'survive@example.com'`
  - Instance B (still holding stale cache): `updateProfile(accountId, { cosmetic: { bodyColor: '#ff0000' } })` → ok
  - Direct SQL/pg-mem query: `data->>'email'` remains `'survive@example.com'` (not reverted to `bside@example.com`)
  - Postgres/jsonb `cosmetic.bodyColor` is `'#ff0000'`
- Existing `users.test.js` profile/email/cosmetic tests pass

## Technical Specs

- **File:** `game/server/users.js` — refactor `updateProfile`:
  - Replace opening `findUserByAccountId(accountId)` with async provider reload
  - Keep username-change `users` Map key moves and `emailIndex` updates on the reloaded record
  - Keep `persistUserAsync(user)` at the end; cache is already fresh from reload + in-place mutation
- **File:** `game/server/test/users_postgres_provider.test.js` — add the two-instance sequential write test described above (query `users` table via shared pool between steps)

## Verification: code
