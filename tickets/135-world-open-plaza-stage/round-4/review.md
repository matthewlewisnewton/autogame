## Runtime health

The captured game run is healthy. `metrics.json` reports `ok: true`, includes no `harness_failure`, and has an empty `pageerrors` array. `console.log` contains only Vite/debug output plus non-fatal resource conflicts; there are no `pageerror` or `[fatal]` entries from game code. The screenshots show the lobby, normal dungeon gameplay, and the fallback sloped-dungeon scenario loading cleanly.

## Acceptance criteria

- New stage variant selectable from `generateLayout`: Met. `game/server/dungeon.js` adds the `open-plaza` profile branch, and `game/server/quests.js` exposes it through the `open_plaza_trial` quest. The lobby screenshot also shows Plaza Trial as a selectable contract.
- Single walkable polygon at least 4x normal room area and bounded by outer walls: Met. The generator creates one 40x40 plaza room with four full-length perimeter walls and no passages, comfortably above the 900 sq-unit bound implied by the default max room size.
- At least 6 freestanding cover pieces without breaking traversability: Met. The generator targets 8 pieces, enforces wall/spawn/platform spacing, and guards free-floor connectivity with `plazaFreeFloorConnected()`. Server and client colliders include the cover footprints.
- At least 2 cover pieces on gentle sloped platforms: Met. The first two accepted cover pieces receive platform footprints with a 0.5-unit corner-height delta, and `sampleFloorY()` samples those platform surfaces before the flat plaza floor.
- Deterministic by seed: Met. The open-plaza layout and cover placement are driven by `mulberry32(seed)` and covered by deep-equality tests for same-seed output.
- Party spawn placement stays on plaza floor and out of cover/slope edges: Met. The start point is kept clear of cover/platforms, quest selection reassigns run spawns on the updated layout, and cover-aware nudging prevents placements inside cover.
- Existing enemy spawn/objective placement still works: Met. The normal quest path uses `open_plaza_trial`, falls back from missing combat/treasure rooms to the single plaza room, and cover-aware sampling is applied to enemies, crystals, and loot.
- Unit test coverage: Met. The coverage run passed 37 files / 1135 tests, including generator shape, slope bounds, connectivity, cover-aware spawning, and client render/collider coverage.

## Design and regression review

The feature remains consistent with the design doc's procedural dungeon and sloped-floor model: `floorCorners` remains the floor-height contract, and platform sampling is shared through `game/shared/floorSampling.esm.js` for client/server consistency. The foundation requirements are preserved: the captured run renders a 3D scene, connects via WebSockets, shows multiplayer lobby/game state, and accepts movement.

The added `open-plaza-stage` debug scenario is appropriately gated behind the existing debugScenario socket path and local/dev allowance. Its end state is also reachable through normal gameplay by selecting `open_plaza_trial` and deploying; the debug shortcut sets that quest/layout before entering play, so enemy spawning, objective creation, layout replication, and collision rebuilds use the normal path rather than bypassing core invariants.

## Remaining gaps

None.

VERDICT: PASS
