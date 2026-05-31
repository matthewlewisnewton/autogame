## Deduplicate floorSampling CJS/ESM sources

Ticket 138 landed a full duplicate of `sampleFloorY` in `floorSampling.esm.js` instead of a thin re-export from `floorSampling.js`. Both files must be edited in lockstep for any future slope tweak.
### Acceptance Criteria
- A single source of truth exports `sampleFloorY` and `DEFAULT_FLOOR_Y` for server CJS and client ESM without duplicated function bodies (or a documented codegen step keeps them identical).

## Align flat-room regression test with ticket spec coordinates

`shared-floor-sampling.test.js` asserts the flat room at `(5, 5)`; the ticket text uses `(0, 0)` at room centre — equivalent for the fixture but slightly divergent from the written spec.
### Acceptance Criteria
- Test uses `(0, 0)` (or documents why an off-centre point is preferred) and still expects `DEFAULT_FLOOR_Y`.
