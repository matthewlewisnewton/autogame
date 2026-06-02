## Runtime health

The captured run is not valid proof that the game starts and loads cleanly. `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`, and the requested `console.log` is absent. The dev server logs show Vite and the Node server reached their ready/listening states, but `screenshot.log` shows the browser capture failed before page inspection:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright' imported from /home/matt/workspace/.autogame-worktrees/135-world-open-plaza-stage/harness/screenshot.mjs
```

Because the top-level gate requires a clean captured run before passing, this is a blocking runtime-proof gap even though it appears to be a harness dependency problem rather than a game-code crash.

## Acceptance criteria findings

- New stage variant selectable from `generateLayout({ stage: "open-plaza" })` or equivalent: Met. The live implementation supports `generateLayout(seed, "open-plaza")`, exposes `generateOpenPlaza()`, and wires `open_plaza_trial` through quest profile selection.
- Single large bounded walkable polygon: Met in code. The plaza is a single `40x40` room, well above the 4x default-room area bound, with four continuous outer walls and no passages.
- At least 6 scattered cover pieces that respect collision and traversability: Met in code. The generator targets 8 pieces, enforces minimum count in tests across seeds, keeps pieces inside the perimeter, adds server and client cover colliders, and rejects placements that disconnect the free floor.
- At least 2 gently sloped platforms with max corner-height delta around 0.5: Met in code. The first two accepted cover pieces receive `floorCorners` with a 0.5 height delta, and the client renders sloped platform patches for cover carrying `floorCorners`.
- Deterministic given seed: Met in code. Layout and cover generation use the seeded PRNG and are covered by deterministic tests.
- Spawn placement on plaza floor and not inside cover/slope edge: Met in code. The single room is role `start`, cover avoids a spawn clearance around the origin, server spawn nudging is defensive, and tests assert spawn clearance against cover colliders.
- Existing enemy spawn/objective placement still works: Met in code. `open_plaza_trial` is a normal `defeat_enemies` quest, role-based spawn helpers fall back to the only plaza room when combat/treasure rooms are absent, and quest selection regenerates bounds/walkable AABBs.
- Unit tests cover shape, slope bounds, and cover reachability: Met. `coverage.log` reports all 34 test files and 1061 tests passed, including focused open-plaza tests for shape, bounds, deterministic cover, slope deltas, cover colliders, and free-floor reachability.

## Design and regression check

The implementation is consistent with the design document's procedural dungeon and floor-corner slope model. It preserves the existing rooms-and-passages profiles, keeps the default quest on `training_caverns`, and adds the plaza as an additional selectable quest/stage rather than replacing normal dungeon generation.

The foundation requirements are not contradicted by the code changes: rendering, client/server state, movement synchronization, and multiplayer state paths still use the existing layout payload and collision systems. However, the captured run did not reach browser validation, so this cannot be accepted as proven.

## Debug scenarios

The ticket adds an `open-plaza-stage` debug scenario. It is gated through the existing debug-scenario socket path, which checks `isDebugScenarioAllowed(socket)`, and normal gameplay reaches the same stage through selecting the `open_plaza_trial` quest and deploying. The scenario regenerates the layout and colliders through the same layout functions; it does not appear to weaken server validation or normal quest selection invariants.

## Remaining gaps

1. The captured run failed before browser validation, so there is no clean `metrics.json`/`console.log` proof that the game loads with this ticket applied.

VERDICT: FAIL
