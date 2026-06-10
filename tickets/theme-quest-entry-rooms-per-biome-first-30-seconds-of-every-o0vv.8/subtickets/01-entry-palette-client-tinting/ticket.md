# Entry palette + client start-room floor/wall tinting

Every quest spawn room currently picks up the same global green `roleTints.start` mixed into a neutral base, so ice, fire, and vault entries all read as stone/green on deploy. Add per-profile entry floor/wall colors in the theme data and teach the client renderer to use them for `role: 'start'` rooms in biome profiles (ice-cavern, fire-cavern, crowded), including band-aware wall materials.

## Acceptance Criteria

- `game/shared/dungeonTheme.json` defines distinct `entryFloor` and `entryWall` hex colors for `ice-cavern`, `fire-cavern`, and `crowded` profiles (each pair visually distinct from the other two).
- `buildDungeon()` applies entry floor **and** entry wall materials to the start room when `layout.profile` is `ice-cavern`, `fire-cavern`, or `crowded` — not the generic green `roleTints.start` floor.
- Ice-cavern and fire-cavern band resolvers (`resolveIceCavernRoomFloorMaterial`, `resolveFireCavernRoomMaterials`) use entry palette for start rooms instead of `get*RoleFloorMaterial` + global green tint.
- Non-start rooms and non-target profiles keep their existing material behavior unchanged.
- `pnpm test:quick` passes (existing + new client dungeon tests).

## Technical Specs

- **`game/shared/dungeonTheme.json`** — add `entryFloor` / `entryWall` under `profiles.ice-cavern`, `profiles.fire-cavern`, and `profiles.crowded`. Suggested direction: ice = cool blue-gray floor + pale frost wall; fire = charred rim floor + ember-orange wall; crowded/vault = dark slate floor + oxidized bronze wall.
- **`game/client/dungeon.js`** — add `getEntryRoomMaterials(profile)` (cached) reading the new theme keys; export `getEntryRoomMaterialColors(profile)` for tests. Update `resolveIceCavernRoomFloorMaterial`, `resolveFireCavernRoomMaterials`, and the crowded/default branch inside `buildDungeon()` so start-room floors use entry palette. Add `resolveIceCavernRoomWallMaterial` / `resolveFireCavernRoomWallMaterial` (or extend existing resolvers to return `{ floor, wall }`) and wire `roomWallMat` in the room loop for ice/fire profiles. Crowded start rooms (no band) should use entry materials directly.
- **`game/client/test/dungeon.test.js`** — assert `getEntryRoomMaterialColors` returns three mutually distinct floor hex values; assert `buildDungeon` start-room floor hex differs across ice-cavern, fire-cavern, and crowded fixtures at a fixed seed.

## Verification: code
