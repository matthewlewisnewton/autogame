# Server: Hub layout unit tests

Add a `describe("generateLayout(seed, 'hub')")` block to the server dungeon test
suite that verifies hub profile shape, zone grouping, booth-anchor positions, full
foot reachability / collision, and determinism.

## Acceptance Criteria

- New tests live in `game/server/test/dungeon.test.js` and import `generateHub` if
  exported (otherwise test via `generateLayout(seed, 'hub')` only).
- **Profile & shape**: `generateLayout(42, 'hub')` has `profile === 'hub'`, exactly
  3 rooms, at least 2 passages, and one room per `hubZone`
  (`'operations'`, `'commerce'`, `'salon'`).
- **Roles**: Operations room has `role: 'start'`; Commerce and Salon rooms have
  `spawnWeight: 0`.
- **Booth anchors**: `layout.boothAnchors` contains keys `quest`, `launch`, `shop`,
  `deck`, `character`, `hats`. For each key, `{ x, z }` is inside the correct zone
  room's AABB (inset by ≥ 1 unit from edges) and `isWalkable(x, z, aabbs, colliders)`
  returns true using the existing test helpers and `PLAYER_RADIUS`.
- **Reachability**: for seeds `1, 42, 123, 777`, `countReachableRooms` equals
  `layout.rooms.length` (all three zone rooms reachable from start via walkable
  floor + passages).
- **Determinism**: `generateLayout(2024, 'hub')` called twice yields deep-equal
  results.
- `pnpm test:quick` (or `pnpm test` from `game/`) passes with the new tests.

## Technical Specs

- `game/server/test/dungeon.test.js`:
  - Add helpers (local to the describe block):
    - `roomByHubZone(layout, zone)` — filter `layout.rooms` by `hubZone`.
    - `anchorInsideRoom(anchor, room, inset)` — axis-aligned bounds check.
    - `hubReachableFromStart(layout)` — wraps `buildWallColliders`,
      `computeWalkableAABBs`, and `countReachableRooms` (same pattern as the
      `spire-ascent` reachability tests).
  - Add `describe("generateLayout(seed, 'hub')")` with the acceptance tests above.
- No production code changes unless a test reveals a bug in sub-ticket 01; fix only
  what the failing test proves is wrong.

## Verification: code
