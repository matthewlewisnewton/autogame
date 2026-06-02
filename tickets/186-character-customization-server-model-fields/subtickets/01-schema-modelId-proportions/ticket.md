# Define modelId and proportions schema with defaults

Add the `modelId` and `proportions` fields to the cosmetic schema constants in `cosmetic.js`. This sub-ticket only defines the data structures, constants, and defaults — no validation logic yet.

## Acceptance Criteria

- `MODEL_IDS` array exported from `cosmetic.js` containing `['player']` as the initial allowlist
- `PROPORTION_KEYS` array exported listing the six canonical keys: `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`
- `PROPORTION_RANGES` object exported mapping each key to `{ min, max }` numeric bounds (e.g., height: 0.8–1.2, headSize: 0.7–1.3, torsoWidth: 0.7–1.3, armLength: 0.8–1.2, legLength: 0.8–1.2, shoulderWidth: 0.7–1.3)
- `DEFAULT_COSMETIC` updated to include `modelId: 'player'` and `proportions: { height: 1.0, headSize: 1.0, torsoWidth: 1.0, armLength: 1.0, legLength: 1.0, shoulderWidth: 1.0 }`
- New exports added to `module.exports` at bottom of `cosmetic.js`

## Technical Specs

- **File**: `game/server/cosmetic.js`
- Add `MODEL_IDS = ['player']` constant near `BODY_SHAPES`
- Add `PROPORTION_KEYS = ['height', 'headSize', 'torsoWidth', 'armLength', 'legLength', 'shoulderWidth']`
- Add `PROPORTION_RANGES` map with `{ min, max }` per key
- Extend `DEFAULT_COSMETIC` with `modelId` and `proportions` (all 1.0 defaults)
- Export all new constants in `module.exports`

## Verification: code
