# 04 — Sunken-canyon walkability regression tests

Lock the playtest fixes behind automated checks so overlapping ramp walls, narrow descent span, and edge pinches cannot regress. Extend server tests beyond coarse “all rooms reachable” to catch the specific wedge and bidirectional paths described in the parent ticket.

## Acceptance Criteria

- New or extended vitest coverage under `game/server/test/` (prefer `dungeon.test.js` sunken-canyon describe or dedicated `sunken_canyon_walkability.test.js`) includes:
  - **Min wall gap:** for all seeds `1..30` with three ramps, no pair of ramp `axis:'z'` walls closer than `2 * PLAYER_RADIUS`.
  - **Wedge corridor:** for seeds `42` and `999` with three ramps, east-west grid walk along `z ≈ rampZ` from `x = -3` to `x = 3` succeeds under player-radius collision.
  - **Flood-fill:** `countReachableRooms === layout.rooms.length` for seeds `[1, 42, 123, 777, 9999]`.
  - **Bidirectional walk:** `canReachPoint` plateau centre ↔ canyon centre and plateau centre ↔ lateral edge probes `(±(canyon.width/2 - 2), canyon.z - canyon.depth/2 + 2)` for seeds `[1, 42, 123, 777]`.
- `pnpm test:quick` (or `pnpm test` from `game/`) passes with zero sunken-canyon failures.
- Tests fail on the pre-fix layout at `x ≈ ±2` wedge and edge pin (sanity: run once against parent commit if needed during implementation).

## Technical Specs

- **`game/server/test/dungeon.test.js`** — reuse existing helpers: `isWalkable`, `countReachableRooms`, inline `canReachPoint`, `PLAYER_RADIUS`, `WALK_STEP`, `roomsByBand`, `buildWallColliders`, `computeWalkableAABBs`.
- **Optional:** `game/server/test/sunken_canyon_walkability.test.js` if the describe block grows too large; import shared helpers from `dungeon.test.js` or duplicate minimal walk utilities (match `spire_ascent_spawn.test.js` pattern).
- **No production code changes** unless tests reveal a missed gap; if so, minimal `game/server/dungeon.js` tweak only.
- Import `PLAYER_RADIUS` from `game/server/simulation.js` for gap assertions to match runtime collision.

## Verification: code
