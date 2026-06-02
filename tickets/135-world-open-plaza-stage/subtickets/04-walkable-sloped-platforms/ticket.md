# Make Open-Plaza Sloped Cover Platforms Actually Walkable

Right now each "sloped" cover piece attaches `floorCorners` to the cover's own
footprint — the exact footprint the solid cover collider occupies — so the slope
is sealed under a solid box and no player can ever stand on it. On top of that,
`sampleFloorY()` only samples `layout.rooms[].floorCorners` and never looks at
cover pieces, so even the visual rise is never reflected in a player's Y. Give
each sloped piece a distinct, larger **walkable platform footprint** (an apron
around the solid cover) that carries the `floorCorners`, keep the solid collider
on the cover footprint only, and make `sampleFloorY()` read the platform so a
player standing on the apron rides up the gentle slope.

## Acceptance Criteria

- Each sloped cover piece exposes its slope on a **platform footprint that is
  strictly larger than the solid cover footprint** (an apron extending at least
  ~1.0 unit — i.e. ≥ 2× `PLAYER_RADIUS` — beyond the cover on each side),
  centered on the cover. Represent it as e.g. `piece.platform = { width, depth,
  floorCorners }` (platform `width`/`depth` > the cover's `width`/`depth`).
- The platform's `floorCorners` keeps a gentle corner-height delta of ≈ 0.5
  (must stay ≤ 0.6) units, unchanged from the existing slope bound.
- The solid collider for a sloped piece still covers **only the cover
  footprint** (`coverAABB` / `buildWallColliders` unchanged in size) — the apron
  ring around the cover is NOT blocked, so a player can walk onto it.
- At least one floor point that is **inside the platform footprint but outside
  the solid cover footprint** (the apron) is (a) NOT inside any wall collider and
  (b) returns a `sampleFloorY()` height **greater than `DEFAULT_FLOOR_Y`** —
  proving a player there stands on the raised slope, not the flat floor.
- `sampleFloorY(layout, x, z)` returns the bilinearly-interpolated platform
  height for points over a cover platform (apron); points on the flat plaza away
  from any platform still return `DEFAULT_FLOOR_Y`.
- Platform footprints stay fully inside the outer walls and do not overlap other
  cover pieces or the spawn-clear zone (placement guards account for the larger
  platform footprint, not just the cover footprint).
- The free-floor reachability (BFS) guard still passes — the larger platforms do
  not disconnect the plaza, and the apron counts as free floor.
- Determinism preserved: same seed → identical cover, platforms, and slopes
  (deep-equal).
- ≥ 2 cover pieces still carry a sloped platform (the existing `COVER_SLOPED`
  count).

## Technical Specs

- `game/server/dungeon.js`: in `generatePlazaCover()`, replace the
  `cover[i].floorCorners = {...}` block with a `cover[i].platform = { width,
  depth, floorCorners }` whose `width`/`depth` are the cover footprint inflated
  by a new `PLATFORM_APRON` margin (≥ 1.0). When placing pieces, use the
  *platform* bounds (the larger footprint) for the inside-walls limit, the
  spawn-clear check, and the inter-piece overlap check so the apron never clips a
  wall, the spawn, or another piece. Keep the solid `coverBounds`/footprint for
  the BFS `blocked` set so the apron stays walkable. Keep `COVER_SLOPE_DELTA`
  (≈0.5, ≤0.6) and `COVER_SLOPED` (≥2).
- `game/shared/floorSampling.esm.js`: extend `sampleFloorY()` so that, after the
  room loop, it checks `layout.cover` pieces with a `platform`: if (x,z) is
  inside a platform footprint, bilinearly interpolate that platform's
  `floorCorners` (same corner ordering as rooms) and return it. The plaza room
  itself stays flat, so apron points resolve to the platform height. (Do not
  edit the CJS wrapper `floorSampling.js` — it loads the ESM file.)
- `game/client/dungeon.js`: in `buildDungeon()`, render the sloped patch over the
  **platform footprint** — pass the platform (its `width`/`depth`/`floorCorners`,
  positioned at the piece center) to `buildSlopedFloor()` instead of the cover
  footprint, so the visible slope matches the walkable apron. The solid cover box
  mesh and `coverAABB` collider are unchanged.
- `game/server/test/dungeon.test.js` and `game/client/test/dungeon.test.js`:
  update any assertions that read `piece.floorCorners` to the new
  `piece.platform.floorCorners` shape, and add tests for: platform footprint
  larger than cover footprint, slope delta within bound, platform inside walls /
  clear of spawn & other pieces, determinism.
- `game/server/test/` (dungeon or simulation test): add a test that an apron
  point (inside platform, outside cover) is not inside any wall collider AND
  `sampleFloorY()` there is `> DEFAULT_FLOOR_Y`, i.e. a player can stand on the
  sloped platform.

## Verification: code
