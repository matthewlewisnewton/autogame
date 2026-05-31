# Layout Schema — Sloped Floor Regions

Extend the server layout schema so rooms can carry per-corner elevation data, and update `generateLayout()` to emit at least one sloped room on a deterministic test seed.

## Acceptance Criteria

- Every room object in `layout.rooms` gains an optional `floorCorners` property: `{ yNW, yNE, ySE, ySW }` (all four corner Y heights in world units).
- Rooms without `floorCorners` default to a flat floor at `y = 0.5` (the current `FLOOR_Y` equivalent) — backward compatible with existing layouts.
- `generateLayout()` accepts an optional `slopes` flag (boolean or layout-profile key); when enabled, at least one room or passage in the layout has non-uniform `floorCorners` (a ramp).
- A specific deterministic seed (e.g. seed `42`) with slopes enabled always produces the same sloped layout (deep equality across runs).
- Layouts generated without the slopes flag are identical to today's output (no regression in room shape, walls, or role metadata).
- Unit tests verify: (a) flat layout has uniform `floorCorners` or absent field, (b) sloped layout has at least one room with differing corner heights, (c) determinism.

## Technical Specs

- **File:** `game/server/dungeon.js`
  - Add `floorCorners: { yNW, yNE, ySE, ySW }` to each room object in Step 5 of `generateLayout()`. Default all four to `0.5` (matching current flat floor height).
  - Add a `slopes` option (boolean, default `false`) to the layout profile or as a second/third arg to `generateLayout()`. When `true`, pick one or more rooms (or passages) and set corner heights to create a ramp — e.g. slope along the Z axis: `yNW = yNE = 0.5`, `ySE = ySW = 2.0` (a ramp rising toward the south edge).
  - Export a constant `DEFAULT_FLOOR_Y = 0.5` for the flat floor height.
  - Export `generateLayout` with the new signature: `generateLayout(seed, profile, options?)` where `options.slopes` enables slope generation.

## Verification: code
