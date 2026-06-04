## 04-fix-card-defs-length-assertions

Four test files assert `Object.keys(CARD_DEFS).toHaveLength(42)` — adding any new card fails these tests for no behavioral reason. Replace exact-length assertions with `>= 42` (with a comment explaining the baseline) or remove them entirely. This eliminates the merge-conflict churn every time a new card is added.

## Acceptance Criteria

- `game/server/test/new_card_pack.test.js:72` — replace `expect(Object.keys(CARD_DEFS)).toHaveLength(42)` with `expect(Object.keys(CARD_DEFS).length).toBeGreaterThanOrEqual(42)` and a comment `// baseline: 42 cards as of initial pack`.
- `game/server/test/card_acquisition.test.js:76-77` — replace both `toHaveLength(42)` assertions with `toBeGreaterThanOrEqual(42)` (same comment). Keep the keys-match assertion (`CARD_DEFS keys === cardDefsJson keys`) as-is since that's a sync check, not a count check.
- `game/client/test/cards.test.js:17` — replace `expect(Object.keys(CARD_DEFS)).toHaveLength(42)` with `toBeGreaterThanOrEqual(42)`.
- All affected tests still pass.
- Adding a new card to `CARD_DEFS` does not cause any of these four test files to fail.

## Technical Specs

- **Files to change:**
  - `game/server/test/new_card_pack.test.js` — line 72
  - `game/server/test/card_acquisition.test.js` — lines 76-77
  - `game/client/test/cards.test.js` — line 17
- Change `toHaveLength(42)` → `.length).toBeGreaterThanOrEqual(42)` with comment `// baseline: 42 cards as of initial pack`.
- In `card_acquisition.test.js`, the `expect(Object.keys(CARD_DEFS).sort()).toEqual(Object.keys(cardDefsJson).sort())` line should remain unchanged (it verifies server/client sync, not a fixed count).

## Verification: code
