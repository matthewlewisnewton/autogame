# 02-fix-warded-variant-test

Refactor `warded_variant.test.js` to assert variant membership and shield effect rather than depending on the hard-coded `seqRng([0.01, 0.5])` → index-2-of-5 mapping that breaks when variants are added or reordered.

## Acceptance Criteria

- The test "tags warded and applies shield fields via the registry hook" no longer relies on `seqRng([0.01, 0.5])` to land on a specific array index. Instead it either (a) uses `pickVariant` to explicitly select `'warded'`, or (b) constructs the enemy with `variant: 'warded'` and calls `VARIANT_DEFS.warded.apply(enemy)` directly.
- The test "leaves shieldHp unset when the no-op test variant is selected" similarly avoids index-dependent RNG sequences.
- Adding or removing a variant from `VARIANT_DEFS` does not cause any test in this file to fail.
- All tests in `warded_variant.test.js` pass.

## Technical Specs

- **File**: `game/server/test/warded_variant.test.js`
  - Import `pickVariant` from `../enemyVariants` (added by sub-ticket 01).
  - Replace the `seqRng([0.01, 0.5])` test with one that directly sets `enemy.variant = 'warded'` and invokes `VARIANT_DEFS.warded.apply(enemy)`, or uses a mock RNG that `pickVariant` resolves to `'warded'`.
  - Replace the `seqRng([0.01, 0])` test (expects `'test'` at index 0) with an explicit `enemy.variant = 'test'` + `VARIANT_DEFS.test.apply(enemy)` path, or a mock that resolves to `'test'`.
  - Keep the `damageEnemy` tests unchanged (they do not depend on variant indexing).

## Verification: code
