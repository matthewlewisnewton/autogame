## 03-fix-enemy-variants-test-index

`enemy_variants.test.js` has a test ("leaves enemy stats unchanged when the no-op test variant is selected") that uses `seqRng([0.01, 0])` to pick the variant at index 0, which happens to be 'test'. If any variant is inserted before 'test' in the `VARIANT_DEFS` object, the test picks the wrong variant and either fails or gives a false positive. Fix the test to not depend on object-key ordering.

## Acceptance Criteria

- `enemy_variants.test.js` no longer uses `seqRng([0.01, 0])` to select the 'test' variant by array index 0.
- The "no-op test variant" test explicitly targets the 'test' variant by id (via `pickVariant` stubbing or direct construction) and asserts that `enemy.variant === 'test'` and stats are unchanged.
- The "tags an enemy with a registry variant id" test already asserts membership (`Object.keys(VARIANT_DEFS).toContain(enemy.variant)`) — verify it remains robust.
- All tests in `enemy_variants.test.js` still pass.

## Technical Specs

- **File to change:** `game/server/test/enemy_variants.test.js`
  - Import `pickVariant` from `../enemyVariants`.
  - In the "leaves enemy stats unchanged when the no-op test variant is selected" test (line ~115-127), replace `seqRng([0.01, 0])` with a `pickVariant` stub that returns `'test'`, or directly set `enemy.variant = 'test'` and verify `VARIANT_DEFS.test.apply` being null leaves stats unchanged.
  - Keep the mulberry32 determinism test and the membership-based "tags an enemy" test as-is (they are already robust).

## Verification: code
