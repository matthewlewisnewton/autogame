# Height-based skybox and fog (spire-ascent)

Add spire-ascent atmosphere that lightens scene background and fog as the player
ascends, reinforcing vertical tension and summit visibility.

## Acceptance Criteria

- When the active layout has `profile === 'spire-ascent'`, the renderer applies
  **height-responsive atmosphere**: `scene.background` and `scene.fog` (add
  `THREE.Fog` if absent) interpolate from a dark base at the bottom tier toward a
  lighter sky tone near the top tier.
- Atmosphere updates from the local player's floor Y (or camera Y), normalized using
  bottom and top tier Y from `layout.rooms` (`band: 'tier'`, min/max `tierIndex`).
- Leaving spire-ascent (lobby, other quest profile, hub) restores the default
  background (`0x0f172a`) and removes or resets fog so other stages are unaffected.
- Exported helper or test hook exposes the lerp result for a given normalized height
  (0 = base, 1 = summit) so unit tests can assert color ordering without a
  screenshot.
- `rebuildDungeonLayout` re-initializes spire atmosphere bounds when swapping to/from
  spire-ascent.

## Technical Specs

- **`game/client/renderer.js`**
  - Add `SPIRE_ATMOSPHERE` constants (base/summit background hex, fog near/far,
    fog color endpoints).
  - Add `initSpireAscentAtmosphere(layout)` / `updateSpireAscentAtmosphere(playerY,
    layout)` called from `initScene`, `rebuildDungeonLayout`, and the main
    `animate()` loop when profile is `spire-ascent`.
  - Store `currentLayoutProfile` (or read from module state) to gate updates.
  - Add `resetAtmosphere()` for non-spire layouts.
- **`game/client/test/`** (new `spire-atmosphere.test.js` or extend renderer tests)
  - Pure-function test: `lerpSpireAtmosphere(0)` is darker than
    `lerpSpireAtmosphere(1)` for background and fog color channels.

## Verification: code
