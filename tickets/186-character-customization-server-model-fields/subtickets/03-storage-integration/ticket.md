# 03-storage-integration: wire modelId and proportions through user storage and backfill

Wire the new `modelId` and `proportions` fields through the user account storage layer. Ensure `createUser()` initializes these fields, `updateProfile()` deep-merges partial proportion updates (so updating `height` doesn't erase `armLength`), and `loadUsers()` backfills legacy records.

## Acceptance Criteria
- `createUser()` / `createUserAsync()` initialize new accounts with `modelId: 'player'` and default proportions (all `1.0`)
- `updateProfile()` with a partial `proportions` object deep-merges onto existing proportions (only the provided keys change, others are preserved)
- `loadUsers()` applies `backfillCosmetic()` which includes modelId and proportions for legacy records
- Unit tests verify: deep-merge behavior, legacy record backfill on load, and createUser defaults

## Technical Specs
- **File:** `game/server/users.js`
  - Update `updateProfile()` cosmetic merge: after `backfillCosmetic()`, deep-merge `proportions` so partial updates don't erase other keys: `merged.proportions = { ...base.proportions, ...result.value.proportions }` when `result.value.proportions` is defined
  - `createUser()` already spreads `DEFAULT_COSMETIC` which now includes modelId/proportions from sub-ticket 01 — verify this works correctly
  - `loadUsers()` already calls `backfillCosmetic()` — no change needed since sub-ticket 01/02 extended the backfill
- **File:** `game/server/test/users.test.js`
  - Test that `updateProfile` with `{ cosmetic: { proportions: { height: 1.1 } } }` preserves existing `armLength`, `legLength`, etc.
  - Test that `createUser` includes `modelId` and `proportions` in the cosmetic
  - Test that loading a legacy record without modelId/proportions gets backfilled

## Verification: code
