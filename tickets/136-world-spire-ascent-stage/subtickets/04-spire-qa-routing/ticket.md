# Spire Ascent — dev routing & client floor render

Add harness dev scenarios to load spire-ascent in a running lobby (with correct spawn `player.y`) and confirm the client builds sloped tier/ramp meshes and a treasure marker at the apex.

## Acceptance Criteria

- `DEV_SCENARIOS` in `game/server/index.js` includes `spire-ascent-stage` (layout only, player at start tier with `player.y = sampleFloorY(...)`) and `spire-ascent` (full shortcut: quest layout + `spawnEnemies`, same pattern as `sunken-canyon` / `sunken-canyon-stage`).
- After the `spire-ascent-stage` scenario, `state.layout.profile === 'spire-ascent'` and the local player’s `y` matches floor height at the start-tier position (not stuck at `DEFAULT_FLOOR_Y` when the tier is elevated).
- Client dungeon builder renders all spire tier and ramp rooms without throwing; wall meshes use `sampleFloorY` for base Y on sloped ramps (same as sunken-canyon).
- Client test asserts a treasure marker (or objective mesh) is positioned at the top tier’s sampled floor Y + offset when given a generated `spire-ascent` layout.
- Camera follow needs no bespoke change: `updateCameraOrbit` already uses `playerY + CAMERA_HEIGHT`; acceptance is that spawn sets `player.y` from `sampleFloorY` so ascent does not leave the camera at y ≈ 0.5 while the mesh rises.

## Technical Specs

- **`game/server/index.js`** — add scenario branches beside `sunken-canyon-stage` / `sunken-canyon`; reposition player to `layout.rooms` start room; recompute `dungeonBounds`, `walkableAABBs`, colliders; emit `questUpdate` with layout payload.
- **`game/client/test/dungeon.test.js`** — new `describe('spire-ascent …')` block: import `generateLayout` from server dungeon module, build meshes, check ramp wall Y and treasure marker height (mirror sunken-canyon cover/floor tests).

## Verification: code
