# Senior Review: Sunken Canyon Stage

## Per-Criterion Findings

### Runtime health

Blocking failure. The captured run is not clean: `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`. `pageerrors.json` is empty and `console.log` has no `pageerror` or `[fatal]` entries from game code, but the browser never reached a playable lobby because Vite returned 502s for `/api/register` and `/api/login`, then the capture timed out waiting for the lobby UI. Per the ticket review rules, a non-clean captured run is an automatic fail even when the code review looks sound.

The logs point to an auth proxy/backend port mismatch during capture rather than a sunken-canyon module crash: `server.log` shows the backend listening on port `3002`, while the client log shows ECONNREFUSED proxy errors for auth calls. The live `game/client/vite.config.js` already contains harness-port proxy support, so the next step is to produce a fresh capture where the client and backend are wired to the same port and `metrics.json` is clean.

### Stage selection and determinism

Satisfied by code and tests. `generateLayout(seed, 'sunken-canyon')` dispatches to the new generator, the `sunken_canyon` quest selects `layoutProfile: 'sunken-canyon'`, and the unit tests assert deterministic layout/cover generation for fixed seeds.

### Elevation bands, canyon size, and descent

Satisfied by code and tests. The generator creates one plateau room, one canyon room, and 2-3 sloped ramp rooms. The plateau is room-sized, the canyon floor is `32 x 32` units, and the plateau/canyon floor corners create a `9` unit Y drop. Dedicated tests cover the ramp count, floor-corner descent, average slope bound, canyon area, and BFS connectivity from plateau to canyon.

### Reachability and enclosure

Satisfied by code and tests. The plateau/ramp/canyon footprints touch at the ramp mouths, ramp rooms use `floorCorners`, and the outer plateau/canyon edges are walled except for ramp-aligned gaps. Tests cover perimeter wall closure and reachability from the plateau to the canyon objective room.

### Spawns, objective, and exit placement

Satisfied by code and tests. The `sunken_canyon` quest is available in the quest list, player spawn is placed on the plateau, enemy spawning reserves at least one plateau enemy while putting the majority in the canyon, ramps receive no combat spawns, and treasure/objective placement targets the canyon room. The dedicated `sunken_canyon_spawn.test.js` coverage validates these behaviors.

### Camera and plateau vista

Code-level checks look satisfied, but visual proof is missing because the capture failed before gameplay. The client now bases camera orbit Y on sampled player floor Y, including plateau and ramp positions, and the plateau's canyon-facing edge uses low parapet walls so the canyon remains visible from the high ground. The client tests cover elevated camera Y and parapet wall rendering.

### Debug scenarios

Satisfied. The ticket added `sunken-canyon-stage` and `sunken-canyon-floor` shortcuts. They are only invoked through the debug-scenario path (`?debugScenario=...` or the test hook), the client restricts URL-driven requests to localhost, and the server rejects debug scenarios outside dev/local access unless explicitly enabled. The same states are reachable through normal play by selecting the `sunken_canyon` quest and descending the ramps; the scenarios use normal layout application and enemy spawning rather than replacing server-side validation or persistence paths.

### Tests and coverage

The provided `coverage.log` reports `38` test files passed and `1095` tests passed. Coverage includes the new layout, spawn/objective, collision, rendering, and camera tests relevant to this ticket.

## Remaining gaps

1. The captured game run did not load cleanly. `metrics.json` is `"ok": false`, auth API calls returned 502/ECONNREFUSED, and the capture timed out before reaching the lobby or any sunken-canyon screenshot.

VERDICT: FAIL
