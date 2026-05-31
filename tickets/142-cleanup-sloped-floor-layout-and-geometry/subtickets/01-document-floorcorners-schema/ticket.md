# Document floorCorners schema in design.md

`game/docs/design.md` describes sloped floors conceptually but does not name the `floorCorners: { yNW, yNE, ySE, ySW }` field that every generated room now carries. Add a one-line schema note to the Floor Geometry section so downstream readers don't need to read server code to understand the data shape.

## Acceptance Criteria
- `game/docs/design.md` **Floor Geometry** section mentions the `floorCorners` object with its four corner keys (`yNW`, `yNE`, `ySE`, `ySW`).
- Corner labels match the naming convention in `shared/floorSampling.esm.js` (NW/NE/SE/SW relative to room center).
- No existing prose in the Floor Geometry section is removed or contradicted.

## Technical Specs
- **File**: `game/docs/design.md` — edit the `### Floor Geometry` section (currently line ~12–13).
- Add a sentence such as: "Each room carries a `floorCorners: { yNW, yNE, ySE, ySW }` object specifying the Y height at each corner; corners are ordered counter-clockwise from the top-left (NW) relative to room center."

## Verification: code
