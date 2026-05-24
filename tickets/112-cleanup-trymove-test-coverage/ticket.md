# Cleanup tryPlayerMove test coverage and naming

> **Staleness note.** This follow-up ticket was written against commit
> `b299845` (2026-05-23). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

The single test added in `ee93e4a` for `tryPlayerMove` is correct but narrow: it only exercises the terminal `moved: false` return branch, its name and commit message misdescribe the geometry being tested, and several non-trivial branches (axis sliding, void-with-slide-rescue, valid happy path) remain uncovered.

## Difficulty: easy

## Code references

> The references in this section were reviewed at commit `b299845`; verify them against the current code before editing.

- `game/server/test/simulation.test.js:203-221` — the lone `tryPlayerMove` test. Direction `(0, 1)` from `(0, 0)` for distance 100 heads perpendicular to the passage (z=0), into the wall north of Room A, **not** into the void between rooms as the commit message claims.
- `game/server/test/simulation.test.js:211` — `dungeonBounds` extend past room AABBs but with no comment explaining the intent (so clamping cannot mask the void rejection).
- `game/server/simulation.js:216-261` — `tryPlayerMove` axis-slide branches and the valid-move return path are not covered by any test in this file.

## Acceptance Criteria

- `it()` description and any commit-style header above it accurately describe the move geometry being tested.
- New test cases cover:
  - A valid in-room move (`moved: true`, returned position equals destination).
  - A blocked-direct + successful axis-slide case (`moved: true`, position slid along the wall).
  - A blocked-direct + failed axis-slide case (the existing "rejection" test, kept).
- `dungeonBounds` choice has an inline comment explaining why the bounds extend past the rooms.

## Technical Specs

- Likely files: `game/server/test/simulation.test.js`, possibly `game/server/test/helpers.js` if a small fixture-builder is extracted.
- Keep the mock layout small (two rooms + a passage is sufficient).

## Verification: code
