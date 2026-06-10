## Per-Criterion Findings

### Runtime health
PASS. The captured run is valid: `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only Vite connection messages, Three.js scene initialization, and booth ready-up logs; there are no `pageerror` or `[fatal]` lines from game code. `client.log` only shows allowed Three.js deprecation and Vite websocket close noise, and `server.log` shows normal startup, two connections, disconnects, and SIGTERM shutdown.

### Independent altitude + flying flag
PARTIAL. The current enemy/minion paths have the expected data model. `resolveEntityY(entity, layout)` is generic and returns floor height for grounded entities or `floorY + altitude` for `flying` entities, `ember_wraith` instances inherit `flying: true` and `altitude: 2.5`, and storm eagle / thunderbird minions are stamped with `flying` plus positive altitude on summon.

The gap is player generality. The top-level ticket explicitly requires the feature to remain reusable by a future player fly/hover card. Server movement can call `resolveEntityY(player, layout)`, but player snapshots do not expose `flying` or `altitude`, the local player render path still samples the floor and sets `playersMeshes[myId]` to that floor height, and there is no player shadow path. A future card setting `player.flying = true` would not render the local player airborne and would not have the same client-side visual treatment as enemies/minions.

### Movement, positioning, ground snapping, and targeting
PASS for current airborne enemies/minions. Enemy and minion AI keep using planar X/Z movement and targeting, then resolve `y` after each tick, so fliers stay targetable while avoiding floor snapping. Grounded enemies and minions continue to resolve to the sampled floor on the server. The current behavior is consistent with the design document's floor sampling model and does not regress the base server/client movement requirements.

PARTIAL for future player support. The player movement helper now uses `resolveEntityY(player, layout)`, which is the right server-side primitive. However, the snapshot/render gap above means the end-to-end player entity path is not yet reusable.

### Client render + ground shadow
PASS for current airborne enemies/minions. `renderer.js` renders flying enemies and minions at a floor-aware offset, keeps health/shield bars and hit sparks at the airborne body height, and creates/disposes ground shadows for both enemy and minion maps. The floor-aware tests cover raised-floor offsets, shadow placement, and grounded-entity non-regression.

FAIL for the required symmetric entity model. The player render path remains special-cased: remote players use `pData.y || 0.5`, while the local player ignores snapshot `y` and snaps to `sampleFloorY(layout, myX, myZ)`. No player shadow is available.

### Tests and coverage
PASS. `coverage.log` reports 66 test files passed and 1460 tests passed. New focused tests cover the generic server altitude helper, airborne `ember_wraith`, aerial minions, client floor-aware render offsets, shadows, and grounded non-regression.

### Debug scenarios
PASS. This ticket did not add or change a `?debugScenario=NAME` shortcut, so there is no debug-scenario gating or normal-path reachability issue to review.

## Remaining gaps

1. Player airborne support is not end-to-end reusable even though the ticket required a symmetric/general entity model for a future player fly/hover card. The player snapshot omits `flying`/`altitude`, the local player renderer still floor-snaps from `sampleFloorY`, and no player ground shadow path exists. Current flying enemies and minions work, but the whole ticket is not complete because the player entity path remains hard-coded separately.

VERDICT: FAIL
