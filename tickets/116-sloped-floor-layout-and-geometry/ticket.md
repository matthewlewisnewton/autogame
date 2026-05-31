# Sloped Floor Layout and Geometry

Add **vertical variation** to dungeon floors: rooms and passages can include ramps
and sloped walkable surfaces instead of a single flat `y = 0.5` plane everywhere.

## Difficulty: medium

## Goal

Extend the server layout schema and dungeon builders so at least some generated
levels include **sloped walkable floors**, and the client renders those slopes
correctly in Three.js.

## Problem

Today floors are flat boxes at a fixed height (`FLOOR_Y` / `player.y ≈ 0.5`).
There is no layout metadata for elevation change, so “walking up a ramp” is
impossible.

## Acceptance Criteria

- Layout schema documents sloped floor regions (pick a minimal representation,
  e.g. per-room `floorCorners: [yNW, yNE, ySE, ySW]` or `floorPlane: { originY,
  slopeAxis, slopeRadians }` plus flat fallback for legacy rooms).
- `generateLayout()` (or a clearly named test/profile hook) can emit **at least
  one** room or passage with non-zero slope in a deterministic seed used by
  tests.
- Shared helper `sampleFloorY(layout, x, z)` (or equivalent) returns the
  walkable surface height at a world `(x, z)` — lives in code shared by client
  and server (`game/client/collision.js` + server import/re-export pattern used
  elsewhere, or `game/shared/` if you add a small shared module).
- Client `buildDungeon()` renders sloped floors (rotated `BoxGeometry` or
  custom geometry) so ramps are visibly inclined, not z-fighting with flat rooms.
- Flat legacy layouts still build and look unchanged.
- Unit tests cover `sampleFloorY` on a flat room and on at least one sloped
  fixture (corner heights or plane math).
- `game/docs/design.md` or `game/docs/controls.md` gets a short note that floors
  can slope and movement height follows the floor (implementation in ticket 117).

## Implementation Notes

- Start with **room-local** slopes (four corner heights) or a single ramp plane
  per room — avoid a full heightmap mesh in this ticket.
- Do **not** change the `move` socket handler or authoritative `player.y` sync
  here; ticket **117** owns movement on slopes.
- Reuse existing `layout.rooms` / `layout.passages` structures; extend rather
  than replacing dungeon generation.
- Key files: `game/server/dungeon.js`, `game/client/dungeon.js`,
  `game/client/collision.js`, `game/server/simulation.js` (if server needs the
  sampler for tests only).

## Verification

- `Verification: code` — vitest for sampler + layout generation.
- Manual: run dev server, use a test seed/profile that includes a ramp, confirm
  visible slope in the dungeon view.

## Dependencies

None (first in the slope chain).
