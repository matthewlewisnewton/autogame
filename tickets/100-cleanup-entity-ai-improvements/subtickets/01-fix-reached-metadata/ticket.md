# Fix reached metadata in moveEntityToward()

`moveEntityToward()` only reports `reached: true` when the entity is *already* at the target on entry. If a move lands the entity exactly on (or within `stopDistance` of) the target, the movement succeeds but `reached` stays `false`. Tighten the check so `reached` reflects the post-move distance.

## Acceptance Criteria
- After a successful direct move, `reached` is `true` when the entity's new position is within `stopDistance` of the target.
- After a successful axis-separated (wall-slide) move, `reached` is `true` when the entity's new position is within `stopDistance` of the target.
- `reached: true` when already within `stopDistance` on entry (existing behavior preserved).
- `reached: false` when the entity moves but remains farther than `stopDistance` (existing behavior preserved).
- All existing `moveEntityToward` unit tests continue to pass.
- No visible change to enemy or minion movement behavior (only metadata corrected).

## Technical Specs
- **File**: `game/server/index.js` — `moveEntityToward()` (around line 291)
- After each successful movement (direct, X-only slide, Z-only slide), compute the post-move distance to the target and set `reached: dist <= stopDistance` in the returned metadata object.
- **File**: `game/server/test/server.test.js` — add or update tests in the `moveEntityToward` describe block to cover the case where a move lands within `stopDistance` and verify `reached: true`.

## Verification: code
