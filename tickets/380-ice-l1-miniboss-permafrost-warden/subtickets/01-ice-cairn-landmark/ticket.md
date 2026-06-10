# 01 — Ice cairn landmark

Add a deterministic `ice_cairn` layout landmark on the ice-cavern treasure pad so the stage-boss encounter framework (ticket 258) can anchor the Permafrost Warden fight at the south stone cairn instead of falling back to the entry dock.

## Acceptance Criteria

- `generateLayout(seed, 'ice-cavern', …)` returns a `landmarks` array with exactly one entry `{ type: 'ice_cairn', x, z }` at the treasure room centre (`role: 'treasure'`, `band: 'stone'`).
- The landmark coordinates match the treasure room's `x`/`z` (not the ice field or entry dock).
- `LANDMARK_FOOTPRINTS` includes `ice_cairn` for placement helpers used by other landmark code paths.
- `game/server/test/dungeon.test.js` asserts landmark presence, type, and treasure-room placement for ice-cavern layouts.
- `buildLandmarkMesh('ice_cairn', …)` in the client emits a non-empty procedural mesh group tagged with `userData.landmarkType === 'ice_cairn'`.
- `game/client/test/dungeon.test.js` covers ice-cavern landmark rendering (one group per server landmark entry).

## Technical Specs

- **`game/server/dungeon.js`** — In `generateIceCavern()`, set `landmarks: [{ x: treasure.x, z: treasure.z, type: 'ice_cairn' }]` on the returned layout object. Add `ice_cairn` to `LANDMARK_FOOTPRINTS` (e.g. `{ width: 2.0, depth: 2.0 }`).
- **`game/server/test/dungeon.test.js`** — Extend the `generateLayout(seed, 'ice-cavern')` describe block: `landmarks` length 1, type `ice_cairn`, coordinates equal treasure-room centre.
- **`game/client/dungeon.js`** — Add an `ice_cairn` case to `buildLandmarkMesh()` (frost-tinted stone cairn / ice-capped pedestal — visual only, no collision).
- **`game/client/test/dungeon.test.js`** — Assert `buildLandmarkMesh('ice_cairn', …)` and `buildDungeon` on an ice-cavern layout with landmarks emit one `ice_cairn` group.
- No enemy types, quest wiring, or encounter logic in this sub-ticket.

## Verification: code
