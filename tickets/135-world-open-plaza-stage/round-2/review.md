# Senior Review: Open Plaza Stage

## Runtime health

The captured game run is clean. `metrics.json` reports `"ok": true`, the servers started, `pageerrors` is empty, and `console.log` contains no `pageerror` or `[fatal]` lines from game code. The observed 409 resource lines are non-fatal request conflicts, and the client log only shows benign THREE/Vite close-time noise.

Coverage visibility is also healthy: `coverage.log` reports `38` test files passed and `1128` tests passed.

## Acceptance Criteria

- New stage variant selectable from `generateLayout(..., "open-plaza")`: satisfied. `game/server/dungeon.js` adds a dedicated `open-plaza` branch and `game/server/quests.js` exposes it through the normal `arena_trials` quest.
- Single large walkable plaza bounded by outer walls: satisfied. The stage builds one `32 x 32` room, empty passages, four solid perimeter walls, and `profile: "open-plaza"`, comfortably above the 4x default-room area target.
- At least six freestanding cover pieces that respect collision and traversability: satisfied. The layout targets eight cover pieces, keeps them inside the perimeter and out of the spawn-clear zone, rejects overlaps, flood-fills the plaza to avoid partitioning, and adds matching server/client AABB colliders.
- At least two cover pieces on gently sloped platforms: satisfied. Two platform-centered pillars are created, the platforms carry `floorCorners`, and tests enforce a max corner-height delta of `0.5`.
- Deterministic given a seed: satisfied. Plaza generation uses the seeded PRNG for candidate ordering, and tests assert deep equality for repeated seeds plus deterministic spawn sampling.
- Spawn placement keeps party members on the plaza floor: satisfied. Normal quest selection applies the `open-plaza` layout, run spawn offsets land in the clear center area, and `sampleFloorY()` sets the player Y on the plaza floor.
- Enemy spawn and objective placement still work with no room list: satisfied. Single-room/no-combat-role layouts route enemies, crystals, and loot through `pickFloorSpawnPosition()`, which is seeded and rejects wall/cover collisions. The `arena_trials` normal run path uses this same flow.
- Unit tests cover shape, slope bounds, and cover reachability: satisfied. `game/server/test/dungeon.test.js` covers the open-plaza shape, area, cover count, platform slope delta, cover-on-platform placement, reachability, determinism, and cover colliders; `game/server/test/arena_spawn_cover.test.js` covers cover-aware enemy/objective/loot placement.

## Design and regression check

The implementation fits the design doc's procedural dungeon model and sloped-floor system. It preserves the existing lobby/deploy/dungeon loop, adds the plaza as a selectable quest rather than replacing the default dungeon, and does not regress the foundation requirements: the captured run rendered, connected to the server, showed multiplayer state, and handled movement.

## Debug scenarios

The new `open-plaza-arena` debug scenario is appropriately gated through the existing `debugScenario` socket path and local/dev allowance checks. It is only a QA shortcut: the same end state is reachable through normal play by selecting `arena_trials` in the quest board and deploying, and it uses the same `applyLayoutForQuest()` and `spawnEnemies()` placement path as the normal quest.

## Remaining gaps

None.

VERDICT: PASS
