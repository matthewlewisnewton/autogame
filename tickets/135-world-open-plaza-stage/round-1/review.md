# Senior Review: Open Plaza Stage

## Runtime health

PASS for the required startup gate. `metrics.json` reports `"ok": true`, no harness startup failure, and an empty `pageerrors` array. `console.log` contains Vite connection lines, two 409 resource responses, scene initialization, and a debug scenario success log, but no `pageerror` or `[fatal]` entries from game code.

The capture did not include the referenced screenshot image files in `round-1`, and the fallback capture exercised the existing `sloped-dungeon` debug scenario rather than the new `open-plaza-arena` scenario or the `arena_trials` normal quest path. That limits visual evidence for this top-level ticket, but the game itself did load cleanly.

## Per-criterion findings

- Stage selection: PASS. `generateLayout(seed, 'open-plaza')` is implemented as the project-equivalent stage/profile key, and `arena_trials` wires normal gameplay to `layoutProfile: 'open-plaza'`.
- Plaza shape and bounds: PASS. The open-plaza generator returns one `start` room, empty passages, a 32 x 32 walkable plaza, flat room `floorCorners`, and four perimeter walls.
- Cover and traversability: PASS for the generated layout. The layout produces eight cover pieces, keeps them within the plaza and outside the spawn-clear zone, includes cover colliders on server and client, and has flood-fill tests that verify cover does not split the plaza.
- Sloped platforms: PASS. Two platform records are generated with corner-height deltas no greater than 0.5, and at least two cover pieces sit on platforms. `sampleFloorY()` checks platforms before rooms, and client rendering reuses the sloped-floor builder.
- Determinism: PASS for layout generation. Same seed yields deep-equal open-plaza layout output.
- Party spawn placement: PASS. Run spawn offsets are near the plaza center, away from cover and platform edges, and `assignRunSpawnPositions()` samples floor height.
- Enemy/objective placement: FAIL. The normal `arena_trials` run has no combat or treasure rooms because the only room is `start`; `pickEnemySpawnPosition()` then falls through to `randomRoomPosition()`, which uses unseeded `Math.random()` and does not reject wall/cover colliders. Because open-plaza cover is now solid, enemies and incidental loot can be placed inside pillars or broken walls, making the defeat objective intermittently unreliable and violating the "existing enemy spawn / objective placement code still works" acceptance criterion.
- Debug scenario safety: PASS. `open-plaza-arena` is only reachable through the existing debug scenario socket path, which is gated to local/non-production or explicit `ALLOW_DEBUG_SCENARIOS=1`. The same arena state is reachable through normal gameplay by selecting `arena_trials`, and the shortcut reuses `applyLayoutForQuest()` rather than inventing a separate layout path.
- Design and foundation consistency: PASS aside from the spawn-placement gap. The change matches the dungeon/sloped-floor design and does not regress the basic 3D render, socket, multiplayer, or movement requirements.
- Tests and coverage: PARTIAL. The server/client unit tests cover open-plaza shape, platform slope bounds, cover reachability, determinism, platform sampling, cover rendering, and cover colliders. Coverage logs show the relevant suites passing, but there is no test that starts an `arena_trials` run and proves enemy/objective/loot placement avoids solid cover.

## Remaining gaps

1. Open-plaza enemy/objective placement can choose positions inside solid cover because the single-room no-combat-room fallback uses the old random room helper instead of a cover-aware spawn helper.

VERDICT: FAIL
