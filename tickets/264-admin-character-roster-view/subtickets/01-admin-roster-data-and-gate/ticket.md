# Admin roster aggregation + ADMIN_PASSWORD gate

Build the backend pieces for the admin view: a function that enumerates every
account and joins it with that account's persisted character/progression data
into one read-only roster array, plus an admin-only auth middleware gated by the
`ADMIN_PASSWORD` env var (completely separate from the player JWT auth). No HTTP
route is added in this sub-ticket — only the reusable, tested building blocks.

## Acceptance Criteria

- `users.js` exports a new `getAllUsers()` that returns an array of every
  in-memory account record (snapshot/shallow copies, not live references).
- A new module `game/server/admin.js` exports `buildAdminRoster()` that returns
  an array with one entry per account, each entry combining:
  - account fields: `username`, `accountId`, `email` (or null), full `cosmetic`
    config (including the equipped `hat`), `unlockedHats`, and
    `unlockedQuestTiers` (the progression / level-2 tier unlock map).
  - character/progression fields loaded from the storage provider via
    `loadPlayer(accountId)`: `currency`, `inventory`/`ownedCards`,
    `selectedDeck`, and `equippedKeyItemId`. When the account has no persisted
    player file (`loadPlayer` returns null), these fields default to safe empty
    values (e.g. `currency: 0`, empty deck/inventory) instead of throwing.
- `buildAdminRoster()` is purely read-only: it never calls `savePlayer`,
  `saveUsers`, or mutates any account/player record.
- `admin.js` exports a `requireAdminPassword(req, res, next)` Express middleware:
  - reads the supplied password from the `x-admin-password` request header OR a
    `?password=` query param.
  - compares it against `process.env.ADMIN_PASSWORD`.
  - if `ADMIN_PASSWORD` is unset/empty → deny ALL requests (fail closed) with
    HTTP 403.
  - wrong or missing supplied password → HTTP 403.
  - correct password → calls `next()`.
  - it NEVER reads `Authorization: Bearer` / consults the player JWT.
- A new test file `game/server/test/admin_roster.test.js` covers:
  `getAllUsers()` returns created accounts; `buildAdminRoster()` joins persisted
  currency/deck data for an account that has played and uses safe defaults for
  one that hasn't; `requireAdminPassword` denies (unset env, wrong password,
  missing password) and allows (correct password).

## Technical Specs

- `game/server/users.js`: add and export `getAllUsers()` returning
  `Array.from(users.values()).map(r => ({ ...r }))` (omit/keep `passwordHash` as
  you prefer, but do NOT expose it in the roster — exclude it here or in
  `admin.js`). Add to `module.exports`.
- `game/server/admin.js` (new): require `getAllUsers` from `./users` and the
  provider accessor `getProvider` from `./index` (or pass the provider in — see
  note) to call `loadPlayer(accountId)`. To avoid a circular `require('./index')`
  at module load, look up the provider lazily inside `buildAdminRoster()` (e.g.
  `require('./index').getProvider()`), matching how `index.js` exposes
  `getProvider`. Export `buildAdminRoster` and `requireAdminPassword`.
- Use a constant-time comparison (e.g. `crypto.timingSafeEqual` on equal-length
  buffers, guarding length first) for the password check.
- `game/server/test/admin_roster.test.js` (new): follow the vitest + `startServer(0)`
  + `setTestFilePath`/`setTestProvider` patterns used in `test/account.test.js`
  and `test/hat_unlock_persistence.test.js`. Set/clear `process.env.ADMIN_PASSWORD`
  in the test.

## Verification: code
