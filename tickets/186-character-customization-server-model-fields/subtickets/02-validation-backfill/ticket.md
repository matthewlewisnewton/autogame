# 02-validation-backfill: add validation and backfill for modelId and proportions

Extend `validateCosmetic()` to reject unknown `modelId` values and out-of-range proportions. Extend `backfillCosmetic()` to restore defaults for missing or corrupt modelId/proportions data. Add comprehensive tests for the new validation and backfill paths.

## Acceptance Criteria
- `validateCosmetic()` rejects `modelId` not in `MODEL_IDS` with a structured error
- `validateCosmetic()` rejects proportion values outside `PROPORTION_RANGES` bounds with a structured error
- `validateCosmetic()` accepts partial proportions (only the provided keys are validated)
- `backfillCosmetic()` restores `modelId` to `'player'` when missing or invalid
- `backfillCosmetic()` fills missing proportion keys with `1.0` and clamps out-of-range values to bounds
- All new validation and backfill paths have dedicated unit tests (at least 15 test cases)

## Technical Specs
- **File:** `game/server/cosmetic.js`
  - Extend `validateCosmetic(partial)` to handle `modelId` field — check membership in `MODEL_IDS`
  - Extend `validateCosmetic(partial)` to handle `proportions` field — iterate provided keys, check `typeof val === 'number'` and within `PROPORTION_RANGES[key].min/max`
  - Update `backfillCosmetic()` to clamp proportion values to their `{ min, max }` bounds (not just fall back to 1.0)
  - Keep `backfillProportions()` helper for filling missing keys
- **File:** `game/server/test/cosmetic.test.js`
  - Tests for valid modelId acceptance
  - Tests for invalid modelId rejection (unknown string, number, null)
  - Tests for valid proportions acceptance (within range, partial object)
  - Tests for out-of-range proportions rejection (below min, above max, NaN, string)
  - Tests for backfill clamping (value below min → min, above max → max, missing key → 1.0)

## Verification: code
