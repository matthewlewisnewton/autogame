## Runtime health

The captured game run starts and loads cleanly. `metrics.json` reports `ok: true`, no harness failure, and an empty `pageerrors` array. `console.log` has no `pageerror` or `[fatal]` entries from game code; the visible 409 resource lines are non-fatal and the scene initializes. Coverage also completed successfully: 54 test files and 1167 tests passed.

## Acceptance criteria findings

### 1. Player can move in the hub during lobby phase with in-run-style validation

Mostly satisfied for the normal create/join lobby path. The `move` handler now accepts both lobby and playing phases, keeps finite payload validation, stale sequence rejection, vector normalization, and connected-player gating. `runGameLoopTick` applies lobby movement each tick with a hub movement context, and the new `lobby_hub_movement.test.js` covers accepted lobby movement plus invalid payloads and stale sequences.

However, one normal lobby path remains broken: after a suspended run is abandoned, `abandonSuspendedRun()` still places players at `firstRoomPosition()` from the quest layout. For the default training caverns layout, that is `(-9, 27)`, which is outside the hub layout's walkable bounds (`z` max is about `8`). Since lobby movement is now resolved against `HUB_LAYOUT`, players returned by this path are not seated in the hub and cannot reliably walk the hub after abandoning the suspended expedition.

### 2. Movement bounded to hub geometry

Satisfied for new joins, lobby ticking, normal run return, and telepipe suspension: those paths use `hubSpawnPosition(HUB_LAYOUT)` and sample Y from `HUB_LAYOUT`, while lobby movement uses `buildHubMovementContext(HUB_LAYOUT)`.

Not fully satisfied across all reachable lobby states because `abandonSuspendedRun()` still samples and positions against `state.layout`, leaving players outside hub geometry in lobby phase. This is a blocking integration gap because the design explicitly supports abandoning a suspended run from the lobby and returning to normal lobby flow.

### 3. Test for lobby-phase move accept/bounds

Satisfied for the primary lobby movement behavior. The new `game/server/test/lobby_hub_movement.test.js` covers lobby move acceptance, invalid payload rejection, stale sequence rejection, hub bounds, and hub wall collision behavior. Existing movement tests were updated to pass explicit state/context, and the full coverage run passed.

The missing abandoned-suspended-run seating case is not covered, which allowed the integration gap above to remain.

## Design and foundation consistency

The explicit movement context direction is consistent with the ticket goal and avoids adding new global reads to the main player movement path. The implementation preserves playing-phase movement, server-client architecture, multiplayer state updates, and WASD synchronization requirements.

The remaining issue conflicts with the design's suspend/resume flow: a suspended run can be abandoned from the lobby, and that should return the squad to normal lobby flow. Returning players to a dungeon spawn that is outside the hub prevents that flow from being robust.

## Debug scenarios

No new or changed `?debugScenario=NAME` shortcut was introduced by this ticket. The captured run used no debug scenario, and the lobby movement tests exercise normal lobby socket flow rather than shortcut-only state.

## Remaining gaps

1. `abandonSuspendedRun()` returns players to the quest layout spawn instead of the hub spawn, leaving them outside `HUB_LAYOUT` while the lobby movement loop enforces hub bounds. Update that path to use `hubSpawnPosition(HUB_LAYOUT)` and sample floor Y from `HUB_LAYOUT`, and add a regression test that abandoned suspended runs leave players inside hub walkable geometry.

VERDICT: FAIL
