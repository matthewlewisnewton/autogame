# Boss-low-HP debug scenarios: stateUpdate sync

The `training-caverns-boss-low-hp` and `spire-ascent-boss-low-hp` harness tests fail
because they register a `stateUpdate` listener in parallel with emitting the scenario,
so the first captured snapshot can be a periodic game-loop update showing the boss at
full base HP (320 / 420) even though `setupQuestBossLowHp` already pinned authoritative
`boss.hp` to 1. Align these two tests with the established arena-trials and
canyon-descent pattern: await `debugScenarioResult` first, then read boss HP from a
subsequent `stateUpdate`.

## Acceptance Criteria

- `debug-scenarios.test.js` test **positions annex_overseer at 1 HP beside the player in
  playing phase** passes: authoritative `testGameState()` boss has `hp === 1` and a
  `stateUpdate` captured **after** `debugScenarioResult` resolves reports
  `annex_overseer` at `hp === 1`.
- `debug-scenarios.test.js` test **positions spire_warden at 1 HP beside the player in
  playing phase** passes with the same contract for `spire_warden` at `hp === 1`.
- Neither test registers `stateUpdate` in parallel with `socket.emit('debugScenario', …)`
  for the boss-low-hp step; both follow the post-result capture pattern already used by
  `arena-trials-boss-low-hp` and `canyon-descent-boss-low-hp` (including the explanatory
  comment about periodic `stateUpdate` races).
- `cd game && pnpm test:quick` passes with zero failures in
  `server/test/debug-scenarios.test.js`.
- No changes to Reaper's Scythe client renderer code or card animation behavior.

## Technical Specs

- **`game/server/test/debug-scenarios.test.js`**:
  - In **positions annex_overseer at 1 HP beside the player in playing phase** (~855–888):
    remove the parallel `stateUpdatePromise` registered before emit; `await lowHpPromise`
    first, then `const stateUpdate = await waitForEvent(socket, 'stateUpdate')`; keep
    existing authoritative-state assertions (`boss.hp`, distance checks) unchanged.
  - In **positions spire_warden at 1 HP beside the player in playing phase** (~1722–1755):
    apply the same restructuring.
  - Copy the race-comment block from the canyon-descent or arena-trials boss-low-hp test
    so future edits understand why post-result capture is required.
- **`game/server/debugScenarios.js`** (only if tests still flake after the test fix):
  optional hardening — add `repositionBossToPlayer: true`,
  `activateEncounterIfDormant: true`, and `pinHpTwice: true` to the
  `training-caverns-boss-low-hp` and `spire-ascent-boss-low-hp` registry entries to
  match `canyon-descent-boss-low-hp`. Prefer the test-side fix first; touch scenarios
  only when needed to keep authoritative HP and emitted snapshots consistent.
- Do **not** modify subticket folders marked `.passed` or any client/card renderer files.

## Verification: code
