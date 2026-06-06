# Server: ice-cavern layout, quest, and debug deploy

Add the `ice-cavern` layout profile (`generateLayout(seed, 'ice-cavern')`), wire it through quest selection, and expose debug shortcuts to load or deploy into the ice level. Ice-themed walkable zones use `floorSurface: 'slippery'`; stone entry/goal pads stay `normal`. Enemy types and spawn tuning are **out of scope** (ticket 293).

## Acceptance Criteria

- `generateLayout(seed, 'ice-cavern')` returns `{ profile: 'ice-cavern', rooms: [...], ... }` deterministically for a fixed seed.
- Layout has identifiable bands (e.g. `band: 'stone' | 'ice' | 'ramp'`):
  - **Stone entry** (`role: 'start'`, `floorSurface: 'normal'`) — safe spawn dock.
  - **Ice field** — at least one room with combined area ≥ 4× a default 13×13 room (≥ 676 units²), all tagged `floorSurface: 'slippery'`.
  - **Stone goal** (`role: 'treasure'`, `floorSurface: 'normal'`) reachable from start via walkable AABBs only (flood test).
  - Perimeter walls prevent walk-off; ramps/connectors may bridge stone ↔ ice with explicit `floorSurface` per room.
- New quest `frost_crossing` tier 1 in `QUEST_DEFS` with `layoutProfile: 'ice-cavern'`, `objectiveType: 'defeat_enemies'`, and a generic enemy pool (reuse grunt/skirmisher weights — no ice-exclusive types).
- `getLayoutProfileForQuest('frost_crossing')` returns `'ice-cavern'`.
- Debug scenarios:
  - `ice-cavern-stage` — loads the layout and seats the player at `role: 'start'` (mirror `sunken-canyon-stage`).
  - `frost-crossing-tier-1` — selects `frost_crossing` tier 1, applies layout, readies player, and enters playing phase (deploy shortcut).
- Both scenarios registered in `DEBUG_SCENARIOS` and return `ok: true`.
- `game/server/test/dungeon.test.js` covers profile shape, slippery-room tagging, determinism, and start→treasure reachability.
- Quest catalog tests updated (`game/server/test/quests.test.js`, `server.test.js` `QUEST_DEFS` key list, `integration.test.js` quest id list) to include `frost_crossing`.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `'ice-cavern'` to `LAYOUT_PROFILES` and branch in `generateLayout()` → `generateIceCavern(seed, options)`.
  - Implement `generateIceCavern`: stone entry platform, large central ice sheet, stone treasure pad; optional 1–2 connector ramps; reuse `OPEN_PLAZA`/`SUNKEN_CANYON` patterns for walls and cover scatter on stone zones only.
  - Tag rooms with `band`, `floorSurface`, and explicit roles (`start`, `treasure`, `connector`).
- `game/server/quests.js`: add `frost_crossing` quest def (tier 1 only for this ticket).
- `game/server/debugScenarios.js`: handlers for `ice-cavern-stage` and `frost-crossing-tier-1`.
- `game/server/index.js`: register both scenario names in `DEBUG_SCENARIOS` (and `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN` if deploy scenario skips default spawn).
- `game/server/progression.js` / deploy path: no special spawn logic required beyond existing `assignRunSpawnPositions` + `sampleFloorY` (ice enemies deferred to 293).
- Tests: new `describe("generateLayout(seed, 'ice-cavern')")` block; quest profile assertion; optional `game/server/test/frost_crossing_spawn.test.js` smoke that deploy uses `layout.profile === 'ice-cavern'`.

## Verification: code
