## Unused `pickVariant` import in enemy_variants.test.js

`enemy_variants.test.js` imports `pickVariant` but never calls it; tests stub selection via direct `enemy.variant` assignment instead. Remove the unused import or add a focused unit test for `pickVariant` membership/edge cases.

### Acceptance Criteria
- `game/server/test/enemy_variants.test.js` has no unused imports (lint-clean).
- If kept, at least one test calls `pickVariant` with a stub `rng` and asserts returned id ∈ `ids`.

## Pre-existing `pnpm test` coverage gate failure

`pnpm test` exits non-zero because global v8 thresholds require 70% lines/functions/statements but the suite reports ~62%. All 1754 tests pass; failure is threshold-only. Consider `test:quick` for debrittling tickets or restoring coverage on included files.

### Acceptance Criteria
- `cd game && pnpm test` exits 0, **or** project docs/scripts document that `test:quick` is the authoritative green check when thresholds are temporarily unmet.

## Unused export surface for `pickVariant` in tests

Production correctly exports `pickVariant` for test seams, but no test currently exercises the function in isolation. A tiny `describe('pickVariant')` with deterministic `rng` stubs would document the seam for future variant additions.

### Acceptance Criteria
- `game/server/test/enemy_variants.test.js` (or a sibling file) includes tests that `pickVariant(() => 0, ['a','b']) === 'a'` and `pickVariant(() => 0.99, ['a','b']) === 'b'` without referencing registry key order.
