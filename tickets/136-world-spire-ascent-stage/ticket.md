# Spire Ascent Stage

Add a new **"Spire Ascent"** level type — a vertical tower world where players
climb upward through stacked tiers connected by ramps, with a meaningful total
height gain from bottom to top.

## Difficulty: hard

## Goal

Generate a stage built as **3–5 stacked tiers** (each tier ≈ the size of one
normal room) connected by **sloped ramp passages**, so total floor-Y gain from
spawn to the top tier is ≥ 10 units. Each tier has its own enemies and the
final tier holds the objective / exit.

## Problem

The whole game plays at `y ≈ 0.5`. We have no level that exercises sustained
height gain, multi-stage encounter pacing, or ramp-based movement at any real
elevation. Without one, the sloped-floor work (116/117) only ever shows up as
cosmetic bumps in otherwise-flat rooms.

## Acceptance Criteria

- New stage variant selectable from `generateLayout({ stage: "spire-ascent" })`.
- Layout contains 3–5 distinct **tiers**, each tier a flat (or near-flat)
  room-sized platform. Tier `n` sits strictly above tier `n-1` in world Y.
- Tiers are connected by **ramp passages** using sloped `floorCorners` from
  ticket 116; each ramp's average slope ≥ 0.2 (rise/run) so the climb is felt,
  not subliminal.
- Total Y gain from spawn point to the top tier's exit ≥ 10 units.
- Walls along the outer edge of every tier and every ramp prevent walking off
  the spire (no fall-through).
- Camera follow continues to track the player as they ascend — no
  obvious clipping or "stuck below the floor" frames in normal play.
- Enemy spawns are distributed across tiers (not all on tier 1, not all on
  the top).
- Objective / exit is on the final tier and is reachable on foot from spawn
  via the ramps alone (no jumping required).
- Deterministic given a seed.
- Unit tests cover: tier count in range, monotonic Y per tier, every tier
  reachable from spawn via the ramp graph, no orphan tier.

## Implementation Notes

- **Hard depends on both 116 and 117** — without 117, `player.y` won't
  actually rise during play and the spire is just visually-sloped flat ground.
  Order this after both have landed.
- Reuse the room mesh primitives — a tier is a room. The ramp passage is the
  new piece; build it as a thin sloped slab.
- Recommend a "ramp generator" helper that takes (fromRoom, toRoom, width)
  and emits the `floorCorners` for the connecting passage. Worth sharing with
  the canyon stage (137).
- Spawn point at the bottom; objective marker at the top. Use whatever
  objective-placement code dungeon-run-objectives (ticket 025) already has.
