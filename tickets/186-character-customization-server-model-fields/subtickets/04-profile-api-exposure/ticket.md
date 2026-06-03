# 04-profile-api-exposure: expose modelId, proportions, and schema constants via profile API

Add `modelIds` and `proportionConfig` to the `GET /api/me` response so the client can discover available model options and valid proportion ranges for building UI controls. The `PATCH /api/me/profile` route already delegates to `updateProfile()` which validates through `validateCosmetic()` — no handler change needed beyond the GET enrichment.

## Acceptance Criteria
- `GET /api/me` response includes `modelIds` array (e.g. `['player']`)
- `GET /api/me` response includes `proportionConfig` object with `keys` (array of proportion key strings) and `ranges` (object mapping each key to `{ min, max }`)
- Existing `cosmetic` field in `GET /api/me` already includes `modelId` and `proportions` from the user record (automatic via sub-ticket 03)
- `PATCH /api/me/profile` correctly accepts and persists `modelId` and `proportions` updates (validated by sub-ticket 02, stored by sub-ticket 03)
- Unit tests verify the new response fields are present and correctly structured

## Technical Specs
- **File:** `game/server/account.js`
  - Import `MODEL_IDS`, `PROPORTION_KEYS`, `PROPORTION_RANGES` from `./cosmetic`
  - Add `modelIds: MODEL_IDS` and `proportionConfig: { keys: PROPORTION_KEYS, ranges: PROPORTION_RANGES }` to the `GET /api/me` response object
- **File:** `game/server/test/account.test.js`
  - Test that `GET /api/me` response contains `modelIds` array with `'player'`
  - Test that `proportionConfig.keys` matches `PROPORTION_KEYS`
  - Test that `proportionConfig.ranges` has correct min/max for each proportion key
  - Test that `PATCH /api/me/profile` with `{ cosmetic: { modelId: 'player', proportions: { height: 1.1 } } }` persists and returns correctly

## Verification: code
