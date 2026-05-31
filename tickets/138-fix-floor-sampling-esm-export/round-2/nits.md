## Deduplicate floorSampling CJS/ESM sources

Ticket 138 ships identical `sampleFloorY` / `DEFAULT_FLOOR_Y` implementations in `floorSampling.js` (CJS) and `floorSampling.esm.js` (ESM) because Vite cannot consume `module.exports` named exports. Any future slope or interpolation tweak must touch both files manually until unified.
### Acceptance Criteria
- Server CJS and client ESM read from one source of truth (shared ESM with async server import, codegen, or a test that asserts both modules return identical results for a fixed fixture set) with no duplicated function bodies.

## Align flat-room regression test with ticket spec coordinates

`game/client/test/shared-floor-sampling.test.js` samples `(5, 5)` inside a room centred at `(0, 0)`; the ticket text specifies `(0, 0)` at the centre. Behaviour under test is the same for a flat room.
### Acceptance Criteria
- Flat-room case uses `(0, 0)` (or a comment explains why an edge-inclusive point is preferred) and still expects `DEFAULT_FLOOR_Y`.
