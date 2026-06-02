## Runtime health

The captured run does not prove a playable game. `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`, and `console.log` shows the browser could not complete auth because `/api/register` and `/api/login` returned 502s. `pageerrors.json` is empty and there are no `pageerror` or `[fatal]` console lines from game code, but the harness never reached an in-game state and no screenshot files are present in the round folder.

This alone blocks the ticket: a top-level stage cannot pass without a clean captured load.

## Acceptance Criteria

- New stage selectable from `generateLayout({ stage: "sunken-canyon" })`: satisfied in code. `generateLayout()` dispatches to `generateSunkenCanyonLayout()`, and `sunken_canyon_trial` selects `layoutStage: 'sunken-canyon'`.
- Exactly two elevation bands with small upper plateau and large lower canyon floor: satisfied by generator tests and code. Plateau/canyon rooms are tagged distinctly; the canyon area is constrained to at least `4 * MIN_ROOM_SIZE^2`.
- 2-3 descending ramp paths using `floorCorners`, slope >= 0.15, no cliff-only drop: mostly satisfied. Ramps use `createRampRoom()`, carry non-uniform `floorCorners`, and are checked for reachability through walkable AABBs.
- Total Y drop >= 8 units: satisfied in code with plateau Y 10 and canyon Y 2.
- Outer walls enclose both bands: covered by perimeter tests and generated edge walls with ramp gaps only where connections exist.
- Camera follows both bands/ramps and plateau vista is clear: code updates follow camera from sampled player Y, and tests cover ramp Y plus plateau sightline. This still lacks live visual proof because the capture failed.
- Enemy spawns distributed with at least one plateau enemy and a canyon majority: not robustly satisfied. The spawn planner chooses plateau/canyon X/Z bands, but `spawnEnemy()` does not set an enemy Y from `sampleFloorY()`, and the renderer draws enemies, hitboxes, lock-on rings, and telegraphs at fixed legacy ground heights. A plateau enemy is therefore not actually represented on the plateau band in state or visuals.
- Objective / exit on canyon floor, reachable on foot: mostly satisfied for the current game model. The sunken-canyon room is the treasure role and the defeat-enemies objective places the majority of enemies in the canyon; reachability from plateau spawn to canyon treasure is covered. There is no separate exit mechanic in the current foundation.
- Deterministic given a seed: satisfied by generator and cover scatter tests.
- Unit tests cover two bands, ramp connectivity, Y drop, slope bounds, reachability: satisfied. Coverage log shows 36 test files and 1069 tests passing; sunken-canyon tests cover ramp count, cover scatter, spawn placement, sightline, and reachability.

## Design and Requirements Consistency

The implementation aligns with the floor-geometry design in `game/docs/design.md`: it relies on `floorCorners` and `sampleFloorY()` for ramps and player floor height. It does not intentionally regress the base setup requirements around 3D rendering, server-client architecture, multiplayer visualization, or movement sync, but the captured run failed before those requirements could be validated live.

## Debug Scenario Review

The added `?debugScenario=sunken-canyon` path is debug-gated: the browser only requests it from localhost-style hosts, and the server rejects debug scenarios in production unless explicitly enabled. The normal path is still present through selecting `sunken_canyon_trial`, which applies the same `layoutStage: 'sunken-canyon'` during normal quest selection and deploy. The debug shortcut does not bypass persistence or card validation beyond the existing debug-scenario pattern, but it shares the same enemy-height defect as the normal path.

## Remaining gaps

1. Captured run failed before gameplay: `metrics.json` has `"ok": false` / `failure_kind: "capture_failed"`, and Vite logged 502s for `/api/register` and `/api/login` due `ECONNREFUSED`. Without a clean captured load, there is no runnable proof for the top-level ticket.

2. Sunken-canyon enemies are not placed/rendered at their sampled floor height. `spawnEnemy()` stores only X/Z, while the client renders enemies and their ground indicators at fixed legacy Y values, so the required plateau enemy appears below the upper band instead of on it.

VERDICT: FAIL
