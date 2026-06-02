# Server: Sunken Canyon floor cover scatter

Scatter pillars and broken walls across the canyon floor so the lower band has
cover and reads as a canyon rather than an empty box. Reuse the open-plaza cover
placement patterns (deterministic RNG, overlap rejection, flood-fill reachability).

## Acceptance Criteria

- `generateLayout(seed, 'sunken-canyon')` includes a `cover` array with ≥ 6 pieces
  (`type: 'pillar' | 'broken_wall'`), all positioned inside the canyon room's
  interior (not on the plateau or ramp bands).
- Cover pieces do not overlap each other, canyon perimeter walls, or a spawn-clear
  zone around the canyon center (reuse open-plaza margin/spawn-clear constants or
  canyon-specific equivalents documented in code).
- Flood-fill reachability from canyon center confirms every interior floor cell
  remains reachable (no cover layout fully partitions the canyon).
- `buildWallColliders()` / server simulation already iterate `layout.cover` — confirm
  sunken-canyon colliders block movement through cover (no new server collision code
  unless cover was previously skipped for multi-room layouts).
- Client cover rendering from ticket 135 applies unchanged: deploying the
  `sunken_canyon` quest shows pillar/broken-wall meshes on the canyon floor.
- Deterministic cover for a fixed seed (deep-equal `cover` arrays on repeat calls).
- Unit tests: cover count ≥ 6, all pieces inside canyon AABB, reachability pass,
  determinism for one seed.

## Technical Specs

- `game/server/dungeon.js` — in `generateSunkenCanyon(seed)` (after plateau/ramps/canyon
  rooms exist):
  - Lift or factor shared helpers from `generateOpenPlaza` (`footprintsOverlap`,
    `overlapsSpawnClear`, `plazaFullyReachable` or a generalized
    `interiorFullyReachable(cover, bounds, spawnClear)`).
  - Place cover only within the canyon room's half-width/half-depth minus margin.
  - Fisher–Yates shuffle of a seed-driven candidate pool; reject overlaps and
    unreachable layouts.
- `game/server/test/dungeon.test.js`: extend the sunken-canyon describe block with
  cover placement assertions.
- Do **not** change client files in this sub-ticket unless a guard bug prevents
  `layout.cover` from rendering on multi-room layouts (fix only if observed).

## Verification: code
