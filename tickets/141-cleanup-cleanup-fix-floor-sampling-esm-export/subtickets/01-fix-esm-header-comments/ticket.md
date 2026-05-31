# Fix stale header comments in floorSampling.esm.js

After ticket 140, `floorSampling.esm.js` is the canonical implementation and `floorSampling.js` is a thin CJS loader. The ESM file header still claims it "mirrors" the CJS file and must be "kept in sync" — the opposite of reality.

## Acceptance Criteria

- `game/shared/floorSampling.esm.js` top-of-file comment states it is the **canonical** implementation.
- The comment mentions that `floorSampling.js` loads this file at `require` time (not the reverse).
- No comment suggests maintaining two parallel copies of `sampleFloorY` or keeping files "in sync."

## Technical Specs

- **File to change:** `game/shared/floorSampling.esm.js` (lines 1–4 only — the header comment block)
- Replace the 4-line header with a 2–3 line comment clarifying ownership direction.

## Verification: code
