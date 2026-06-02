# Wire modelId and proportions through user storage and backfill

Integrate the new `modelId` and `proportions` cosmetic fields into the user persistence layer so they are correctly backfilled on load, saved on profile update, and included in the player record built at connect time.

## Acceptance Criteria

- `loadUsers()` in `users.js` calls `backfillCosmetic()` which now correctly backfills `modelId` and `proportions` (from sub-ticket 02) — legacy records without these fields get defaults
- `updateProfile()` in `users.js` correctly passes `modelId` and `proportions` through `validateCosmetic()` and merges validated values into `user.cosmetic`
- `buildPlayerRecord()` in `index.js` includes `modelId` and `proportions` in the player's `cosmetic` object sourced from the account
- `stateSnapshot()` in `progression.js` broadcasts `modelId` and `proportions` as part of each player's cosmetic in the `stateUpdate` payload (no code change needed if backfill + DEFAULT_COSMETIC are correct, since snapshot spreads the full cosmetic object)
- Existing user/cosmetic tests continue to pass

## Technical Specs

- **File**: `game/server/users.js` — `updateProfile()` already spreads `fields.cosmetic` through `validateCosmetic()`; verify the merged result includes `modelId` and `proportions` after validation. No structural change needed if sub-ticket 02's validation returns these fields in `value`.
- **File**: `game/server/users.js` — `loadUsers()` already calls `backfillCosmetic()`; verify it correctly handles new fields after sub-ticket 02.
- **File**: `game/server/index.js` — `buildPlayerRecord()` sources `account?.cosmetic ?? { ...DEFAULT_COSMETIC }`; verify new fields propagate (should be automatic if DEFAULT_COSMETIC and backfill are updated).
- **File**: `game/server/test/users.test.js` — add test cases for updating `modelId` and `proportions` through `updateProfile()`, including valid updates, rejection of invalid values, and backfill on load

## Verification: code
