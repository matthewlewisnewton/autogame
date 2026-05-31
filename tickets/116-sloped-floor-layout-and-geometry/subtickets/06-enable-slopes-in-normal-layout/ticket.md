# Enable Slopes in Normal Layout Generation

Wire `{ slopes: true }` into `applyLayoutForQuest()` so that sloped floor layouts are produced in normal gameplay, not just via the `?debugScenario=sloped-dungeon` shortcut. This makes the debug scenario's end-state reachable through normal play, satisfying the harness debug-scenario rule.

## Acceptance Criteria

- `applyLayoutForQuest(state, questId)` passes `{ slopes: true }` to `generateLayout()` so that every quest layout includes sloped rooms.
- The `?debugScenario=sloped-dungeon` handler still works (regenerates layout with slopes) — it becomes a convenience shortcut, not the sole path.
- Existing unit tests for `generateLayout` with `{ slopes: true }` continue to pass.
- A new test (or assertion in an existing test) verifies that `applyLayoutForQuest` produces a layout with at least one room having non-uniform `floorCorners`.
- Flat legacy behavior is preserved for any code path that calls `generateLayout` without the slopes option.

## Technical Specs

- **File:** `game/server/index.js` — in `applyLayoutForQuest()`, change `generateLayout(seed, profile)` to `generateLayout(seed, profile, { slopes: true })`.
- **File:** `game/server/test/server.test.js` (or `game/server/test/dungeon.test.js`) — add a test that calls `applyLayoutForQuest` with a real game state and asserts that `state.layout.rooms` contains at least one room with differing `floorCorners` values.

## Verification: code
