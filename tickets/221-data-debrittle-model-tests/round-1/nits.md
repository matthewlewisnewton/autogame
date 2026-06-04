## Remove unused `pickVariant` import in warded_variant.test.js

`game/server/test/warded_variant.test.js` imports `pickVariant` after the refactor but only uses explicit `enemy.variant` assignment. Drop the unused import to avoid lint noise.

### Acceptance Criteria
- `warded_variant.test.js` has no unused imports.
- All tests in that file still pass.

## Debrittle remaining `CARD_DEFS` length assertions

`card_acquisition.test.js` and `client/test/cards.test.js` still use `expect(Object.keys(CARD_DEFS)).toHaveLength(42)`, the same merge-churn pattern fixed in `new_card_pack.test.js` / `card_registry.test.js`.

### Acceptance Criteria
- Replace exact-length checks with `toBeGreaterThanOrEqual` (or per-id presence) and a short comment where a floor is intentional.
- Adding a new card without editing unrelated test files does not fail CI.

## De-index `enemy_variants.test.js` “test” variant cases

Two tests still use `seqRng([0.01, 0])` assuming registry index 0 is `'test'`. Safer pattern matches `warded_variant.test.js`: explicit `variant` assignment or a stubbed `pickVariant`.

### Acceptance Criteria
- No test in `enemy_variants.test.js` depends on `Object.keys(VARIANT_DEFS)[0]` being a specific id.
- Inserting a new variant anywhere in `VARIANT_DEFS` does not break unrelated variant tests.

## Add focused `pickVariant` unit tests

The seam is exported but only exercised indirectly. A small describe block with a fixed RNG sequence would document the contract and guard against accidental formula changes.

### Acceptance Criteria
- Tests cover empty/single/multi-id arrays and boundary rolls (`0`, `1 - ε`).
- `pickVariant` behavior matches pre-extraction `applyVariant` selection for the same inputs.
