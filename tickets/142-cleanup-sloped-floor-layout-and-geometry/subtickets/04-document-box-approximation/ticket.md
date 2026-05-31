# Document box approximation in buildSlopedFloor JSDoc

`buildSlopedFloor()` uses a single rotated `BoxGeometry` along the dominant axis; bilinear `sampleFloorY()` defines a slightly different surface for non-axis-aligned corner patterns (e.g. diagonal ramps). The JSDoc should explicitly state this is an intentional visual approximation rather than a bug.

## Acceptance Criteria
- The JSDoc block above `buildSlopedFloor()` in `game/client/dungeon.js` contains a note explaining that the rotated `BoxGeometry` is a visual approximation of the bilinear surface defined by `sampleFloorY()`.
- The note mentions that minor gaps may appear at room edges for non-axis-aligned corner patterns (e.g. diagonal ramps).
- No functional code is changed — only the documentation comment.

## Technical Specs
- **File**: `game/client/dungeon.js` — edit the JSDoc block for `buildSlopedFloor()` (currently lines ~57–60).
- Add a sentence such as: "The rotated BoxGeometry is a visual approximation of the bilinear surface defined by `sampleFloorY()`; minor gaps may appear at room edges for non-axis-aligned corner patterns (e.g. diagonal ramps). This is intentional — a four-corner BufferGeometry match is deferred to a future art pass."

## Verification: code
