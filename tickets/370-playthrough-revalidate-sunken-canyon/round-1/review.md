# Senior Review: 370-playthrough-revalidate-sunken-canyon

## Runtime Health

The captured browser run for this review is healthy. `metrics.json` is present with `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains no `pageerror` or `[fatal]` entries from game code; the single 409 resource line is not an uncaught page error.

The dedicated Sunken Canyon playthrough artifacts in `game/validation/sunken-canyon` also report `"ok": true`, include the expected screenshots, and `findings.md` records no console/page errors.

## Acceptance Criteria Findings

### Re-validate the Sunken Canyon level geometry and floor alignment

Satisfied by the dedicated validation artifacts. `run-summary.json` records `layoutProfile: "sunken-canyon"` with zero floor deltas at level entry, mid combat, dormant boss, and active boss probes. The screenshots show the multi-band canyon spaces rendering without obvious floor separation or player placement issues.

### Exercise and defeat the stage boss

Satisfied. The Sunken Canyon run uses `canyon_descent` Tier 2, reaches the dormant and active Canyon Warden encounter, shows the boss HUD, verifies the boss is visually distinct from a grunt add, defeats the boss, and reaches the Sortie Complete/victory state.

### Exercise new combat interactions

Satisfied by probes and screenshots. The run verifies slow then burn on the same target with mutual exclusivity, Purifying Pulse healing and clearing statuses, and Corebreaker Greatsword wind-up input lock plus telegraph visibility.

### Verify telepipe vitals persistence and new-sortie card-charge reset

Satisfied by the dedicated Sunken Canyon validation output and independently supported by this round's clean telepipe suspend/resume capture. The Sunken Canyon artifact records `telepipeVitalsPreserved: true` and `cardChargesResetOnNewSortie: true`; the round metrics also show a successful suspend/resume path with preserved checkpoint enemies, objective state, layout seed/profile, and no lingering suspended run status after restore.

### Capture screenshots and findings

Satisfied. `game/validation/sunken-canyon` contains the required stage, boss, card interaction, and telepipe screenshots plus `findings.md`, `probes.json`, `run-summary.json`, and logs. `findings.md` documents a PASS and does not hide any observed validation bug.

### Debug scenario review

The new/changed scenarios are reached through the debug scenario path only, and the client URL shortcut is localhost-gated. The server-side scenario handlers are gated by the existing debug scenario socket allowance, and the new Sunken Canyon shortcuts are documented as shortcuts to states reachable by normal quest unlock, deployment, traversal, boss trigger entry, card acquisition, and telepipe purchase flows.

The shortcuts do mutate state for QA determinism, but they do not replace the normal gameplay flow being validated: the playthrough still drives socket card use, combat resolution, encounter activation, victory checks, telepipe extraction, abandon/redeploy, and server state snapshots. I did not find a debug shortcut that normal gameplay depends on.

### Design and requirements consistency

The implementation aligns with the design document's dungeon, boss, card-combat, and telepipe concepts. The captured and dedicated runs preserve the foundation requirements: Three.js rendering, client/server connection, player visualization, and synchronized movement/combat state all remain operational.

### Code quality and tests

Blocking gap: the provided coverage run did not pass. `coverage.log` reports `3 failed | 2051 passed (2054)`, with failures in:

- `server/test/card_windup_resolution.test.js`: `soul_drain` no longer enters `cardUseState: "windup"` after `useCard`.
- `server/test/debug-scenarios.test.js`: `arena-trials-tier-2` emits a `stateUpdate` without `run`, causing `stateUpdate.run.questId` to throw.
- `server/test/persistence_save_triggers.test.js`: batched movement persistence expected one `savePlayer` call after `runGameLoopTick()` but got zero.

Because the top-level ticket explicitly asks for harness checks and vitest server/client verification, a failing supplied test run is a blocking quality gap even though the visual playthrough itself is green.

## Remaining gaps

1. The vitest coverage run is red: `coverage.log` reports three failed server tests. The implementation should not pass the top-level gate until `pnpm test` or the equivalent coverage command completes without failed tests.

VERDICT: FAIL
