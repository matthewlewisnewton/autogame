# 01-schema-modelId-proportions: add modelId and proportions schema with defaults

Define `MODEL_IDS`, `PROPORTION_KEYS`, `PROPORTION_RANGES` constants in `cosmetic.js` and extend `DEFAULT_COSMETIC` with `modelId` (default `'player'`) and `proportions` (all `1.0`). Add unit tests for the new exports and update existing tests for the extended defaults.

## Acceptance Criteria
- `cosmetic.js` exports `MODEL_IDS` (array containing `['player']`), `PROPORTION_KEYS` (array of 6 proportion key strings), and `PROPORTION_RANGES` (object mapping each key to `{ min, max }` bounds)
- `DEFAULT_COSMETIC` includes `modelId: 'player'` and `proportions` object with all 6 keys set to `1.0`
- `backfillCosmetic()` returns the new fields (modelId and proportions) filled from defaults when missing
- Existing unit tests for `cosmetic.js` still pass with the extended `DEFAULT_COSMETIC`
- New unit tests cover: `MODEL_IDS` membership, `PROPORTION_KEYS` length, `PROPORTION_RANGES` structure, default proportions values, and backfill of missing modelId/proportions

## Technical Specs
- **File:** `game/server/cosmetic.js`
  - Add `MODEL_IDS = ['player']` constant
  - Add `PROPORTION_KEYS = ['height', 'headSize', 'torsoWidth', 'armLength', 'legLength', 'shoulderWidth']`
  - Add `PROPORTION_RANGES` object with `{ min, max }` per key (height: 0.8–1.2, headSize: 0.7–1.3, torsoWidth: 0.7–1.3, armLength: 0.8–1.2, legLength: 0.8–1.2, shoulderWidth: 0.7–1.3)
  - Extend `DEFAULT_COSMETIC` with `modelId: 'player'` and `proportions` object
  - Add `backfillProportions()` helper to fill missing proportion keys with `1.0`
  - Update `backfillCosmetic()` to include modelId and proportions backfill
  - Export new constants in `module.exports`
- **File:** `game/server/test/cosmetic.test.js`
  - Add tests for new constant exports and default values
  - Add tests for `backfillProportions()` and updated `backfillCosmetic()`
- **Files to update:** `game/server/test/cosmetic_runtime.test.js`, `game/server/test/users.test.js`, `game/server/test/account.test.js` — update any assertions that check `DEFAULT_COSMETIC` shape to include new fields

## Verification: code
