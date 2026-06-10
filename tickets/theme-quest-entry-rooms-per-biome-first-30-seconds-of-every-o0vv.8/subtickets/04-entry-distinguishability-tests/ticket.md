# Cross-quest entry room distinguishability regression tests

Lock in the top-level acceptance criterion: spawn rooms for `frost_crossing`, `ember_descent`, and `training_caverns` must be visually distinguishable at a glance via different floor/wall palette and/or entry decor. Add focused vitest coverage that exercises the full server layout → client `buildDungeon` path for all three quests.

## Acceptance Criteria

- A new test (or describe block) generates layouts for `frost_crossing`, `ember_descent`, and `training_caverns` tier 1 at fixed seeds, runs `buildDungeon`, and collects start-room floor + wall material hex colors.
- All three quest entry floor colors are pairwise different; at least two of three entry wall colors are pairwise different (floor OR wall + decor type must make each quest identifiable).
- Each layout's start room has the expected `entryDecor` type from sub-ticket 03 (`icicle_cluster`, `ember_vent`, `vault_rubble` respectively).
- No changes to gameplay logic, collision, or quest definitions beyond test imports.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/client/test/dungeon.test.js`** (preferred) or **`game/server/test/entry_room_theme.test.js`** — import `generateLayout` from server dungeon (existing test pattern), `getLayoutProfileForQuest` / quest tier helpers from `game/server/quests.js` or test fixtures, and `buildDungeon` + `findRoomFloorMesh` helpers from existing dungeon tests. Use quest layout profiles: `ice-cavern` (frost_crossing), `fire-cavern` (ember_descent), `crowded` (training_caverns). Fixed seeds: reuse validation seeds where documented (e.g. ember_descent seed `1023983957`, training_caverns `352369970`) or seed `42` if quest-agnostic.
- Helper: `collectStartRoomAppearance(layout)` → `{ floorHex, wallHex, decorTypes[] }`.
- Assertions: `expect(new Set([frost.floorHex, ember.floorHex, vault.floorHex]).size).toBe(3)` and decor type checks per quest.

## Verification: code
