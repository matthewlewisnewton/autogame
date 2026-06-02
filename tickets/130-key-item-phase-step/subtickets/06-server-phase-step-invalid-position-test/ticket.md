# Phase Step: test the invalid-position (wall/out-of-bounds) endpoint guard

Add a dedicated server integration test covering the `phase_step` endpoint-validation branch: when either the caster or the ally is outside the walkable dungeon bounds, the swap must soft-fail with `invalid_position`, leave both positions unchanged, and NOT burn the cooldown. This closes the one acceptance-criterion gap the round-5 review flagged ("No swap through walls (both endpoints valid)" had no dedicated test).

## Acceptance Criteria

- A new test case exists in `game/server/test/phase_step.test.js` that drives the `invalid_position` branch in `useKeyItem` for `phase_step`.
- The test moves the caster and a living, in-range ally (within the 6m range, so the `out_of_range` guard does NOT trip first) to coordinates that lie outside every `walkableAABB` (e.g. a far off-map coordinate such as `x/z = 99999`), then invokes `useKeyItem('phase_step')`.
- The test asserts the result is `{ ok: false, reason: 'invalid_position' }`.
- The test asserts neither player's `x`/`z` changed (no swap occurred).
- The test asserts the caster's cooldown was NOT burned (`keyItemCooldownUntil` remains falsy / `0`).
- The full server test suite still passes (`pnpm test` from `game/`), with no changes to non-test files under `game/`.

## Technical Specs

- File to change: `game/server/test/phase_step.test.js` (test-only addition; do NOT modify `game/server/index.js`, `progression.js`, or `simulation.js`).
- Mirror the existing `out-of-range ally` test structure (around lines 127–151): connect two clients into one run via the existing `connectTwoIntoRun`/ready-up helpers, grab players via `playerForSocket`, and set positions directly.
- Ordering note: in `useKeyItem` (`game/server/index.js:2788+`) the guards run in order `no_ally` → `out_of_range` (dist > range) → `invalid_position` (`!isInsideDungeon`). To reach `invalid_position`, keep the ally within 6m of the caster (e.g. `p2.x = p1.x + 1`) but place BOTH at an off-map coordinate outside all walkable AABBs so `isInsideDungeon` returns `false`.
- `isInsideDungeon` (`game/server/simulation.js:559`) returns `true` only when `x,z` falls inside one of `state.walkableAABBs`; coordinates like `99999` are guaranteed outside.
- Capture both players' pre-call `x`/`z` and assert they are unchanged after the call; assert `keyItemCooldownUntil` is falsy.

## Verification: code
