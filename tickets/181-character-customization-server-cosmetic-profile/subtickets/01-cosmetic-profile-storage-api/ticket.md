# Cosmetic profile storage + validated PATCH/GET API

Give every account a persistent `cosmetic { bodyColor, accentColor, bodyShape }`
field with sane defaults (including migration for existing accounts), and extend
the authenticated profile route to read it and accept validated updates. This is
the data-and-API foundation for character customization; no runtime/render work.

## Acceptance Criteria
- The account record type gains a `cosmetic` object with keys `bodyColor`,
  `accentColor` (hex color strings) and `bodyShape` (enum). Newly created
  accounts get default cosmetic values.
- Existing accounts loaded from `users.json` that have no `cosmetic` field are
  backfilled with the defaults on load, so `findUserByAccountId` always returns a
  complete `cosmetic` object.
- `users.js` exports a validation/normalization helper that accepts a partial
  cosmetic object and rejects invalid input: `bodyShape` must be one of
  `box | cylinder | cone | capsule`; `bodyColor`/`accentColor` must pass a
  server-side hex/allowlist check (e.g. `/^#[0-9a-fA-F]{6}$/` or membership in a
  defined palette). Invalid values are rejected, not silently coerced.
- `updateProfile` (or a clearly-named cosmetic update path it delegates to)
  accepts a `cosmetic` field, validates it, merges it onto the user record, and
  persists via the existing atomic `saveUsers()` write. A partial update (e.g.
  only `bodyShape`) leaves the other cosmetic keys untouched.
- `PATCH /api/me/profile` accepts a `cosmetic` field: a valid update returns
  `200` with the updated cosmetic in the response body; an invalid value returns
  `400` with an error message and does NOT mutate or persist the record.
- `GET /api/me` includes the account's current `cosmetic` object in its response.
- Cosmetic changes round-trip and survive a server restart (persisted to
  `users.json` and reloaded).

## Technical Specs
- `game/server/users.js`:
  - Define `DEFAULT_COSMETIC` and the validation constants (`BODY_SHAPES` enum,
    palette/hex rule). Add a `normalizeCosmetic(partial)` (or
    `validateCosmetic`) helper returning `{ ok, value }` or `{ ok:false, reason }`.
  - In `loadUsers()` (or a small migrate step), backfill `record.cosmetic` with
    `DEFAULT_COSMETIC` when missing/partial.
  - In `createUser` / `createUserAsync`, set `cosmetic: { ...DEFAULT_COSMETIC }`.
  - Extend `updateProfile(accountId, fields)` to handle `fields.cosmetic`:
    validate, merge onto `user.cosmetic`, and `saveUsers()`. Return a reason on
    invalid input so the route can map it to `400`.
  - Export any new helpers/constants needed by the route and tests.
- `game/server/account.js`:
  - `PATCH /api/me/profile` (line ~69): allow `cosmetic` in the request body,
    pass it to `updateProfile`, map validation failures to `400`, and include the
    updated `cosmetic` in the success payload.
  - `GET /api/me` (line ~40): include `cosmetic: user.cosmetic` in the response.
- Tests: extend `game/server/test/users.test.js` and
  `game/server/test/account.test.js` to cover defaults, migration backfill,
  valid/invalid validation, partial update, the `400` reject path, and the
  `GET /api/me` cosmetic field.

## Verification: code
