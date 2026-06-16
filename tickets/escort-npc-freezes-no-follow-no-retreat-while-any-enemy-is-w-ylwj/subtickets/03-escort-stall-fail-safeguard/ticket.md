# Escort stall fail-safeguard: end run when escort cannot reach destination

Add a timeout so an escort objective cannot soft-lock indefinitely when the escort is stuck short of the destination while the squad is already waiting at the extraction point. This covers edge cases (crowded `annex_escort` geometry, unreachable enemies still pinning the escort) that proximity/threat fixes alone might not resolve.

## Acceptance Criteria

- While `run.status === 'playing'` and `run.escort` is active, if the escort has **not** reached the destination (`isEscortAtDestination` false) but at least one living squad member has been within `ESCORT_DESTINATION_RADIUS` of the escort destination for a continuous stall window, the run fails with a clear objective label (e.g. `Archivist Vale failed to reach extraction — escort stalled`).
- The stall window is configurable (constant in `game/server/escort.js` or `game/server/config.js`, e.g. `ESCORT_STALL_FAIL_MS = 45000`). Progress resets if the escort moves closer to the destination (distance to destination decreases) or a squad member leaves the destination wait zone.
- Stall failure reuses existing escort fail plumbing (`failEscortRun` / `checkRunTerminalState`) so `run.status` becomes `'failed'`, `run.escort.failed` is true, and `buildRunSummary('failed')` carries a distinct `failReason`.
- A new test in `game/server/test/escort_objective.test.js` simulates: player on dais, escort pinned short of destination (mock by zeroing follow speed or placing escort behind a blocker the test controls), advance simulated time past `ESCORT_STALL_FAIL_MS` via `tickEscort` + manual timestamp fields, assert run fails with the stall message — without requiring the threat-aware follow bug to be reintroduced.
- Sub-ticket 01 regression and sub-ticket 02 threat tests still pass.
- `pnpm test` passes.

## Technical Specs

- **`game/server/escort.js`**:
  - Add `ESCORT_STALL_FAIL_MS` constant (45_000 ms default) and export it for tests.
  - Extend `run.escort` state on spawn (`spawnEscortNpc`) with stall-tracking fields: e.g. `stallWaitStartedAt` (null when not waiting), `lastDistToDestination` (number).
  - In `tickEscort(gameState)`: after destination check, if a living non-extracted player is within `ESCORT_DESTINATION_RADIUS` of `run.escort.destination` and escort is not at destination, start/update stall timer; if `simNow() - stallWaitStartedAt >= ESCORT_STALL_FAIL_MS`, call `failEscortRun` with the stall label. Reset `stallWaitStartedAt` when no player is in the wait zone or when escort distance to destination improves by at least a small epsilon (e.g. 0.5 units).
  - Use `Date.now()` or the same scaled clock `tickEscort` already relies on via the game loop — match whatever `updateMinions` / `tickEscort` use elsewhere (import `simNow` from simulation if needed, or pass `now` from the tick caller in `index.js`).
- **`game/server/index.js`**: Ensure `tickEscort` is still invoked each playing tick (already wired — verify no change needed beyond stall fields flowing through state snapshots).
- **`game/server/test/escort_objective.test.js`**: Add `escort stall fail safeguard` test with a shortened stall constant (override via test-only export or inject a smaller `ESCORT_STALL_FAIL_MS` for the test harness). Assert `run.status === 'failed'` and summary `failReason` contains `stalled` or equivalent.

## Verification: code
