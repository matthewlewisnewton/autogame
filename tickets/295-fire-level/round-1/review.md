# Review: 295-fire-level

## Runtime health

PASS. The captured game run loaded cleanly: `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only normal Vite connection messages plus the debug-scenario log, with no `pageerror` or `[fatal]` entries from game code. The Vite `EPIPE` lines in `client.log` are benign socket-close noise.

## Acceptance criteria findings

### Fire level reachable via its quest

PASS. `ember_descent` is present as a Tier 1 quest, appears in the quest variant catalog, and maps through `getLayoutProfileForQuest('ember_descent', 1)` to `fire-cavern`. The normal select-quest path calls `applyLayoutForQuest`, which uses the quest seed, `generateLayout(seed, 'fire-cavern', { slopes: true, layoutMode: 'default' })`, and the regular ready/deploy flow then starts the run from that selected quest.

### Fire level reachable via a debug scenario

FAIL. The `fire-cavern` debug scenario is registered and can visibly swap to the fire layout, but it is not equivalent to a normal deploy. It lives in the generic post-`enterPlayingPhase` section of `applyDebugScenario`: the handler starts a default run first, then changes `state.selectedQuestId` to `ember_descent`, applies the fire layout, and respawns enemies. Unlike the Tier 2 debug scenarios, it does not rebuild `state.run` after changing the quest/layout. That leaves run metadata such as `run.questId`, `run.questName`, reward, and objective label tied to the previous/default quest while the layout and enemies are fire-cavern. This violates the debug-scenario invariant that the shortcut must land in the same state a real player can reach by selecting the quest and deploying.

### Layout generation and floor alignment

PASS. `generateLayout` has a dedicated `fire-cavern` branch and exports `generateFireCavern`; the generated stage has a high `rim`, a low `basin`, descent ramps, cover, bounds, walkable AABBs, and floor corners compatible with the existing `sampleFloorY` path. Server tests cover deterministic generation, rim/basin/ramp structure, reachable rooms, bidirectional rim-to-basin traversal, and player Y alignment through the debug shortcut.

### Themed visuals and lighting

PASS on code coverage, with a capture caveat. The client has a distinct `fire-cavern` palette, rim/basin/ramp floor materials, elevated rim floor rendering, basin treasure marker alignment, cover rendering, and fire-cavern atmosphere interpolation/reset. The focused client tests pass. The top-level capture, however, used the fallback `sunken-canyon-stage` scenario rather than a fire scenario, so it did not provide direct screenshot evidence of the fire level in this round.

### Design and foundation consistency

PASS. The implementation keeps the existing lobby/dungeon/quest loop intact, uses the established quest/layout profile hooks, and reuses the existing sloped-floor sampling model from the design doc. The captured run still satisfies the foundation requirements: Three.js scene initializes, clients connect over Socket.IO, multiplayer state is present, and movement/dodge probes update the player without console errors.

### Debug scenario checks

FAIL for invariant preservation. The scenarios are registered through the existing debug-only path and gated by `ALLOW_DEBUG_SCENARIOS`, non-production local sockets, or URL-driven debug flow. The same end state is reachable through normal gameplay by selecting Ember Descent and deploying. But the `fire-cavern` shortcut does not preserve the normal run-start invariant because quest selection/layout are changed after the run is created.

### Tests and coverage

PASS for executed tests. `coverage.log` reports 109 test files and 1895 tests passed, including `server/test/fire_cavern_walkability.test.js`, `server/test/debug-scenarios.test.js`, `server/test/quests.test.js`, `server/test/dungeon.test.js`, `client/test/dungeon.test.js`, and `client/test/fire-atmosphere.test.js`. Coverage thresholds were disabled as expected. The remaining model URL warnings in client tests are existing test-environment noise, not runtime page errors.

## Remaining gaps

1. The `fire-cavern` debug deploy shortcut starts a default run before switching to the Ember Descent fire quest/layout, leaving stale run metadata and objective/reward state. Fix `game/server/debugScenarios.js` so the fire deploy path sets `ember_descent` and applies its layout before `enterPlayingPhase`, or explicitly rebuilds `state.run` with the fire quest after switching. Add assertions in `game/server/test/debug-scenarios.test.js` for `state.run.questId`, tier, name, objective label, and enemy count.

VERDICT: FAIL
