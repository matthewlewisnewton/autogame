# 01 — Hat Catalog, Cosmetic Hat Field & Equip Validation

Add a server-side hat catalog and extend the per-account cosmetic profile so a
player can have an equipped hat, and the account tracks which hats it owns.
Equipping is only allowed for hats the account has unlocked. This is the schema
foundation; spending currency to unlock hats is handled by sub-ticket 02.

## Acceptance Criteria
- A hat catalog is defined server-side as a list of hats, each with an `id`,
  a display `name`, and an integer currency `price`. It includes a default
  bare-head entry with id `none` and price `0`, plus at least 3 purchasable
  hats with positive prices.
- `DEFAULT_COSMETIC` gains a `hat` field defaulting to `'none'`.
- Account records gain an `unlockedHats` array defaulting to `['none']`, set on
  new accounts (both sync and async create paths) and backfilled on load for
  legacy records that lack it (or whose value is missing/invalid).
- `backfillCosmetic` fills a missing/invalid `hat` from the default `'none'`,
  and only accepts `hat` values that exist in the catalog.
- `validateCosmetic` rejects an unknown `hat` id with a 400-style reason and
  accepts any catalog hat id.
- `updateProfile` rejects (returns `{ ok: false }`, surfaced as HTTP 400) an
  attempt to set `cosmetic.hat` to a hat NOT present in the account's
  `unlockedHats`; it accepts and persists equipping a hat that IS unlocked.
- `GET /api/me` returns the account's `unlockedHats` array and the full hat
  catalog so clients can render owned/available options and prices.

## Technical Specs
- `game/server/cosmetic.js`:
  - Add `HAT_CATALOG` (array of `{ id, name, price }`) including `{ id: 'none',
    name: 'No Hat', price: 0 }` and ≥3 priced hats. Export it plus a derived
    `HAT_IDS` set/array and a `getHat(id)` lookup helper.
  - Add `hat: 'none'` to `DEFAULT_COSMETIC`.
  - Extend `validateCosmetic` to validate a provided `hat` against `HAT_IDS`.
  - Extend `backfillCosmetic` to backfill/validate the `hat` field.
  - Add `DEFAULT_UNLOCKED_HATS` (`['none']`) and a `backfillUnlockedHats(existing)`
    helper that returns a deduped array of valid catalog ids, always including
    `'none'`.
- `game/server/users.js`:
  - Import the new helpers. Set `unlockedHats: [...DEFAULT_UNLOCKED_HATS]` in
    both `createUser` and `createUserAsync`.
  - In `loadUsers`, backfill `record.unlockedHats` via `backfillUnlockedHats`.
  - In `updateProfile`, when `fields.cosmetic.hat` is provided, reject with a
    clear reason if that hat id is not in the user's `unlockedHats` (check
    before merging the validated cosmetic).
- `game/server/account.js`:
  - `GET /api/me` response gains `unlockedHats: user.unlockedHats` and
    `hatCatalog: HAT_CATALOG` (import from `./cosmetic`).
- Keep existing `bodyColor`/`accentColor`/`bodyShape` behavior unchanged.

## Verification: code
