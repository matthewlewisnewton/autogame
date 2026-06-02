# Canyon floor cover scatter

Scatter freestanding cover (pillars, broken walls) across the sunken-canyon lower band so combat has sightlines and kiting space without blocking ramp access.

## Acceptance Criteria

- Sunken-canyon layouts include ≥ 6 cover pieces on the canyon floor only (not on ramps or the plateau spawn pad).
- Each cover piece is a wall/collider entry compatible with existing client dungeon mesh builders (box walls with `axis` + `length`); none overlap ramp door gaps or block all paths from plateau spawn to canyon center.
- Cover placement is seed-deterministic.
- `computeWalkableAABBs` + BFS (or existing reachability helper from sub-ticket 02 tests) confirms plateau → canyon center remains reachable after scatter.
- Unit tests assert cover count, band placement, determinism, and reachability.

## Technical Specs

- **`game/server/dungeon.js`**: in `generateSunkenCanyonLayout`, after base geometry, call `scatterCanyonCover(rng, canyonRoom, { count: 6, minSpacing })` — lift from open-plaza (135) if that helper exists in-tree, otherwise implement a small self-contained scatter in the same file.
- **`game/server/test/dungeon.test.js`**: extend sunken-canyon tests to count cover walls tagged `cover: true` (or `role: "cover"`) and verify reachability post-scatter.
- **`game/client/dungeon.js`**: only change if cover walls need a new mesh primitive; prefer reusing existing pillar/low-wall boxes.

## Verification: code
