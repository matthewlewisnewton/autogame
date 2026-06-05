# 03 — Canyon edge ascent paths

Players who descend into the canyon near the west or east lateral edges (`|x|` near `canyon.width / 2`) cannot reach a north-wall ramp gap: gaps only align with the narrow central descent, so they pin against the canyon north perimeter and cannot climb back to the plateau.

Add walkable ascent at the canyon perimeter — e.g. widen north-wall gaps, add side connector/return ramp rooms along west/east, or extend ramp rooms to meet the canyon corners — so edge positions can rejoin the plateau descent.

## Acceptance Criteria

- For seeds `[1, 42, 123, 777, 9999]`, grid walk succeeds from each probe point `(±(canyon.width/2 - 2), canyon.z - canyon.depth/2 + 2)` to the plateau room centre `(plateau.x, plateau.z)` using `buildWallColliders` + `computeWalkableAABBs` + `PLAYER_RADIUS` collision (same walk helpers as `dungeon.test.js`).
- The reverse walk succeeds: from plateau centre to each lateral-edge probe point above (plateau → canyon edge and edge → plateau).
- Canyon north, west, and east perimeter walls remain solid except at intentional ramp/gap openings (no new walk-off voids).
- Ramp count stays within 2–3 unless widening gaps requires a fourth connector; if a fourth ramp is added, document in layout only and keep `band: 'ramp'`, `spawnWeight: 0`.

## Technical Specs

- **`game/server/dungeon.js`** — `generateSunkenCanyon` and helpers (`buildHorizontalWallWithGaps`, `buildDescentRampRoom`, possibly new side-ramp builder mirroring spire-ascent tier gaps).
  - Target coordinates: canyon half-width ≈ 16, north edge `z = canyonZ - canyonSize/2`, plateau south `z = plateauSouthZ`.
  - Prefer reusing `buildDescentRampRoom` with `axis: 'x'` for east/west cheek ramps, or widen gap list on canyon/plateau north-south walls to span lateral entry — pick the smallest change that satisfies probes.
- **`game/server/test/dungeon.test.js`** — add or extend sunken-canyon describe block with the lateral probe `canReachPoint` checks if not deferred to sub-ticket 04.

## Verification: code
