# 01-extract-pickvariant-seam

Extract the RNG-to-variant-id selection logic inside `applyVariant` into a standalone `pickVariant(rng, ids)` function so tests can stub or bypass the RNG mapping.

## Acceptance Criteria

- `game/server/enemyVariants.js` exports a new `pickVariant(rng, ids)` function that takes an RNG function and an array of variant id strings, and returns one id from the array using `Math.floor(rng() * ids.length)`.
- `applyVariant` calls `pickVariant(rng, ids)` instead of inline `ids[Math.min(ids.length - 1, Math.floor(pick * ids.length))]`.
- Existing behavior is preserved: same RNG input produces the same selected variant id.
- All existing tests in `enemy_variants.test.js` and `warded_variant.test.js` still pass.

## Technical Specs

- **File**: `game/server/enemyVariants.js`
  - Add `function pickVariant(rng, ids)` near the top (before `applyVariant`).
  - Replace the inline pick logic at ~line 98-100 with `const id = pickVariant(rng, ids);`.
  - Add `pickVariant` to `module.exports`.
- No other files changed.

## Verification: code
