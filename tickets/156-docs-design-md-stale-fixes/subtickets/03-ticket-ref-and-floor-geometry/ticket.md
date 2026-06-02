# Floor geometry: remove stale ticket reference

The Floor Geometry section references "ticket 117" — a beads ticket number that is not a code artifact and will become stale. Remove the ticket reference and reword to describe the implementation directly.

## Acceptance Criteria

- The sentence "Player movement on slopes — adjusting `player.y` to follow the floor surface — is implemented in ticket 117." is rewritten to remove the ticket number.
- Suggested replacement: "Player movement on slopes — adjusting `player.y` to follow the floor surface — uses `sampleFloorY()` for height interpolation."
- The rest of the Floor Geometry section (descriptions of `sampleFloorY()`, `floorCorners`, corner labels) is left unchanged since those are accurate.

## Technical Specs

- Edit only `game/docs/design.md`.
- Section: **Floor Geometry**.
- Verify that `sampleFloorY()` and `floorCorners` still exist in `shared/floorSampling.esm.js` (they do).

## Verification: code
