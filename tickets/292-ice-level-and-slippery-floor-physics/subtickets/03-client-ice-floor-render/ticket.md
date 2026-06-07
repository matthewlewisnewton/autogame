# Client: ice-cavern materials and slippery floor visuals

Render the new `ice-cavern` profile with a distinct frozen palette and make `floorSurface: 'slippery'` rooms visually distinguishable from stone/normal floors. Non-ice layouts with slippery rooms (e.g. `slippery-floor-lab`) must also show the slippery material override.

## Acceptance Criteria

- `game/shared/dungeonTheme.json` defines an `ice-cavern` profile (cool blue/white floor and wall hexes, lower `floorRoughness` than crowded default).
- `getProfileMaterials('ice-cavern')` returns cached materials distinct from `sunken-canyon` and `crowded` (unit test asserts hex colors differ).
- `buildDungeon(layout)`:
  - Uses the `ice-cavern` profile palette for walls and non-slippery floors.
  - Rooms (and platforms) with `floorSurface: 'slippery'` render with a dedicated slippery material (higher emissive, icy tint) regardless of profile — including the lab layout from sub-ticket 01.
  - Stone vs ice **bands** on `ice-cavern` layouts can use band-specific tints (mirror `getSunkenCanyonBandMaterials` pattern) while still honoring `floorSurface`.
- Treasure marker on `ice-cavern` treasure rooms sits at `sampleFloorY(...) + offset` (not hard-coded `FLOOR_Y`).
- Client unit tests in `game/client/test/dungeon.test.js` assert: slippery room mesh material differs from co-layout normal room; server-generated `generateLayout(42, 'ice-cavern')` builds without error and produces ≥ 1 slippery floor mesh.

## Technical Specs

- `game/shared/dungeonTheme.json`: add `ice-cavern` entry with `stoneFloor`, `iceFloor`, wall, passage, and accent keys.
- `game/client/dungeon.js`:
  - Extend `getProfileMaterials` / add `getIceCavernBandMaterials(band)` helpers (cache like sunken-canyon).
  - Add `getSlipperyFloorMaterial(baseFloorMaterial)` cached singleton (low roughness, emissive ice blue).
  - In the room floor mesh loop, branch on `room.floorSurface === 'slippery'` (and platform equivalent) to pick slippery material.
  - Band tints for `layout.profile === 'ice-cavern'` select stone vs ice base before slippery override.
- `game/client/test/dungeon.test.js`: fixtures for lab layout + `generateLayout(42, 'ice-cavern')`; material color assertions.

## Verification: code
