# Server: Open Plaza stage layout generation

Add an `open-plaza` stage variant to `generateLayout()` that produces a single
large walkable arena (≥ 4× a default room) bounded by outer walls, with ≥ 6
scattered cover pieces and ≥ 2 gently sloped platforms. Wire it to a quest,
keep spawning/objective code working, and make players collide with cover.

## Acceptance Criteria

- `generateLayout(seed, 'open-plaza')` returns a layout whose `profile` field is
  `'open-plaza'`. (Stage selection reuses the existing string-profile hook —
  this is the project's equivalent of `{ stage: "open-plaza" }`.)
- The layout's `rooms` array contains exactly ONE room (the plaza), with role
  `'start'`, flat `floorCorners`, and four solid perimeter walls (no passage
  gaps) so players cannot exit. `passages` is an empty array.
- The plaza's walkable area is ≥ 4× a default room's area (a default room is
  ~13.5 × 13.5 ≈ 182 units²); e.g. a 32 × 32 plaza ≈ 1024 units².
- The layout has a new `cover` array with ≥ 6 entries, each
  `{ x, z, width, depth, height, type }` where `type` is `'pillar'` (tall, small
  footprint) or `'broken_wall'` (low, longer footprint). Cover pieces:
  - do not overlap each other, the perimeter walls, or the spawn-clear zone
    around plaza center,
  - lie fully inside the plaza interior,
  - never form a barrier that fully separates two interior regions (every
    interior floor cell remains reachable from plaza center — verified by a
    flood-fill / grid reachability test).
- The layout has a new `platforms` array with ≥ 2 entries, each
  `{ x, z, width, depth, floorCorners }`, where each platform's four
  `floorCorners` heights differ by at most ~0.5 units (gentle rise). At least 2
  cover pieces sit on (are positioned over) a platform.
- `sampleFloorY(layout, x, z)` returns the raised platform height for points on
  a platform and `DEFAULT_FLOOR_Y` elsewhere on the plaza.
- Deterministic: calling `generateLayout(seed, 'open-plaza')` twice with the
  same seed yields deep-equal layouts (rooms, cover, platforms).
- A quest is wired to the plaza so it loads in-game: add a quest def with
  `layoutProfile: 'open-plaza'` (e.g. `arena_trials`) in `game/server/quests.js`
  and have `getLayoutProfileForQuest` resolve it.
- Spawn placement (`firstRoomPosition`) returns a point on the open plaza floor,
  clear of any cover piece and any platform edge.
- Existing enemy-spawn / objective-placement code works unchanged: with a single
  plaza room, `roomsByRole('combat')`/`'treasure'` fall back to the plaza so
  enemies and objectives place across the open floor (document this fallback in
  a code comment).
- Server wall colliders include every cover piece, so a player cannot walk
  through a pillar or broken wall.
- Unit tests cover: (1) `open-plaza` produces the right shape (one room, empty
  passages, ≥ 6 cover, ≥ 2 platforms, area ≥ 4×); (2) every platform's corner
  delta ≤ 0.5; (3) no cover piece is unreachable (flood-fill reachability);
  (4) determinism for a fixed seed.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'open-plaza'` to `LAYOUT_PROFILES` (or branch on it) and, in
    `generateLayout()`, detect the open-plaza profile and build the arena via a
    dedicated helper (e.g. `generateOpenPlaza(seed, opts)`) instead of the
    grid/room/passage path. Return `{ rooms: [plaza], passages: [], cover,
    platforms, passageWidth, cellSpacing, profile: 'open-plaza' }`.
  - Plaza room: `{ x: 0, z: 0, width: ~32, depth: ~32, walls: [4 full
    perimeter walls], floorCorners: { all = DEFAULT_FLOOR_Y }, role,
    spawnWeight, encounterTier }`. Reuse the existing wall shape
    `{ x, z, length, axis }`.
  - Cover placement: use `mulberry32(seed)` so it is deterministic; reject
    candidates that overlap existing cover/walls or the central spawn-clear
    zone; run a grid flood-fill from center to confirm every interior cell stays
    reachable before accepting the cover set.
  - Platforms: pick ≥ 2 deterministic positions, give each `floorCorners` with a
    ≤ 0.5 corner delta, and place a cover piece on each.
  - Keep `assignRoomRoles()` working for a single-room layout (it already marks
    index 0 as `'start'`).
- `game/shared/floorSampling.esm.js` (+ the `floorSampling.js` CJS bridge):
  extend `sampleFloorY(layout, x, z)` to check `layout.platforms` first and
  interpolate the platform's `floorCorners` when (x,z) is inside a platform,
  else fall back to existing room behavior. Keep current behavior unchanged when
  `platforms` is absent.
- `game/server/simulation.js`: in `buildWallColliders()`, after rooms/passages,
  iterate `layout.cover` and push an AABB per cover piece
  (`minX = x - width/2`, etc.). `computeWalkableAABBs` / `computeDungeonBounds`
  already cover the single plaza room — confirm bounds enclose the plaza.
- `game/server/quests.js`: add the plaza quest def + ensure
  `getLayoutProfileForQuest` returns `'open-plaza'` for it.
- Tests: `game/server/test/dungeon.test.js` (add an `open-plaza` describe block)
  and `game/client/test/shared-floor-sampling.test.js` for the platform sampling
  path.

## Verification: code
