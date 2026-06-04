## 01-extract-pickvariant-seam

Extract the variant-selection RNG logic inside `applyVariant` into a standalone `pickVariant(rng, ids)` function so tests can stub or bypass the index-mapping and assert membership + effect rather than relying on `rng() * N` landing on a specific position.

## Acceptance Criteria

- `game/server/enemyVariants.js` exports a `pickVariant(rng, ids)` function that takes an RNG and an array of variant ids, calls `rng()` once, and returns `ids[Math.min(ids.length - 1, Math.floor(rng() * ids.length))]`.
- `applyVariant` calls `pickVariant(rng, ids)` instead of inlining the `rng() * ids.length` math.
- `pickVariant` is added to the `module.exports` object.
- Existing behavior of `applyVariant` is unchanged (same variant distribution for same RNG input).
- All existing tests in `enemy_variants.test.js` still pass.

## Technical Specs

- **File to change:** `game/server/enemyVariants.js`
  - Extract lines ~98-100 (the `const pick = ...; const id = ids[...]` block) into `function pickVariant(rng, ids)`.
  - Replace inline math in `applyVariant` with `const id = pickVariant(rng, ids);`.
  - Add `pickVariant` to `module.exports`.

## Verification: code
