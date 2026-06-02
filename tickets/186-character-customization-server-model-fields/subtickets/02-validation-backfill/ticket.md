# Add validation and backfill for modelId and proportions

Extend `validateCosmetic()` and `backfillCosmetic()` in `cosmetic.js` to handle the new `modelId` and `proportions` fields defined in sub-ticket 01. Validation must reject unknown model ids and out-of-range proportion values; backfill must restore defaults for missing or corrupt data.

## Acceptance Criteria

- `validateCosmetic()` accepts `modelId` string and validates it against `MODEL_IDS` allowlist; returns `{ ok: false, reason }` for unknown ids
- `validateCosmetic()` accepts `proportions` object and validates each provided key exists in `PROPORTION_KEYS` and its numeric value falls within `PROPORTION_RANGES[key].min` – `PROPORTION_RANGES[key].max`
- `validateCosmetic()` rejects `proportions` that is not a plain object, or contains unknown keys
- `validateCosmetic()` normalizes valid proportion values (trims/rounds or passes through numbers within bounds)
- `backfillCosmetic()` fills in missing `modelId` from `DEFAULT_COSMETIC.modelId` when absent or invalid
- `backfillCosmetic()` fills in missing `proportions` from `DEFAULT_COSMETIC.proportions`, merging per-key: keeps valid user values, replaces out-of-range or missing keys with defaults
- Existing validation for `bodyColor`, `accentColor`, `bodyShape`, `hat` continues to work unchanged
- Existing unit tests in `cosmetic.test.js` continue to pass

## Technical Specs

- **File**: `game/server/cosmetic.js`
- Add `modelId` branch inside `validateCosmetic()`: check `typeof partial.modelId === 'string'` and `MODEL_IDS.includes(partial.modelId)`
- Add `proportions` branch: iterate `Object.entries(partial.proportions)`, check each key is in `PROPORTION_KEYS`, each value is a finite number within range; reject unknown keys
- Update `backfillCosmetic()`: add `modelId` fallback line; add per-key merge for `proportions` (iterate `PROPORTION_KEYS`, check each value is a finite number in range, else use default)
- **File**: `game/server/test/cosmetic.test.js` — add test cases for new validation and backfill paths

## Verification: code
