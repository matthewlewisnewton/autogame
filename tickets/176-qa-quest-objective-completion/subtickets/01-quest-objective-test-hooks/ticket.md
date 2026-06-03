# Quest-objective test hooks (debug scenario + harness-state exposure)

Add the deterministic test instrumentation needed to drive a quest objective to
completion in a headless playthrough and inspect the result. This is test/QA
instrumentation only — it must NOT change normal gameplay; it is gated behind the
existing `ALLOW_DEBUG_SCENARIOS=1` debug-scenario channel.

## Acceptance Criteria

- A new debug scenario named `quest-objective-near-complete` is registered in the
  server's debug-scenario handler and listed in the allowed-scenario list(s)
  alongside the existing scenarios (e.g. `run-exhausted`, `minion-combat`).
- When invoked during a `playing` run with a `defeat_enemies` objective, the
  scenario leaves the run one trigger away from completion: it clears the enemy
  list, sets `run.objective.totalEnemies = 1` and `run.objective.defeatedEnemies = 0`,
  spawns exactly one low-HP `grunt` enemy adjacent to the requesting player, and
  restores the player to full HP / full Magic Stones with a usable attack so the
  test can finish the objective through real combat (mirror the existing
  `run-exhausted` scenario's manipulation of `state.run.objective`, but keep the
  player's cards/hand intact so they can actually attack).
- Defeating that one enemy drives `recordEnemyDefeated` → `checkRunTerminalState`
  → `status = 'victory'` exactly as in normal play (no special-case completion
  logic added in the scenario itself — completion must flow through the real path).
- `window.__AUTOGAME_HARNESS_STATE__()` in `game/client/main.js` exposes the live
  run objective so a test can observe it flip to complete: add a top-level
  `objective` field containing `{ type, totalEnemies, defeatedEnemies, totalItems,
  collectedItems, label }` (copied from `gameState.run.objective`, or `null` when
  there is no run), and a `runObjectiveComplete` boolean derived from it.
- `__AUTOGAME_HARNESS_STATE__()` also exposes the most recent run-complete payload
  as `lastRunSummary` (the `runComplete` summary object, or `null` if none yet) so
  the test can read `objective`, `status`, and `rewards.currency` after victory.
- The scenario returns the standard `debugScenarioResult` `{ ok: true, scenario }`
  shape on success and a `{ ok: false, reason }` shape if there is no active
  `playing` run (consistent with sibling scenarios).
- A server unit test in `game/server/test/server.test.js` (or the existing
  integration suite) covers the new scenario: after applying it to a started
  `defeat_enemies` run, exactly one enemy exists and `run.objective.totalEnemies === 1`;
  recording that enemy's defeat yields `isRunObjectiveComplete(run.objective) === true`
  and a `victory` terminal state.
- Existing server + client test suites pass (`pnpm test`); normal (non-debug) runs
  are unaffected.

## Technical Specs

- `game/server/index.js`: add the `quest-objective-near-complete` branch in the
  `debugScenario` handler (the same `if/else if (name === ...)` chain that holds
  `run-exhausted` ~line 854 and `minion-combat` ~line 805) and add the name to the
  allowed-scenario list(s) near lines 424 / 534. Reuse helpers already in scope:
  `spawnEnemy`, `ENEMY_DEFS.grunt`, `MAX_HP`, `MAX_MAGIC_STONES`, and the run's
  `state.run.objective`. Do not duplicate completion logic — only set up the
  near-complete state.
- `game/server/progression.js`: reuse existing `recordEnemyDefeated`,
  `isRunObjectiveComplete`, and `checkRunTerminalState` (no changes expected; if a
  small export is needed for the unit test, export it minimally).
- `game/client/main.js`: extend the object returned by
  `window.__AUTOGAME_HARNESS_STATE__` (~line 3919) with `objective`,
  `runObjectiveComplete`, and `lastRunSummary`. Capture `lastRunSummary` in the
  existing `runComplete` socket handler (store into a module-scoped variable the
  harness-state getter reads). Keep this inside the existing
  `// v8 ignore` block so coverage is unaffected.
- `game/server/test/server.test.js`: add the unit test described above using the
  existing test setup/quest helpers (`QUEST_DEFS`, run start helpers already used
  by neighbouring tests).

## Verification: code
