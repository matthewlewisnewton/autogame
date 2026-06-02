# Passage Floor Sampling

Extend `sampleFloorY()` so players (and enemies) walking on ramp **passages** get correct walkable Y, enabling real ascent during play (ticket 117 movement depends on this).

## Acceptance Criteria

- `sampleFloorY(layout, x, z)` returns bilinear-interpolated Y when `(x, z)` lies inside a passage corridor AABB **and** that passage has `floorCorners` (room lookup takes priority if overlapping).
- Y is continuous at room↔ramp boundaries for layouts produced by `buildRampPassage` / spire generator (test with a synthetic two-tier + ramp layout): sample points just inside the room and just inside the ramp differ by ≤ 0.05.
- Positions outside all rooms and passages still return `null`.
- Passages without `floorCorners` behave as today (no change to flat layouts).
- Unit tests in `game/server/test/dungeon.test.js` and/or `game/client/test/shared-floor-sampling.test.js` cover ramp interpolation, boundary continuity, and priority when a point could match both room and passage.
- `applyPlayerMovement` path (or dedicated movement test) sets `player.y` from `sampleFloorY` while moving along a ramp passage in a spire-ascent layout fixture.

## Technical Specs

- **Files:** `game/shared/floorSampling.esm.js` (canonical logic), `game/shared/floorSampling.js` (CJS bridge — no duplicated logic), `game/server/test/dungeon.test.js`, optionally `game/server/test/applyPlayerMovement.test.js`.
- **Passage hit test:** reuse the same corridor AABB math as `computeWalkableAABBs` in `game/server/simulation.js` (center line `x1,z1`→`x2,z2`, half-width `passageWidth/2`), but use `corridorLength` and room half-extents when present (mirror `buildPassageFloorSpec` bounds).
- **Interpolation:** map local `(u, v)` along the passage slab long axis and width axis; apply bilinear blend of `passage.floorCorners` identical to room sampling.
- **Export:** no API change — same `sampleFloorY(layout, x, z)` signature.

## Verification: code
