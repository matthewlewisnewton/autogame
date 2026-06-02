# Spire Ascent — layout generator

Add `generateSpireAscent(seed)` and wire it into `generateLayout(seed, 'spire-ascent')` so the server can build a deterministic vertical tower of 3–5 flat tier rooms connected by sloped ramp rooms with perimeter walls and explicit start/treasure/combat roles.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent')` returns `layout.profile === 'spire-ascent'` with `passages: []` and only tier + ramp rooms (no default grid generator).
- For any seed, tier count is between 3 and 5 inclusive; each tier room has `band: 'tier'` and flat `floorCorners` (all four corners equal).
- Tier centre floor Y is strictly increasing from bottom (`tierIndex` 0 / `role: 'start'`) to top (`role: 'treasure'`).
- Between each consecutive tier pair there is exactly one ramp room built via `buildDescentRampRoom` with `band: 'ramp'`, `role: 'connector'`, `spawnWeight: 0`; each ramp has non-uniform corners and average slope (rise/run) ≥ 0.2.
- `sampleFloorY(layout, startRoom.x, startRoom.z)` to `sampleFloorY(layout, treasureRoom.x, treasureRoom.z)` difference is ≥ 10 units.
- Every tier has solid perimeter walls on outer edges; ramp rooms have side walls from `buildDescentRampRoom`; tier–ramp junctions use `buildHorizontalWallWithGaps` (or equivalent) so players cannot walk off the spire.
- Foot reachability: from start-tier centre to treasure-tier centre via walkable AABBs and wall colliders (reuse sunken-canyon-style flood tests); all tier rooms are reachable; no orphan tier.
- Same seed produces deep-equal layouts (deterministic).
- New `describe("generateLayout(seed, 'spire-ascent')")` block in `game/server/test/dungeon.test.js` covers the bullets above.

## Technical Specs

- **`game/server/dungeon.js`**
  - Add `SPIRE_ASCENT` constants (tier size ~12–15, ramp width/depth, `yGainTotal: 10`, tier count RNG 3–5).
  - Add `'spire-ascent'` to `LAYOUT_PROFILES` and early-return branch in `generateLayout` (mirror `sunken-canyon`).
  - Implement `generateSpireAscent(seed)`: stack tiers along −Z (bottom spawn south, apex north) with increasing flat Y per tier; place one `buildDescentRampRoom` per step (`yLow` = lower tier Y, `yHigh` = upper tier Y, `axis: 'z'`); assign `tierIndex`, `band: 'tier'`, bottom `role: 'start'`, top `role: 'treasure'`, middle tiers `role: 'combat'` with `spawnWeight: 1` and graded `encounterTier`.
  - Export `generateSpireAscent` if tests import it directly.
- **`game/server/test/dungeon.test.js`**
  - Helpers: `roomsByBand`, `tierFloorY`, `rampAverageSlope`, reachability via `computeWalkableAABBs` / `buildWallColliders` / `countReachableRooms` (copy patterns from sunken-canyon tests).

## Verification: code
