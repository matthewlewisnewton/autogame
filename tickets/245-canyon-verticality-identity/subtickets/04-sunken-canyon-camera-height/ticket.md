# Lower sunken-canyon follow camera

Reduce the orbit camera height while playing on the sunken-canyon profile so the ~10u
plateau-to-canyon drop feels more dramatic; restore the default height on all other stages.

## Acceptance Criteria

- When the active dungeon layout has `profile === 'sunken-canyon'`, `updateCameraOrbit`
  uses a **lower follow offset** than the global `CAMERA_HEIGHT` (target reduction ≈
  1.5–2.5 units; e.g. `3.5` vs `5.0` from `game/client/config.js`).
- Lobby, hub, open-plaza, spire-ascent, crowded/open grid, and other profiles keep the
  existing `CAMERA_HEIGHT` behaviour.
- `rebuildDungeonLayout` / layout swaps update the active camera-height mode immediately
  (entering or leaving canyon_descent / `sunken-canyon-stage` debug scenario toggles offset).
- Export a small pure helper (e.g. `getCameraFollowHeight(profile)`) so unit tests can
  assert `sunken-canyon` < `default` without screenshots.
- No change to camera yaw, lock-on, or player Y sampling (sloped-floor follow stays as-is).

## Technical Specs

- **`game/client/config.js`**
  - Add `SUNKEN_CANYON_CAMERA_HEIGHT` (or similar named constant) documented as profile-only.
- **`game/client/renderer.js`**
  - Track `currentLayoutProfile` (if not already) and use `getCameraFollowHeight(profile)`
    in `updateCameraOrbit` and initial `initScene` camera placement.
  - Call profile refresh from `rebuildDungeonLayout` when layout profile changes.
- **`game/client/test/`** (new `camera-height.test.js` or extend renderer tests)
  - Assert helper returns lower value for `'sunken-canyon'` than for `undefined` / other profiles.

## Verification: code
