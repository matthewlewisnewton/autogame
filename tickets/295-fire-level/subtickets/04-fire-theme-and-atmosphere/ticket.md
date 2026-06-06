# Fire-cavern theme palette and atmosphere

Add fire/lava-themed dungeon materials and height-responsive atmosphere for
`fire-cavern` layouts. Rim stays cooler/darker; the basin glows warmer/brighter
as the player descends toward the lava floor.

## Acceptance Criteria

- `game/shared/dungeonTheme.json` has a `fire-cavern` profile with distinct
  rim/basin floor hues, wall colors, and an ember accent (warm oranges/reds, not
  reusing sunken-canyon greens).
- `getProfileMaterials('fire-cavern')` returns materials whose floor hex differs
  from `default` and `sunken-canyon` profiles (unit test in
  `game/client/test/dungeon.test.js`).
- Per-band floor materials for `fire-cavern` rooms:
  - `band: 'rim'` uses the rim floor hue.
  - `band: 'basin'` uses the basin / lava-stone hue.
  - `band: 'ramp'` lerps rim → basin along the ramp (mirror
    `getSunkenCanyonBandMaterials`).
- When the active layout has `profile === 'fire-cavern'`, the renderer applies
  **depth-responsive atmosphere**: `scene.background` and `scene.fog` interpolate
  from a dark cool tone at the rim toward a warm ember glow near the basin floor.
- Atmosphere normalizes player floor Y using rim (high) and basin (low) Y from
  `layout.rooms` (`band: 'rim'` / `band: 'basin'`).
- Leaving `fire-cavern` (lobby, other quest profile, hub) restores the default
  background (`0x0f172a`) and removes or resets fog so other stages are unaffected.
- Exported pure helper (e.g. `lerpFireCavernAtmosphere(t)`) allows unit tests to
  assert warm channel increases as `t` goes from 0 (rim) to 1 (basin) without a
  screenshot.
- `rebuildDungeonLayout` re-initializes fire atmosphere bounds when swapping
  to/from `fire-cavern`.

## Technical Specs

- `game/shared/dungeonTheme.json`:
  - Add `fire-cavern` entry with `floor`, `rimFloor`, `basinFloor`, `wall`,
    `passageFloor`, `passageWall`, `accent`, `floorRoughness`, `wallRoughness`.
- `game/client/dungeon.js`:
  - Implement `getFireCavernBandMaterials(band, yT)` and
    `resolveFireCavernRoomMaterials(room, layout)` (mirror sunken-canyon band
    cache pattern); wire into the room material resolution branch for
    `layout.profile === 'fire-cavern'`.
  - Export `getFireCavernBandFloorHex` for tests.
- `game/client/renderer.js`:
  - Add `FIRE_CAVERN_ATMOSPHERE` constants (rim/basin background and fog
    endpoints).
  - Add `initFireCavernAtmosphere(layout)`, `updateFireCavernAtmosphere(playerY,
    layout)`, `computeFireCavernAtmosphereBounds(layout)`, and `resetAtmosphere()`
    integration (mirror spire-ascent atmosphere hooks in `initScene`,
    `rebuildDungeonLayout`, and the main render loop).
  - Export `lerpFireCavernAtmosphere` for tests.
- `game/client/test/fire-atmosphere.test.js` (new, mirror
  `spire-atmosphere.test.js`):
  - `lerpFireCavernAtmosphere(1)` has higher red/orange channel sum than
    `lerpFireCavernAtmosphere(0)`.
  - `computeFireCavernAtmosphereBounds` returns rim Y > basin Y from a
    `generateLayout(42, 'fire-cavern')` layout.
- Extend `game/client/test/dungeon.test.js` with fire-cavern band hex assertions.

## Verification: code
