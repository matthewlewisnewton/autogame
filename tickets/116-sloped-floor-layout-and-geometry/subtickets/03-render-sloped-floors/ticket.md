# Render Sloped Floors in Client

Update `buildDungeon()` in the client to render rooms with non-uniform `floorCorners` as visibly inclined ramps.

## Acceptance Criteria

- Rooms with uniform `floorCorners` (all equal, or field absent) render identically to today — flat `BoxGeometry` at `FLOOR_Y`.
- Rooms with non-uniform `floorCorners` render as a sloped floor mesh with corners at approximately the specified Y heights.
- The slope is visually apparent — a ramp rising from one edge to another, no z-fighting.
- Legacy layouts (no `floorCorners`) build and look unchanged.
- No console errors when `buildDungeon()` encounters rooms with or without `floorCorners`.

## Technical Specs

- **File:** `game/client/dungeon.js`
  - In the room-building loop of `buildDungeon()`, check `room.floorCorners`.
  - If absent or all four values equal: use existing flat `BoxGeometry(room.width, 0.1, room.depth)` at `FLOOR_Y`.
  - If corners differ: determine dominant slope axis by comparing edge averages:
    - Z-slope delta: `Math.abs((ySW + ySE) / 2 - (yNW + yNE) / 2)`
    - X-slope delta: `Math.abs((yNE + ySE) / 2 - (yNW + ySW) / 2)`
  - For Z-slope (larger delta along Z): `BoxGeometry(room.width, 0.1, Math.hypot(room.depth, yDelta))`, rotate X by `Math.atan2(yDelta, room.depth)`, position Y at average of min/max corner Y.
  - For X-slope: `BoxGeometry(Math.hypot(room.width, yDelta), 0.1, room.depth)`, rotate Z by `-Math.atan2(yDelta, room.width)`, position Y at average.
  - Use existing role-based floor material (no new material).

**Out of scope:** passage ramp rendering (passages remain flat at `FLOOR_Y`), wall height adjustment for slope.

## Verification: code
