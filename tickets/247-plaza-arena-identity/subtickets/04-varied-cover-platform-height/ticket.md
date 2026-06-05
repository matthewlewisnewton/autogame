# Varied cover types and raised platforms

Strengthen combat readability on the open-plaza arena by introducing additional
cover silhouettes and noticeably raised platforms whose height is reflected in
`sampleFloorY` and client mesh placement.

## Acceptance Criteria

- `generateLayout(seed, 'open-plaza')` cover entries use ≥ 3 distinct `type`
  values across the layout (keep existing `pillar` and `broken_wall`, add at
  least one new type such as `barricade` or `crate_stack` with distinct
  width/depth/height).
- At least one cover piece of each type present in the candidate pool appears
  in the scattered cover set for seed `123`.
- Platforms use a minimum corner height of `DEFAULT_FLOOR_Y + 1.0` at their
  highest corner (up from the current ~1.4 cap with flat plaza floor at 0);
  `sampleFloorY` on platform centres returns ≥ `1.0` above `DEFAULT_FLOOR_Y`.
- All existing open-plaza invariants still pass: ≥ 6 cover, ≥ 2 platforms,
  ≥ 2 cover-on-platform, spawn-clear exclusion, reachability flood-fill,
  determinism, and cover footprints in `buildWallColliders`.
- Client `buildDungeon` renders distinct geometry per cover `type` (not one shared
  box for all types) while still resting each piece on `sampleFloorY`.
- Server and client vitest updated for the expanded type whitelist and platform
  height floor.

## Technical Specs

- **`game/server/dungeon.js`**
  - Extend `generateOpenPlaza` `candidatePool` with new cover types (e.g.
    `barricade`: wide low box; `crate_stack`: medium cube stack dimensions).
  - Raise platform `floorCorners` base Y values (e.g. `yNW: 1.2` … `ySE: 1.6`)
    while keeping per-platform corner delta ≤ 0.5.
  - Ensure `scatterCoverInArena` still reaches `targetCount` with mixed types.
- **`game/client/dungeon.js`**
  - In the open-plaza cover loop, branch on `c.type` to pick geometry proportions
    (or a small `buildCoverMesh(c, material)` helper) before positioning.
- **`game/server/test/dungeon.test.js`**
  - Update type whitelist test to include new types; add assertion for ≥ 3 unique
    types and platform `sampleFloorY` ≥ 1.0 on platform centres.
- **`game/client/test/dungeon.test.js`**
  - Extend open-plaza cover tests to verify distinct heights/footprints per type.

## Verification: code
