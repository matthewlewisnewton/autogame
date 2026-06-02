# 01 — Account cosmetic storage, validation & PATCH route

Add a persistent `cosmetic` object to each account record and let players read
and update it through the existing authenticated profile endpoints, with
server-side validation and safe defaults backfilled for existing accounts.

## Acceptance Criteria
- Every account record carries `cosmetic: { bodyColor, accentColor, bodyShape }`.
  - Default cosmetic is applied at account creation (`createUser` /
    `createUserAsync`).
  - On load, any existing account record missing `cosmetic` (or missing one of
    its three fields) is backfilled with the defaults, so legacy accounts in
    `data/users.json` always expose a complete cosmetic object.
- A shared default/validation module defines:
  - `bodyShape` allowed values: `box`, `cylinder`, `cone`, `capsule`
    (default `box`).
  - `bodyColor` / `accentColor` validated as `#RRGGBB` hex strings
    (case-insensitive 6-digit hex) with documented default values.
- `updateProfile` (in `server/users.js`) accepts an optional `cosmetic` field:
  - A partial cosmetic object updates only the provided sub-fields and persists
    via the existing atomic `saveUsers()` write.
  - Invalid `bodyShape` (not in the enum) or malformed color (not `#RRGGBB`)
    causes the update to fail with `{ ok: false, reason: <message> }` and does
    NOT mutate or persist the record.
- `PATCH /api/me/profile` (in `server/account.js`) accepts a `cosmetic` field,
  returns the updated `cosmetic` in its 200 response body, and returns HTTP 400
  for invalid cosmetic input.
- `GET /api/me` includes the account's current `cosmetic` object in its response.
- Cosmetic values persist across a server restart (round-trip through
  `saveUsers()` / `loadUsers()`).

## Technical Specs
- `game/server/users.js`:
  - Add a `DEFAULT_COSMETIC` constant and validation helpers (or import them from
    a small new module — e.g. `game/server/cosmetic.js` — exporting
    `DEFAULT_COSMETIC`, `BODY_SHAPES`, and `validateCosmetic(partial)` returning
    `{ ok, value | reason }`). Keep it consistent with the existing CommonJS
    `require`/`module.exports` style.
  - Set `record.cosmetic = { ...DEFAULT_COSMETIC }` in `createUser` and
    `createUserAsync`.
  - In `loadUsers()`, backfill missing/partial `cosmetic` on each loaded record.
  - Extend `updateProfile(accountId, fields)` to handle `fields.cosmetic`:
    validate, merge onto `user.cosmetic`, and only `saveUsers()` on success
    (reuse the existing no-throw failure pattern used for username/email).
- `game/server/account.js`:
  - In the `PATCH /me/profile` handler, pull `cosmetic` from `req.body`, include
    it in the `updateProfile(...)` call, surface validation failures as HTTP 400,
    and add the current `cosmetic` to the 200 payload.
  - In `GET /me`, add `cosmetic: user.cosmetic` to the response object.
- Tests live alongside existing ones (`server/test/users.test.js`,
  `server/test/account.test.js`) — mirror their style.

## Verification: code
