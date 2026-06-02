# Ramp Passage Helper

Add a shared server helper that builds a sloped ramp **passage** between two room-sized tiers, emitting `floorCorners` aligned to each tier's walkable height and side walls that keep players on the ramp.

## Acceptance Criteria

- New exported helper (e.g. `buildRampPassage(fromRoom, toRoom, options)`) lives in `game/server/dungeon.js` (or a small `game/server/rampPassage.js` re-exported from `dungeon.js`).
- Given two room objects with known `x`, `z`, `width`, `depth`, and target corner Y values, the helper returns a passage object including: `x1`, `z1`, `x2`, `z2`, `corridorLength`, `walls`, and `floorCorners: { yNW, yNE, ySE, ySW }`.
- Low end of the ramp matches the **exit** edge height of `fromRoom`; high end matches the **entry** edge height of `toRoom` (continuous walkable surface at the junction).
- Helper enforces average slope ≥ `options.minSlope` (default `0.2`) by adjusting rise or corridor length; throws or clamps deterministically when inputs cannot satisfy the bound.
- Ramp side walls span the corridor gap only (same pattern as existing passage wall generation in `generateLayout`).
- Unit tests cover: corner continuity at both ends, slope ≥ 0.2 for a canonical pair of rooms, deterministic output for fixed inputs, and wall segments present on both long sides.

## Technical Specs

- **Files:** `game/server/dungeon.js` (primary), `game/server/test/dungeon.test.js` (new `describe('buildRampPassage')` block).
- **Signature sketch:** `buildRampPassage(fromRoom, toRoom, { passageWidth, direction, rise, minSlope })` where `direction` is `'north' | 'south' | 'east' | 'west'` indicating which edge of `fromRoom` the ramp leaves from toward `toRoom`.
- **Slope math:** `avgSlope = rise / run` where `run` is horizontal corridor length between room edges; if `run * minSlope > rise`, extend `corridorLength` or increase `rise` per seed-driven budget passed by caller.
- **Passage shape:** thin sloped slab — reuse the same `floorCorners` schema as rooms (ticket 116). Do **not** implement full spire layout here; only the reusable ramp primitive shared with ticket 137.
- Export the helper from the `module.exports` block alongside `generateLayout`.

## Verification: code
