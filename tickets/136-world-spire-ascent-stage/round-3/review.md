# Senior Review: Spire Ascent Stage

## Runtime health

PASS. `metrics.json` reports `"ok": true`, the captured page errors array is empty, and `console.log` has no `pageerror` or `[fatal]` lines from game code. The log only shows benign auth/resource conflict noise and the debug scenario application. The full test run in `coverage.log` passed: 38 files, 1148 tests.

Note: the round-3 capture metadata references screenshots, but no `.png` screenshot artifacts are present in the round-3 directory. The capture still provides a clean running-game proof through metrics, probes, and logs.

## Acceptance criteria findings

PASS: `generateLayout({ stage: "spire-ascent" })` is supported by the object-argument API and returns a `stage: "spire-ascent"` layout distinct from the default grid. The `spire_ascent` quest also routes through `layoutStage: "spire-ascent"`.

PASS: The generated layout contains 3-5 distinct tier rooms. Representative seeds independently probed during review produced 3, 4, and 5 tiers, all with strictly increasing sampled floor Y.

PASS: Tier platforms are room-sized, flat, and stacked upward along +Z. Each room has uniform `floorCorners` at its tier elevation, with `role` metadata assigning bottom/start, middle/combat, and top/treasure.

PASS: Ramp passages use sloped `floorCorners` through `buildRampPassage()`. The generated spire ramps have `avgSlope` 0.2, matching the required minimum, and sampled floor Y interpolates across the ramp slab.

PASS: Total Y gain from spawn tier to summit tier is at least 10 units. Probed seeds yielded top gains of 10.0, 10.2, and 10.4.

PASS: Outer-edge containment is implemented with tier perimeter wall segments and ramp side walls. Room wall gaps are only opened where ramps connect, and ramp wall colliders are included in both server and client collider generation.

PASS: The objective endpoint for normal gameplay is on the final tier. The `spire_ascent` quest is a defeat-enemies objective, and the normal enemy spawn path reserves one enemy spawn for the highest treasure tier while distributing remaining enemies across combat tiers.

PASS: Normal path reachability is covered by the linear ramp graph and tests for BFS reachability/no orphan tier. `sampleFloorY()` covers both rooms and ramp passages, and server movement updates player Y while walking along spire ramps.

PASS: Camera follow and elevated rendering are wired to vertical movement. The renderer samples floor Y for the local player mesh, places enemies/health bars/telegraphs on sampled floor Y, and follows the rendered player position including Y. The provided capture did not exercise a spire-specific screenshot, but the runtime was clean and the code/test coverage supports the vertical path.

PASS: Determinism is covered by generator tests and by the seeded layout implementation.

PASS: Unit tests cover the required structural invariants: tier count range, monotonic Y, reachability from spawn, no orphan tier, object-stage API, ramp sampling, elevated room/ramp rendering, and spire ramp player movement.

## Design and foundation consistency

PASS. The implementation matches the design document's floor geometry model: `floorCorners` define walkable height, shared floor sampling lives in `shared/floorSampling.esm.js`, and the stage is exposed as `spire-ascent`. The basic requirements are preserved: the game renders, connects client/server, supports multiplayer state, and movement synchronization remains intact.

## Debug scenario findings

FAIL. The ticket adds `spire-ramp-passage` and `spire-summit-combat` debug scenarios, but they do not fully represent an equivalent normal `spire_ascent` quest state. In `applyDebugScenario()`, `spire-summit-combat` calls `applyLayoutForQuest(state, 'spire_ascent')` before entering play, but it does not update `state.selectedQuestId`; `spire-ramp-passage` swaps in a spire layout after `enterPlayingPhase()` has already spawned enemies and created the run for the current/default quest. As a result, a QA shortcut can show spire geometry while the run objective, quest metadata, and enemy setup still belong to `training_caverns` or whichever quest was previously selected. Under the debug-scenario rules, this is a blocking gap because the shortcut is not an equivalent state reachable through normal gameplay and can mask regressions in the real quest flow.

## Remaining gaps

1. The new spire debug scenarios must set up the same quest/run state as normal `spire_ascent` gameplay before moving the player to the ramp or summit.

VERDICT: FAIL
