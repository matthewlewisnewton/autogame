# Ramp generator helper

Add a reusable server helper that builds a sloped ramp room (or passage slab) between two floor bands, emitting `floorCorners` and side walls so ascent (136) and descent (137) stages share one code path.

## Acceptance Criteria

- New exported helper (e.g. `createRampRoom`) takes high-band and low-band anchor geometry plus width/length and returns a room-shaped object with `floorCorners`, `walls`, `x`, `z`, `width`, and `depth`.
- For a descending ramp, the high edge corners match the upper band Y and the low edge corners match the lower band Y; average slope (rise/run along the ramp axis) is ≥ 0.15 when the caller requests a minimum drop.
- Ramp output is deterministic for the same inputs (no hidden `Math.random` inside the helper).
- Unit tests cover: corner Y alignment to endpoints, slope formula, and a descending ramp with ≥ 0.15 average slope.

## Technical Specs

- **`game/server/dungeonRamps.js`** (new): implement `createRampRoom({ x, z, width, depth, axis, yHigh, yLow, passageGap })` and export slope utilities (`averageRampSlope`, `validateRampSlope`).
- **`game/server/dungeon.js`**: re-export the helper from `module.exports` (or import it where the sunken-canyon generator will live in sub-ticket 02).
- **`game/server/test/dungeonRamps.test.js`** (new): tests for slope bounds and corner alignment; no full canyon layout yet.

## Verification: code
