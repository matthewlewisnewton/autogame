# Cleanup nits from 117-sloped-movement-server-and-client

> **Staleness note.** This follow-up ticket was written against commit
> `2f78d05` (2026-05-31). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `117-sloped-movement-server-and-client`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Unify null/NaN floor-Y fallback between client and server
The server guards `sampleFloorY` results with `Number.isFinite(floorY) ? floorY : DEFAULT_FLOOR_Y`, while the client local avatar uses `sampleFloorY(...) ?? DEFAULT_FLOOR_Y`. `sampleFloorY` returns `null` (never `NaN`) today, so both are equivalent — but the two idioms diverge if a layout ever supplies a `NaN` floor corner (`??` would propagate `NaN`, the server guard would not). Aligning on one helper avoids a subtle future drift.

### Acceptance Criteria
- Client and server use the same fallback expression (or a shared helper) for converting a `sampleFloorY` result to a concrete Y, treating both `null` and non-finite values as `DEFAULT_FLOOR_Y`.
