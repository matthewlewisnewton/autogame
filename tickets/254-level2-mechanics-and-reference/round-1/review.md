# Review: 254-level2-mechanics-and-reference

## Runtime Health

The captured run does not satisfy the mandatory startup/load gate. `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`, and the capture timed out waiting for the game flow to become ready. `pageerrors.json` is empty and `console.log` does not contain `pageerror` or `[fatal]` lines from game code, but the browser repeatedly saw 502 responses while the Vite proxy logged `ECONNREFUSED 127.0.0.1:3003` for `/socket.io`, `/api/register`, and `/api/login`. Because there is no clean live run proving the game starts and loads, the ticket cannot pass.

## Acceptance Criteria Findings

### Tier-1 enemies almost never variants; Tier-2 frequently variants

The normal gameplay spawn path appears to satisfy the tier-rate requirement. `resolveVariantRollTier()` maps Tier 1 to zero variant chance and Tier 2+ to a full base roll tier, while `spawnEnemy()` combines the active run quest tier with the spawn room encounter tier before calling `applyVariant()`. The targeted tests cover deterministic batch rates, Tier 1 null variants, and Tier 2 open-plaza tagging.

There is a blocking integration issue in the newly added `arena-trials-tier-2` debug scenario, though. `applyDebugScenario()` calls `enterPlayingPhase()` before the scenario-specific branch, and `enterPlayingPhase()` immediately creates a run for the previously selected quest/tier. The branch then sets `state.selectedQuestId = 'arena_trials'` and `state.selectedQuestTier = 2`, regenerates the layout, and calls `spawnEnemies()`, but `spawnEnemy()` reads `_gameState.run?.questTier` before falling back to `selectedQuestTier`. That means the debug shortcut can render the Tier 2 arena while rolling variants and run metadata under the stale pre-scenario run tier, so it is not equivalent to the normal Tier 2 deployment state.

### Tier-2 layout is more deterministic

The normal `arena_trials` Tier 2 path uses `layoutMode: 'rigid'`, and `generateOpenPlaza()` switches rigid mode to ordered cover placement plus fixed hazard templates. The tests compare Tier 2 cover/hazards across seeds and verify Tier 1 still varies, which matches the criterion.

### Open-plaza Tier-2 fully playable

The code path for normal play is present: Arena Trials Tier 1 victory unlocks Tier 2, lobby selection/readiness reject locked Tier 2 attempts, `applyLayoutForQuest()` applies the Tier 2 rigid open-plaza options, and `spawnEnemies()` uses the quest enemy count and pool. However, this cannot be accepted as fully playable because the live capture did not complete a clean load, and the new Tier 2 debug shortcut does not actually reproduce the normal Tier 2 run state.

### Tests and Coverage

`coverage.log` shows the test suite passed: 78 test files and 1403 tests. Coverage visibility was collected with thresholds disabled. The new tests cover variant-rate scaling, rigid open-plaza layout behavior, Tier 2 unlock persistence, and Tier 2 spawn placement, but they do not catch the stale-run metadata in the debug shortcut.

## Design and Requirements Consistency

The implementation is consistent with the documented dungeon loop and does not intentionally weaken the server-authoritative quest/spawn model. The normal code path preserves the server-client architecture in `game/docs/requirements.md`; the captured runtime failure means that architecture was not proven in the browser for this review round.

## Debug Scenario Review

The `arena-trials-tier-2` scenario is gated through the existing `debugScenario` socket path and `isDebugScenarioAllowed()` guard, so normal gameplay does not touch it. The same Tier 2 end state is reachable through normal play by clearing Arena Trials Tier 1, unlocking Tier 2, selecting it in the lobby, and readying up. The shortcut currently fails the invariant-equivalence check because it mutates selected quest/tier after a run has already been started for another tier, leaving variant rolls and run metadata out of sync with the displayed Tier 2 arena.

## Remaining gaps

1. The captured run failed the mandatory runtime gate: `metrics.json` has `"ok": false` / `failure_kind: "capture_failed"`, browser traffic hit repeated 502s, and Vite logged `ECONNREFUSED 127.0.0.1:3003` for auth/socket requests.
2. The `arena-trials-tier-2` debug scenario is not equivalent to normal Tier 2 deployment because it starts a run before selecting Arena Trials Tier 2, so spawned enemies can use stale `run.questTier` for variant rolls and stale run metadata/objective state.

VERDICT: FAIL
