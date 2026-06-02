# 02 — Add bodyModel field to cosmetic profile storage and validation

Extend the per-account cosmetic profile to include a `bodyModel` field. The field stores the player's chosen body model key (from the registry defined in sub-ticket 01). Validation ensures only registered model keys are accepted; invalid input is rejected with a 400.

## Acceptance Criteria
- `DEFAULT_COSMETIC` gains a `bodyModel: 'default'` field.
- `validateCosmetic()` accepts a partial `bodyModel` string and validates it against the registered model keys; rejects unknown keys with a 400-level error reason.
- `backfillCosmetic()` fills missing or invalid `bodyModel` with the default (`'default'`).
- New accounts created via `createUser()` get `cosmetic.bodyModel: 'default'`.
- `PATCH /api/me/profile` accepts `{ cosmetic: { bodyModel: 'player' } }` and persists it.
- Legacy accounts without `bodyModel` are backfilled on load.
- Existing cosmetic fields (`bodyColor`, `accentColor`, `bodyShape`) continue to work unchanged.
- Unit tests cover: validation of valid/invalid model keys, backfill on legacy records, partial merge (only `bodyModel` changes), and persistence round-trip.

## Technical Specs
- **Changed file:** `game/server/cosmetic.js` — add `bodyModel` to `DEFAULT_COSMETIC`, `validateCosmetic()`, and `backfillCosmetic()`
- **Changed file:** `game/server/test/cosmetic.test.js` — add tests for `bodyModel` validation and backfill
- **Changed file:** `game/server/test/users.test.js` — add tests for `bodyModel` in account creation and profile update
- **Changed file:** `game/server/test/account.test.js` — add test for PATCH profile with `bodyModel`
- Use `getAvailableModelKeys()` from the model registry to validate; reject keys not in the allowlist

## Verification: code
