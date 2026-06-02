# Expose modelId, proportions, and available options via profile API

Make the new `modelId` and `proportions` fields visible through the account API so the client can read current values and discover available options. Also expose the schema constants (`MODEL_IDS`, `PROPORTION_KEYS`, `PROPORTION_RANGES`) so the client UI can build valid selectors.

## Acceptance Criteria

- `GET /api/me` response includes `modelId` and `proportions` inside the `cosmetic` object
- `GET /api/me` response includes `modelIds` array (available model allowlist) and `proportionConfig` object (`{ keys, ranges }`) so the client can build UI controls
- `PATCH /api/me/profile` accepts `cosmetic.modelId` and `cosmetic.proportions` in the request body and correctly delegates to `updateProfile()` (which validates via `validateCosmetic()` from sub-ticket 02)
- PATCHing an invalid `modelId` or out-of-range `proportions` returns a 400 error with reason
- Existing account API tests continue to pass

## Technical Specs

- **File**: `game/server/account.js` — Update the `GET /api/me` handler to spread `modelIds: MODEL_IDS` and `proportionConfig: { keys: PROPORTION_KEYS, ranges: PROPORTION_RANGES }` into the response (import constants from `cosmetic.js`)
- **File**: `game/server/account.js` — The `PATCH /api/me/profile` handler already passes `cosmetic` to `updateProfile()`; no structural change needed since sub-ticket 02/03 handle validation and storage
- **File**: `game/server/test/account.test.js` (or equivalent integration test) — add tests for GET `/api/me` returning new fields, and PATCH with valid/invalid `modelId` and `proportions`

## Verification: code
