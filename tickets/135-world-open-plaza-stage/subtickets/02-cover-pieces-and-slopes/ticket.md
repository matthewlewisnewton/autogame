# Plaza Cover Pieces + Gentle Sloped Platforms (server)

Scatter freestanding cover (pillars, broken walls, low planters) through the
open-plaza arena, give a couple of them subtly sloped platforms, and make the
server collide players against the cover. Slopes are purely visual for v1 (movement
following them is ticket 117) — this sub-ticket only needs the `floorCorners`
data and collision, not slope-aware movement.

## Acceptance Criteria

- The `open-plaza` layout includes a `cover` array (or equivalent field on the
  plaza room) with **≥ 6** freestanding cover pieces scattered across the plaza
  interior, each fully inside the outer walls (not overlapping the perimeter).
- Each cover piece carries position + footprint + a `type` (e.g. `pillar` =
  tall box, `brokenWall` = low box, `planter` = low box) sufficient to build a
  collision AABB and (later) a mesh.
- Cover pieces do not overlap each other and do not overlap the spawn point.
- **Traversability is preserved**: no two reachable plaza-floor points become
  mutually unreachable because of cover (verify via a grid/BFS reachability check
  over the plaza minus cover footprints — the free floor stays a single connected
  region).
- **≥ 2** cover pieces sit on a **gently sloped platform**: the platform carries a
  `floorCorners` object whose max corner-height delta is ≈ 0.5 (must be ≤ 0.6)
  units.
- The server wall-collider build (`buildWallColliders` in
  `game/server/simulation.js`) includes an AABB for every cover piece, so players
  collide with them.
- Spawn placement keeps players on plaza floor and **not inside any cover piece**
  (spawn point is clear of all cover AABBs).
- Deterministic: same seed → identical cover placement and slopes (deep-equal).
- Unit tests cover: ≥ 6 cover pieces, each slope delta within the documented
  bound, free-floor reachability preserved, spawn clear of cover, and seed
  determinism.

## Technical Specs

- `game/server/dungeon.js`: extend `generateOpenPlaza()` to deterministically
  place ≥ 6 cover pieces using the layout `rng`. Store them as a `cover` array
  (each `{ x, z, width, depth, height, type, floorCorners? }`). For ≥ 2 of them,
  attach a `floorCorners` platform with a ≤ 0.6 corner-height delta. Add a small
  reachability/overlap guard so generation re-rolls or skips a piece that would
  block traversal or land on spawn.
- `game/server/simulation.js`: in `buildWallColliders()`, after the room/passage
  walls, append an AABB for each `layout.cover` piece (using its footprint). If
  spawn/`firstRoomPosition` could land in cover, nudge it clear.
- `game/server/test/dungeon.test.js`: add the unit tests described above.

## Verification: code
