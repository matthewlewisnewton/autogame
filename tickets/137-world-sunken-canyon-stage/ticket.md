# Sunken Canyon Stage

Add a new **"Sunken Canyon"** level type — players start on a high plateau and
**descend** through bridges and ramps into a wide open canyon floor, mixing
significant height loss with horizontal openness on the final level.

## Difficulty: hard

## Goal

Generate a stage with **two clear elevation bands** — a small upper plateau
(spawn area) and a large open canyon floor (≥ 4× the area of a normal room) —
connected by **2–3 descending ramp paths** with total Y drop ≥ 8 units. The
canyon floor is the main play area; the plateau is a vantage and re-entry
point.

## Problem

Once 116/117 land we'll have ramps and vertical movement, but nothing in the
generator forces a **descent** or combines vertical and horizontal openness
in the same map. A canyon stage tests the opposite gradient from the spire
(136) and gives ranged classes a "shoot from the high ground" moment.

## Acceptance Criteria

- New stage variant selectable from `generateLayout({ stage: "sunken-canyon" })`.
- Layout has exactly two elevation bands: an upper plateau (room-sized) and
  a lower canyon floor (≥ 4× a default room's area, walkable polygon).
- 2–3 distinct ramp paths connect plateau → canyon. Each ramp uses
  `floorCorners` from ticket 116 and has an average slope ≥ 0.15 (so the
  descent is felt). No vertical-cliff drop between the bands (must be
  reachable on foot).
- Total Y drop from plateau spawn to canyon center ≥ 8 units.
- Outer walls enclose both bands; no walk-off-the-map gaps.
- Camera follow works on both bands and on the ramps; players standing on
  the plateau edge can see down into the canyon (no occlusion bug).
- Enemy spawns are distributed: ≥ 1 spawn on the plateau (to threaten
  spawn-camping), majority in the canyon.
- Objective / exit is on the canyon floor, reachable on foot from the
  plateau via the ramps.
- Deterministic given a seed.
- Unit tests cover: exactly two bands, ramps connect them, plateau Y > canyon
  Y by ≥ 8, ramp slope bounds, full reachability.

## Implementation Notes

- **Hard depends on both 116 and 117**, same reason as 136 — without 117 the
  descent is cosmetic only.
- Strongly recommend sharing the ramp-generator helper with 136 (the spire);
  one direction of travel differs, the geometry is the same shape.
- Canyon floor should reuse the open-plaza (135) cover-scattering approach if
  that helper exists — pillars / broken walls give the canyon shape and
  prevent it from feeling like an empty box. If 135 ships first, lift its
  scatter routine; if not, write it small and self-contained here.
- Vista line-of-sight from plateau down to canyon is the signature moment —
  validate visually with a screenshot at spawn during QA.
