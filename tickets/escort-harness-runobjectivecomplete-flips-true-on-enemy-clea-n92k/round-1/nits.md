## Escort-specific browser capture for harness rounds

Round-1 capture fell back to the generic Initiate Vault smoke plan (`capturePlanSource: "fallback"`) and never exercised `?debugScenario=escort-near-destination` or probed `runObjectiveComplete` during an escort run. The fix is validated by vitest, but future harness rounds on escort tickets would benefit from an agent-guided or scripted capture plan that deploys the escort fixture, clears wave-0 without moving the NPC, and asserts `runObjectiveComplete === false` in-browser.

### Acceptance Criteria
- Capture plan deploys `escort_objective_fixture` via `escort-near-destination` debug scenario (or equivalent scripted flow).
- Probe after killing the lone grunt records `runObjectiveComplete: false`, `runStatus: 'playing'`, and `objective.defeatedEnemies === objective.totalEnemies`.
- `metrics.json` `scenarios` or `probes` includes the escort harness-state snapshot.

## Expose `reachedDestination` in harness objective snapshot

`__AUTOGAME_HARNESS_STATE__().objective` trims server fields and omits `reachedDestination` for escort runs; callers must infer destination status from `gameState.run.escort` outside the returned snapshot. Adding `reachedDestination` (and optionally `escortFailed`) to the trimmed `objective` object would make escort probes self-contained and easier to debug without reading raw run state.

### Acceptance Criteria
- For `objective.type === 'escort'`, harness `objective` includes `reachedDestination` mirrored from `run.objective.reachedDestination`.
- Existing harness-state tests updated; no change to `runObjectiveComplete` computation semantics.
