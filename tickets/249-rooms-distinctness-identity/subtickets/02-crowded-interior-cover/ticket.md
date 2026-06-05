# Crowded profile interior cover and structure

Differentiate the default `crowded` grid profile structurally by scattering interior obstacles (pillars, broken walls) inside combat rooms, reusing the existing `layout.cover` pipeline already used by open-plaza and sunken-canyon layouts.

## Acceptance Criteria

- `generateLayout(seed, 'crowded')` returns a `cover` array with at least one piece per combat room (excluding the start room), each with `{ x, z, width, depth, height, type }` where `type` is `pillar` or `broken_wall`.
- Cover pieces stay inside their host room footprint with a margin from room walls; they do not overlap each other or block passage doorways.
- Every combat room remains fully reachable from its centre after cover placement (room-local flood-fill or equivalent).
- Server `buildWallColliders` and client `buildWallColliders` already include `layout.cover`; no player/enemy can walk through cover footprints.
- Crowded layouts with `options.slopes: true` still generate valid cover (skip or adapt placement on sloped rooms if needed).
- Vitest in `dungeon.test.js` validates cover count, types, in-room bounds, and collider overlap for a fixed seed.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `scatterCoverInRoom(rng, room, { targetCount, margin })` — greedily place 1–3 candidates inside the room AABB, rejecting overlaps and doorway-blocking positions (derive doorway gap centres from room `walls` segments).
  - Add `decorateCrowdedLayout(layout, rng)` called at the end of the crowded branch in `generateLayout` (before `return`), populating `layout.cover`.
  - Reuse footprint helpers (`footprintsOverlap`, reachability check scoped to room interior).
- `game/server/test/dungeon.test.js`: new `describe('crowded interior cover')` block with deterministic seed assertions.
- No client changes required — `game/client/dungeon.js` already renders `layout.cover` with profile materials from sub-ticket 01.

## Verification: code
