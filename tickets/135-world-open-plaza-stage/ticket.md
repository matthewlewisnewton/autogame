# Open Plaza Stage

Add a new **"Open Plaza"** level type to the dungeon generator — a sparse,
arena-style world dominated by wide open ground with scattered low cover and
gentle slope variation, instead of the current corridor-and-room layout.

## Difficulty: medium

## Goal

Give `generateLayout()` a new stage variant that produces a single large open
walkable area (≥ 4× the area of a normal room) with scattered pillars, broken
walls, and a handful of subtly sloped platforms, so combat plays out with
long sightlines and ranged spacing instead of tight chokepoints.

## Problem

Every generated level today is rooms-and-passages — there is no map shape that
rewards positioning, kiting, or ranged play. The dungeon also never exercises
the sloped-floor system at small/shallow gradients, so we have no evidence
that gentle elevation reads well in play.

## Acceptance Criteria

- New stage variant selectable from `generateLayout({ stage: "open-plaza" })`
  (or equivalent enum/key — pick something consistent with existing stage
  selection in `game/server/dungeon.js`).
- The plaza is a single walkable polygon at least 4× the area of a default
  room, bounded by outer walls so players cannot exit the level.
- ≥ 6 freestanding cover pieces (pillars, broken walls, low planters) scattered
  through the plaza, each respecting wall collision and not blocking
  traversability between any two reachable points.
- ≥ 2 of those cover pieces sit on **gently sloped** platforms (use
  `floorCorners` from ticket 116 with a max corner-height delta of ~0.5 units)
  so movement up onto a platform reads as a subtle rise, not a step.
- Deterministic given a seed: same seed in → same layout out.
- Spawn placement keeps all party members on the plaza floor (not inside a
  pillar, not on a slope edge).
- Existing enemy spawn / objective placement code still works on this stage
  (or has a documented fallback for "no room list").
- Unit tests cover: stage produces output with the right shape, slopes are
  within the documented bound, no cover piece is unreachable.

## Implementation Notes

- Depends on **116-sloped-floor-layout-and-geometry** for `floorCorners` and
  `sampleFloorY()`. Does NOT require 117 (sloped movement) to land first —
  flat traversal is acceptable for v1, with the gentle slopes purely visual
  until 117 ships.
- Reuse the existing wall/pillar mesh primitives on the client — no new asset
  pipeline. Pillar = a tall box; broken wall = a low box.
- Stage selection: extend whatever the current "stage 1 vs stage 2" hook is.
  If there isn't one, plumb a `stage` field through `init` payload and have
  the client read it.
