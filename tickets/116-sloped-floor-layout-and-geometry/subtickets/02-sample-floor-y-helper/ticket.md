# sampleFloorY — Shared Floor Height Sampler

Add a `sampleFloorY(layout, x, z)` helper that returns the walkable surface Y height at any world `(x, z)` coordinate, interpolating across room corner heights.

## Acceptance Criteria

- A function `sampleFloorY(layout, x, z)` is exported from `game/server/dungeon.js`.
- For a flat room (all `floorCorners` equal to `DEFAULT_FLOOR_Y`), returns `DEFAULT_FLOOR_Y` for any `(x, z)` inside the room bounds.
- For a sloped room, returns bilinearly interpolated Y values between the four `floorCorners` based on `(x, z)` within the room.
- For positions outside any room or passage, returns `null`.
- Unit tests in `game/server/test/dungeon.test.js` cover: (a) flat room returns constant `DEFAULT_FLOOR_Y`, (b) sloped room returns correct interpolated values at corners and center, (c) out-of-bounds returns `null`.

## Technical Specs

- **File:** `game/server/dungeon.js` — add `sampleFloorY(layout, x, z)` function and add it to `module.exports`.
  - Iterate `layout.rooms` to find the containing room (`x` within `room.x ± width/2`, `z` within `room.z ± depth/2`).
  - Compute normalized local coords: `u = (x - (room.x - halfW)) / width`, `v = (z - (room.z - halfD)) / depth`.
  - Bilinear interpolation: `y = (1-u)*(1-v)*yNW + u*(1-v)*yNE + u*v*ySE + (1-u)*v*ySW`.
  - Corner ordering: NW = (−width/2, −depth/2), NE = (+width/2, −depth/2), SE = (+width/2, +depth/2), SW = (−width/2, +depth/2).
  - If room lacks `floorCorners`, treat all four as `DEFAULT_FLOOR_Y`.
  - Return `null` if position is outside all rooms.
- **File:** `game/server/test/dungeon.test.js` — add `describe('sampleFloorY', ...)` block.
  - Generate a flat layout (seed 1, no slopes) and a sloped layout (seed 42, `{ slopes: true }`).
  - Test at room center, at corners, and out-of-bounds.

**Out of scope:** passage interpolation (deferred), client-side import wiring (handled by existing server-import pattern).

## Verification: code
