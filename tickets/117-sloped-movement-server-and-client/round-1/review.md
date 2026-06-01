# Senior Review — 117 Sloped Movement (Server and Client)

## Runtime health (gating check)
- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure` block.
- `console.log`: only benign noise — a 409 resource conflict (pre-existing, unrelated),
  Vite connect lines, and `[debugScenario] applied sloped-dungeon`. No `pageerror`,
  no `[fatal]`, no uncaught exceptions from game code.
- Screenshots `01-initial-position.png` / `02-after-movement.png` render the
  `sloped-dungeon` scenario cleanly: avatar present, player moved (z 9 → -15.6),
  combat resolving (`-10` damage popup, HP 100 → 90). Game starts and plays.

The captured run is valid proof the game runs.

## Per-criterion findings

1. **Server `move` handler sets `player.y` from `sampleFloorY` after a valid move** — MET.
   Movement is intent-based: `socket.on('move')` (index.js:1246) only stores
   `inputDx/inputDz`; the authoritative per-tick `applyPlayerMovement()`
   (simulation.js:302-307) resolves the horizontal move via `tryPlayerMove` then
   sets `player.y = Number.isFinite(floorY) ? floorY : DEFAULT_FLOOR_Y`.

2. **Client local avatar Y matches the sampled floor (same helper as server)** — MET.
   renderer.js:2425-2428 samples `sampleFloorY(layout, myX, myZ) ?? DEFAULT_FLOOR_Y`.
   Both client (`collision.js` → `shared/floorSampling.esm.js`) and server
   (`dungeon.js` → `shared/floorSampling.js` CJS bridge) load the **same canonical
   source**, so no flat-ground drift is possible.

3. **`stateUpdate` snapshots include `y`; remote avatars render at correct height** — MET.
   `stateSnapshot()` (progression.js:2821) serializes `y: p.y`. Remote avatars
   render at `pData.y` (renderer.js:2407), local avatar at the sampled floor.

4. **Walking flat → sloped changes `y` smoothly (no >0.5 single-tick teleport)** — MET.
   Horizontal step is `MOVE_SPEED/TICK_RATE = 0.6`/tick. On the test ramp
   (0.5→2.0 over depth 12, gradient 0.125/unit) the max per-tick Y change is
   ~0.075 — well under 0.5. No clamping needed; bilinear interpolation is continuous.

5. **Existing wall collision / `isInsideDungeon` / swept collision still pass** — MET.
   Full server suite: **815/815 tests pass**. A new slope-specific wall-slide
   regression test confirms sliding still works on a sloped room.

6. **Integration/socket test across a ramp asserting directional `y` change** — MET.
   `applyPlayerMovement.test.js` "sets player.y from sampleFloorY when moving on a
   ramp" drives the player south into a sloped room and asserts `y > 0.5` and
   `y ≈ sampleFloorY(...)`. Plus a null-fallback test and the wall-slide test.

7. **Spawn / reset / return-to-lobby place players on valid floor height** — MET.
   All reset paths resample: `assignRunSpawnPositions`, `repositionPlayersAwayFromPortal`,
   `suspendRunToLobby`, `abandonSuspendedRun`, `returnPlayersToLobby`, `giveUpRun`
   (progression.js) and the debug-scenario spawn (index.js:557). `buildPlayerRecord`
   defaults to `DEFAULT_FLOOR_Y` when no saved `y` exists.

## Design / regression consistency
- Server remains authoritative for Y (client sends no `y`), matching the
  Implementation Notes. Shared sampling module keeps client prediction and server
  authority in lockstep. No regression to `requirements.md` foundations.
- This ticket added **no** debug scenario — `sloped-dungeon` came from dependency
  116 — so the DEBUG SCENARIOS gate does not apply.

## Remaining gaps
None. All acceptance criteria are fully and robustly met, the game runs cleanly,
and the full server test suite passes.

VERDICT: PASS
