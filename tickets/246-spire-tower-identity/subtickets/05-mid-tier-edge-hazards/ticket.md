# Mid-tier edge hazards (spire-ascent tension)

Add optional exterior edge hazards on middle combat tiers so zig-zag landings feel
precarious: visible warning strips plus server-side fall-off if the player steps
over the void beside a tier.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent')` emits `layout.edgeHazards` (array) for
  **middle combat tiers only** (`role: 'combat'`): each entry describes a thin
  hazard strip along the tier's exterior drop side (the lateral edge exposed by
  zig-zag offset, not ramp openings or the start/treasure tiers).
- `buildDungeon` renders each hazard as a low emissive mesh on the tier lip (e.g.
  cyan/magenta warning color); hazards are tracked in the dungeon mesh list.
- Server movement (`applyPlayerMovement` in `game/server/simulation.js`) detects
  when a player's `(x, z)` lies inside a hazard AABB and applies tension: snap back
  to a safe point on the same tier **or** small HP chip (reuse existing damage
  helpers). Hazards are ignored on ramps, start, and treasure tiers.
- Existing reachability and spawn tests remain green; hazard strips must not block
  the main walkable route between tiers.
- Server and client tests cover hazard presence on mid tiers, mesh count, and
  fall-off behaviour (position correction or damage event).

## Technical Specs

- **`game/server/dungeon.js`**
  - In `generateSpireAscent`, after tier placement (depends on zig-zag from
    sub-ticket 01), push `edgeHazards` entries with `{ tierIndex, minX, maxX,
    minZ, maxZ, y }` AABBs on the outward-facing long edge of each combat tier.
- **`game/server/simulation.js`**
  - In `applyPlayerMovement`, if `layout.profile === 'spire-ascent'` and position
    intersects a hazard AABB, nudge player back toward tier centre or apply
    configured chip damage (`SPIRE_EDGE_HAZARD_DAMAGE` constant).
- **`game/client/dungeon.js`**
  - Loop `layout.edgeHazards || []` and add warning strip meshes (reuse wall-height
    scale, emissive material).
  - Optionally add hazard AABBs to client prediction colliders (visual only is OK
    if server is authoritative).
- **Tests**
  - `game/server/test/dungeon.test.js`: mid-tier layouts include ≥1 hazard; start/
    treasure tiers have none.
  - `game/server/test/simulation.test.js` or `dungeon.test.js`: stepping into hazard
    AABB triggers reposition or damage.
  - `game/client/test/dungeon.test.js`: hazard meshes emitted for spire fixture.

## Verification: code
