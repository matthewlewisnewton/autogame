# Fix the failing arena-trials-boss-approach debug scenario + test

The changed coverage/test run is red: `server/test/debug-scenarios.test.js >
arena-trials-boss-approach` ("places player outside dormant boss trigger after adds cleared")
fails with `approachResult.ok` false after the non-boss enemies are cleared. The
`arena-trials-boss-approach` scenario is part of the validation driver surface, so this is a
blocking quality gap. Make the scenario succeed from a dormant Arena Trials Tier 2 run once the
adds are cleared, and make the scenario and its tests agree.

## Acceptance Criteria

- `cd game && pnpm test` (and the changed-file coverage run) reports the
  `server/test/debug-scenarios.test.js` suite fully green — specifically the
  `arena-trials-boss-approach` cases:
  - "places player outside dormant boss trigger after adds cleared" passes with
    `approachResult.ok === true` and `approachResult.scenario === 'arena-trials-boss-approach'`,
    the player positioned farther than `ENCOUNTER_TRIGGER_RADIUS` from the encounter anchor, and the
    encounter still in the `DORMANT` phase.
  - "rejects arena-trials-boss-approach while adds remain" still passes (returns `ok: false` with a
    reason matching `/Adds must be cleared/`).
- No other previously-passing test in `game/server/test/debug-scenarios.test.js` regresses; the full
  `pnpm test` suite is green (the prior run was `1 failed | 1719 passed` — the failed count must reach 0).
- The fix keeps the scenario's guards honest: it still requires an `arena_trials` Tier 2 run with a
  live `run.encounter`, still rejects when live adds remain, and still requires the encounter to be
  `dormant`. The scenario is not made to pass by weakening a guard that the "rejects … while adds
  remain" case depends on.

## Technical Specs

- `game/server/debugScenarios.js`: the `arena-trials-boss-approach` branch (around line 1185).
  Diagnose why `ok` comes back false in the "adds cleared" test path — likely a mismatch between how
  the test clears non-boss enemies (`clearNonBossEnemies` / `liveArenaTrialsAdds`) and the scenario's
  add-cleared / dormant / anchor guards, or an anchor (`resolveEncounterAnchor` /
  `resolveArenaDaisAnchor`) that resolves null in that state. Reconcile the scenario logic with the
  test's setup so a dormant Tier 2 run with cleared adds yields `{ ok: true }`.
- `game/server/test/debug-scenarios.test.js`: the `arena-trials-boss-approach` cases (around
  lines 1145–1186). Adjust the test setup/assertions only as needed so the scenario and test agree on
  the expected dormant boss-approach state; do not delete the negative ("adds remain") coverage.
- Keep the change confined to these two files. This is the debug-scenario surface owned by sub-ticket
  01; this sub-ticket only repairs the regression flagged in review, it does not add new scenarios.

## Verification: code
