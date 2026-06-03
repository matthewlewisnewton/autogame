# Shared `resolveFloorY` helper for sampleFloorY results

Add a single canonical function in `game/shared/floorSampling.esm.js` that turns a
`sampleFloorY` return value into a concrete walkable Y, treating `null`, `NaN`,
`±Infinity`, and any other non-finite number as `DEFAULT_FLOOR_Y`. Export it through
the CJS bridge and the existing client/server re-export paths so later call sites
can import one name.

## Acceptance Criteria

- `resolveFloorY` exists in `game/shared/floorSampling.esm.js` and returns `DEFAULT_FLOOR_Y` when the input is `null`, `NaN`, `Infinity`, `-Infinity`, or `undefined`.
- `resolveFloorY` returns the input unchanged when it is a finite number (including `0`).
- `game/shared/floorSampling.js` exposes `resolveFloorY` on `module.exports` (update the `return { … }` object in the eval bridge).
- `game/client/collision.js` re-exports `resolveFloorY` alongside `sampleFloorY` and `DEFAULT_FLOOR_Y`.
- `game/server/dungeon.js` includes `resolveFloorY` in its `module.exports` (same source as `sampleFloorY`).
- Vitest coverage in `game/client/test/shared-floor-sampling.test.js` asserts the null / NaN / non-finite / finite cases above.
- No production call sites are required to migrate in this sub-ticket; only the helper and exports.

## Technical Specs

- **`game/shared/floorSampling.esm.js`**
  - Add `export function resolveFloorY(sampledY)` immediately after `DEFAULT_FLOOR_Y`.
  - Implementation: `return Number.isFinite(sampledY) ? sampledY : DEFAULT_FLOOR_Y` (same semantics the server already uses inline).
- **`game/shared/floorSampling.js`**
  - Change the bridge return to `return { sampleFloorY, DEFAULT_FLOOR_Y, resolveFloorY };`.
- **`game/client/collision.js`**
  - Import `resolveFloorY` from `../shared/floorSampling.esm.js` and `export` it (mirror the existing `sampleFloorY` / `DEFAULT_FLOOR_Y` pattern).
- **`game/server/dungeon.js`**
  - Destructure `resolveFloorY` from `require('../shared/floorSampling.js')` next to `sampleFloorY` / `DEFAULT_FLOOR_Y` and add it to `module.exports`.
- **`game/client/test/shared-floor-sampling.test.js`**
  - Import `resolveFloorY` and add a `describe('resolveFloorY')` block with cases: `null` → `0.5`, `NaN` → `0.5`, `Infinity` / `-Infinity` → `0.5`, `undefined` → `0.5`, `1.25` → `1.25`, `0` → `0`.

## Verification: code
