# Phase Step: reject swap endpoints that overlap a wall collider

The `phase_step` endpoint guard only checks `isInsideDungeon`, which validates the
walkable room/passage AABBs but NOT wall colliders. A position can sit inside a
room AABB while still overlapping a real wall, so phase_step currently lets a
player swap *into a wall*. Extend the endpoint validation so either endpoint that
overlaps a wall collider (via `isEntityPositionBlocked(x, z, PLAYER_RADIUS)`)
soft-fails with `invalid_position`, leaves both positions unchanged, and does NOT
burn the cooldown — and add a dedicated test for this wall-overlap branch.

## Acceptance Criteria

- In `useKeyItem` for `phase_step`, before swapping, the swap is rejected when
  EITHER the caster's `(x, z)` OR the ally's `(x, z)` overlaps a wall collider,
  using `isEntityPositionBlocked(x, z, PLAYER_RADIUS)`.
- This wall check is combined with the existing `isInsideDungeon` check so the
  branch emits `keyItemUsed { ok: false, reason: 'invalid_position' }` for either
  failure mode (off-map OR wall-overlap).
- On this wall-overlap soft-fail: neither player's `x`/`y`/`z` changes (no swap),
  and the caster's cooldown is NOT burned (`keyItemCooldownUntil` stays falsy/0).
- Guard ordering is preserved: `no_ally` → `out_of_range` → `invalid_position`.
  The wall check must run only after the range check passes (so an out-of-range
  ally still reports `out_of_range`).
- A new test case in `game/server/test/phase_step.test.js` drives the wall-overlap
  branch: it places the caster at a valid in-room spot and a living, in-range ally
  (within 6m, so `out_of_range` does not trip) at a coordinate that is inside the
  dungeon (`isInsideDungeon` true) but overlaps a wall collider
  (`isEntityPositionBlocked(x, z, PLAYER_RADIUS)` true), then invokes
  `useKeyItem('phase_step')`.
- The test asserts the result is `{ ok: false, reason: 'invalid_position' }`,
  asserts neither player's `x`/`z` changed, and asserts the caster's cooldown was
  not burned.
- The existing happy-path swap test still passes unchanged (a normal in-room swap
  where neither endpoint overlaps a wall must still succeed), and the full server
  suite passes (`pnpm test` from `game/`).

## Technical Specs

- `game/server/index.js` (~line 2825, inside the `phase_step` branch of
  `useKeyItem`): extend the existing endpoint guard
  ```js
  if (!isInsideDungeon(player.x, player.z) || !isInsideDungeon(ally.x, ally.z)) {
  ```
  to also reject wall-overlapping endpoints, e.g.
  ```js
  if (
    !isInsideDungeon(player.x, player.z) || !isInsideDungeon(ally.x, ally.z) ||
    isEntityPositionBlocked(player.x, player.z, PLAYER_RADIUS) ||
    isEntityPositionBlocked(ally.x, ally.z, PLAYER_RADIUS)
  ) {
    socket.emit('keyItemUsed', { ok: false, reason: 'invalid_position' });
    return; // No cooldown burn on soft-fail
  }
  ```
  Both `isEntityPositionBlocked` and `PLAYER_RADIUS` are already imported in
  `index.js` (see lines 131 and 134). Do not change guard ordering — keep this
  block after the `out_of_range` (`dist > range`) check.
- `game/server/test/phase_step.test.js`: add the new test alongside the existing
  `off-map endpoints fail with invalid_position` test (around lines 153–180),
  mirroring its structure (`connectTwoAndStartRun`, `playerForSocket`, set
  positions directly, `waitForEvent` on `keyItemUsed`).
  - Import `getWallColliders`, `isEntityPositionBlocked`, `isInsideDungeon`, and
    `PLAYER_RADIUS` from `../index.js` (all are re-exported there).
  - Find a wall-overlap-but-in-dungeon coordinate robustly against the procedural
    layout: iterate `getWallColliders()`, and for each collider probe points near
    its center / interior face (e.g. the collider center and small offsets toward
    the room interior) until you find `(x, z)` where
    `isInsideDungeon(x, z) === true` AND
    `isEntityPositionBlocked(x, z, PLAYER_RADIUS) === true`. Assert this
    precondition in the test so a layout with no such point fails loudly rather
    than silently passing.
  - Place the caster at its existing valid spawn (or any point where
    `isInsideDungeon` is true and not blocked), place the ally at the found
    wall-overlap point but within 6m of the caster (move the caster near the wall
    point if needed to stay in range while keeping the caster itself unblocked),
    capture both players' pre-call `x`/`z`, set `keyItemCooldownUntil = 0`, then
    emit `useKeyItem({ keyItemId: 'phase_step' })`.
  - Assert `result.ok === false`, `result.reason === 'invalid_position'`, both
    players' `x`/`z` unchanged (`toBeCloseTo`, 5 digits), and
    `playerForSocket(...).keyItemCooldownUntil || 0 === 0`.
- Do NOT modify `simulation.js` or `progression.js`. `isEntityPositionBlocked`
  (`simulation.js:408`) already expands each wall collider by the radius, so a
  point within `PLAYER_RADIUS` of a wall returns `true`.

## Verification: code
