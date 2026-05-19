# Gate enemyHit sound on non-empty hits array

Moving `playSound('enemyHit')` outside the hit loop (sub-ticket 02) introduced a regression: a `cardUsed` event with an empty `hits` array (e.g., a weapon swing or summon that hits nothing) now plays an enemy-hit confirmation sound. The server emits `hits: []` for misses, so the sound should be silent.

Gate the `enemyHit` cue on `data.hits.length > 0` so only actual hits produce audio.

## Acceptance Criteria
- A `cardUsed` event with `hits: []` (empty array) plays **no** `enemyHit` sound.
- A `cardUsed` event with one or more hits still plays exactly one `enemyHit` sound.
- Add a unit test that verifies an empty-`hits` `cardUsed` does not call `playSound('enemyHit')`.
- `npm test` passes with 0 failures.

## Technical Specs
- **File**: `game/client/main.js` — line ~1114, change `if (data.hits && Array.isArray(data.hits))` to `if (data.hits && data.hits.length > 0)` (or equivalent guard before `playSound('enemyHit')`).
- **File**: `game/client/test/main.test.js` — add a test case for `cardUsed` with `hits: []` that asserts `playSound` is never called with `'enemyHit'`.

## Verification: code
