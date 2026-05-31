# Add client-side regression test for ESM floorSampling import

Guard against future breakage of the ESM named-export path by adding a vitest test that imports `sampleFloorY` and `DEFAULT_FLOOR_Y` from the ESM re-export and asserts their runtime behaviour.

## Acceptance Criteria

- `game/client/test/shared-floor-sampling.test.js` exists and runs under `pnpm --filter client test`.
- The test file imports via ESM: `import { sampleFloorY, DEFAULT_FLOOR_Y } from '../../shared/floorSampling.esm.js'`.
- Test cases cover:
  - `DEFAULT_FLOOR_Y === 0.5`
  - `sampleFloorY({rooms:[]}, 0, 0) === null` (no rooms → null)
  - `sampleFloorY({rooms:[{x:0,z:0,width:10,depth:10}]}, 5, 5) === 0.5` (flat room centre)
  - One sloped-room case with `floorCorners` that returns the bilinearly interpolated value at the room centre.
- All tests pass with zero failures.

## Technical Specs

- **Create** `game/client/test/shared-floor-sampling.test.js` using vitest `describe`/`it`/`expect` (follow the pattern in existing client tests such as `game/client/test/delta.test.js`).
- For the sloped-room case, use a room with `floorCorners: { yNW: 0, yNE: 2, ySE: 4, ySW: 2 }`; the bilinear interpolation at the centre `(u=0.5, v=0.5)` yields `2.0`.

## Verification: code
