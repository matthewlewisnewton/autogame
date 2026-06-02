# 02 — Fix floor-geometry implementation reference

The `### Floor Geometry` subsection still says slope-following movement was
“implemented in ticket 117”. That harness ticket reference is stale; the behavior
lives in server simulation code today. Replace it with a pointer to the real
implementation without changing the rest of the floor-sampling description.

## Acceptance Criteria

- Only `game/docs/design.md` is modified.
- The Floor Geometry subsection no longer mentions ticket 117 or any harness
  ticket id.
- It states that server movement snaps `player.y` via floor sampling (cite
  `applyPlayerMovement` in `game/server/simulation.js`, which calls
  `sampleFloorY`).
- Descriptions of `sampleFloorY()`, `floorCorners`, and paths under
  `game/shared/floorSampling.esm.js` / `floorSampling.js` remain accurate and are
  not rewritten beyond the stale reference fix.
- Section heading `### Floor Geometry` is preserved.

## Technical Specs

- Edit `game/docs/design.md` only — `### Floor Geometry` paragraph.
- Cross-check before editing:
  - `game/server/simulation.js`: `applyPlayerMovement` sets `player.y` from
    `sampleFloorY(_gameState.layout, …)`.
  - `game/shared/floorSampling.esm.js`: `sampleFloorY` and `floorCorners`
    interpolation (paths in the doc should stay consistent with `game/shared/`).
- Remove workflow/ticket language; add a brief “implemented in …” clause naming
  `game/server/simulation.js` (function name optional but helpful).

## Verification: code
