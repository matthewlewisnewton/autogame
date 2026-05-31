# Design Doc Note — Sloped Floors

Add a short note to `game/docs/design.md` documenting that dungeon floors can now slope and that movement height follows the floor surface (implementation deferred to ticket 117).

## Acceptance Criteria

- `game/docs/design.md` contains a new paragraph or bullet stating:
  - Dungeon rooms and passages may have sloped floors (ramps) with varying elevation.
  - The walkable surface height at any `(x, z)` is determined by `sampleFloorY()`.
  - Player movement on slopes (adjusting `player.y` to follow the floor) is implemented in ticket 117.
- The note is 2–4 sentences, consistent with the existing document style.

## Technical Specs

- **File:** `game/docs/design.md`
  - Add as a new `### Floor Geometry` subsection after the "Dungeon" paragraph in the Core Loop section.
  - Keep it brief — documentation only, no code changes.

## Verification: code
