# Server entry room biome band tags

Layout generators tag the spawn room with a neutral `stone` or implicit default band, so downstream clients cannot tell which biome the player entered. Update ice-cavern, fire-cavern, and crowded generators to stamp entry/start rooms (and their connector ramps where applicable) with biome-specific `band` values the client palette from sub-ticket 01 can key off.

## Acceptance Criteria

- `generateIceCavern()` start room uses `band: 'entry'` (not `'stone'`) and keeps `role: 'start'`, `floorSurface: 'normal'`, and existing geometry/collision unchanged.
- `generateFireCavern()` start rim room keeps `role: 'start'` and uses `band: 'entry'` (replacing `'rim'` on the spawn room only); basin and ramp bands are unchanged.
- Crowded / grid `generateLayout()` path tags the start room (`role: 'start'`) with `band: 'vault-entry'` after `assignRoomRoles`.
- Connector ramp rooms in ice-cavern and fire-cavern retain `band: 'ramp'` and `role: 'connector'`; no room dimensions, wall AABBs, or cover collision footprints change.
- Server dungeon tests pass and assert the new band values on generated layouts at a fixed seed.

## Technical Specs

- **`game/server/dungeon.js`** — in `generateIceCavern`, change the `entry` room object `band` from `'stone'` to `'entry'`. In `generateFireCavern`, change the `rim` start room `band` from `'rim'` to `'entry'` (treasure basin stays `'basin'`). In the crowded grid branch (after rooms are built and `assignRoomRoles` runs), set `layout.rooms[0].band = 'vault-entry'` when `profileName === 'crowded'`. Do not alter `scatterCoverInArena`, wall segments, or `floorCorners`.
- **`game/client/dungeon.js`** — extend ice/fire band resolvers so `band === 'entry'` maps to the entry palette from sub-ticket 01 (if not already handled by `role === 'start'` alone).
- **`game/server/test/dungeon.test.js`** — update existing ice/fire role assertions (`expect(start.band).toBe('stone')` → `'entry'`, rim start → `'entry'`); add crowded seed fixture asserting start room `band === 'vault-entry'`.

## Verification: code
