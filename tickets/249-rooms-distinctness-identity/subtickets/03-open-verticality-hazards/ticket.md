# Open profile verticality and hazard zones

Give the sparse `open` grid profile readable verticality and light hazard dressing so large empty rooms feel like a distinct sandy biome rather than flat grey boxes.

## Acceptance Criteria

- `generateLayout(seed, 'open', { slopes: true })` places at least one raised `platforms` entry (sloped floor patch with `floorCorners`) in a non-start combat room.
- Open layouts include a `hazards` array with at least one `{ x, z, width, depth, type: 'pit' }` entry per layout; pits sit inside a combat room, away from spawn and passage gaps.
- Open layouts scatter fewer `cover` pieces than crowded (target ≤ 2 total across the layout) so the profile stays open but not barren.
- Open layouts bias toward more ramps: when `options.slopes` is true, apply 2 sloped rooms when the room count allows (vs the current 1–2 random for all profiles).
- Client `buildDungeon` renders `layout.platforms` (existing path) and new `layout.hazards` as recessed darker floor meshes flush with `sampleFloorY`.
- Hazards are visual only (no damage or movement block) in this ticket.
- Vitest covers platform/hazard presence, in-room bounds, and client mesh creation for hazards.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `decorateOpenLayout(layout, rng, options)` invoked at the end of the open-profile branch in `generateLayout`.
  - Platform placement: pick 1–2 large combat rooms, place a `{ x, z, width, depth, floorCorners }` patch with gentle corner height variation (≤ 1.5 units rise).
  - Hazard placement: 1–2 shallow pit footprints per layout (`type: 'pit'`, depth metadata for client recess).
  - Sparse cover: 0–2 `broken_wall` or low `pillar` pieces using room-local scatter (reuse helpers from sub-ticket 02).
  - Ramp bias: after existing slope pass, if profile is `open` and `options.slopes`, ensure at least 2 ramp rooms when `rooms.length > 3`.
- `game/client/dungeon.js`:
  - In `buildDungeon`, iterate `layout.hazards || []` and add a thin recessed `BoxGeometry` mesh (darker sandy material from profile palette) slightly below the floor surface at each pit footprint.
  - Optionally place one low cover piece on a platform when both exist.
- `game/server/test/dungeon.test.js` and `game/client/test/dungeon.test.js`: assertions for open-layout `platforms`, `hazards`, and hazard mesh count.

## Verification: code
