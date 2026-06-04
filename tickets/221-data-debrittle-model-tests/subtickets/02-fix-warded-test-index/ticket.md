## 02-fix-warded-test-index

`warded_variant.test.js` hard-codes `seqRng([0.01, 0.5])` to land on 'warded' at index 2 of 5 variants. Adding or reordering any variant re-maps the index and breaks the test. Rewrite the test to stub `pickVariant` (from sub-ticket 01) or directly set the variant id, asserting membership + shield effect instead of the RNG-to-index mapping.

## Acceptance Criteria

- `warded_variant.test.js` no longer depends on `seqRng([0.01, 0.5])` to pick 'warded' by array index.
- The "tags warded and applies shield fields" test uses `pickVariant` stubbing or directly constructs an enemy with `variant: 'warded'` and calls `VARIANT_DEFS.warded.apply(enemy)` to verify shield fields.
- The "leaves shieldHp unset when the no-op test variant is selected" test similarly avoids index-based selection (asserts `enemy.variant === 'test'` by stubbing or direct construction).
- All tests in `warded_variant.test.js` still pass.
- Inserting a new variant into `VARIANT_DEFS` does not cause any test in this file to fail.

## Technical Specs

- **File to change:** `game/server/test/warded_variant.test.js`
  - Import `pickVariant` from `../enemyVariants` (or mock it via vitest).
  - Replace `seqRng([0.01, 0.5])` approach: either (a) mock `pickVariant` to return `'warded'`, or (b) directly set `enemy.variant = 'warded'` and call `VARIANT_DEFS.warded.apply(enemy)` to test the apply hook.
  - For the "test variant selected" case, similarly avoid `seqRng([0.01, 0])` — directly set `enemy.variant = 'test'` and verify no shield fields are added.
  - Keep the `damageEnemy` shield-drain tests unchanged (they already don't depend on variant selection).

## Verification: code
