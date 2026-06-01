## Unify null/NaN floor-Y fallback between client and server
The server guards `sampleFloorY` results with `Number.isFinite(floorY) ? floorY : DEFAULT_FLOOR_Y`, while the client local avatar uses `sampleFloorY(...) ?? DEFAULT_FLOOR_Y`. `sampleFloorY` returns `null` (never `NaN`) today, so both are equivalent — but the two idioms diverge if a layout ever supplies a `NaN` floor corner (`??` would propagate `NaN`, the server guard would not). Aligning on one helper avoids a subtle future drift.

### Acceptance Criteria
- Client and server use the same fallback expression (or a shared helper) for converting a `sampleFloorY` result to a concrete Y, treating both `null` and non-finite values as `DEFAULT_FLOOR_Y`.
