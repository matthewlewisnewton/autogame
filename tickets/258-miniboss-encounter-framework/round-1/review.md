# Senior Review

## Runtime health

The captured game run is healthy. `metrics.json` reports `ok: true`, no `pageerrors`, and no harness failure. `console.log` has no `pageerror` or fatal game-code lines; the observed 409 resource entries are non-fatal request conflicts during the smoke flow, and the Vite socket `EPIPE`/THREE deprecation messages in the logs are benign environment noise.

Coverage/test visibility is strong for this ticket: `coverage.log` reports 89 passed test files and 1643 passed tests, with focused coverage around encounters, stage-boss objectives, Arena Trials Tier 2, debug scenarios, and reward/unlock behavior.

## Acceptance criteria

### Reusable miniboss encounter

Mostly satisfied. The implementation adds `game/server/encounters.js` as a reusable encounter state machine with dormant, active, and cleared phases; boss IDs; spawn anchors; lock state; transition validation; trigger handling; and defeat hooks. `progression.js` preserves encounter state in run creation, snapshots, suspended checkpoints, game-loop trigger updates, and enemy cleanup. Tests cover phase transitions, snapshot/checkpoint preservation, trigger activation, spawner suppression while locked, and one-shot defeat hooks.

### Spawn designated boss

Satisfied for the normal quest path. `stage_boss` objectives spawn a configured boss type at the configured landmark, wire the boss ID into `run.encounter`, and spawn configured supports from the quest pool. Arena Trials Tier 2 is wired as a `stage_boss` quest using the `arena_dais` landmark, with tests confirming boss placement, support count, and Tier 2 quest metadata.

### Lock encounter

Satisfied for the implemented lock semantics. The boss remains idle while the encounter is dormant. The encounter activates and locks when supports are cleared or an active player reaches the trigger radius, then removes non-boss enemies and suppresses later spawner/survive spawns while locked. This matches the current codebase's lightweight encounter-lock model; there is no separate physical arena gate requirement in the ticket or design docs.

### Defeat grants reward/unlock hook

Satisfied on the normal code path. Boss death while active clears the encounter, marks the `stage_boss` objective complete, runs registered encounter reward hooks once, and then the existing terminal-state path grants run rewards. Arena Trials Tier 1 victory unlocks Tier 2 through the existing quest-tier persistence path; Tier 2 boss victory uses the same run-complete reward flow.

### Per-player HP scaling

Satisfied. `spawnEnemy()` already applies live party-size HP scaling to minibosses at spawn time, and the stage-boss spawn path uses that same function. Focused tests confirm the boss scales for larger parties while support enemies stay at baseline.

### Tests

Satisfied. The ticket includes focused tests for the encounter module, stage-boss objective behavior, trigger/lock behavior, boss defeat/reward hook behavior, Arena Trials Tier 2 wiring, quest board presentation, and relevant debug scenarios. The full captured test run passed.

## Design and requirements

The feature is consistent with the design document's lobby/deploy/dungeon loop and the existing objective-driven quest architecture. It does not regress the foundation requirements: the captured run renders, connects over WebSockets, shows multiplayer state, and movement/key-item smoke probes still work.

## Debug scenarios

Blocking gap found. The new `arena-trials-tier-2` debug scenario is gated behind the debug-scenario path, reaches a state normally obtainable by clearing Arena Trials Tier 1 and deploying Tier 2, and exercises the real Tier 2 quest/run setup closely enough for QA.

However, the added `stage-boss-dormant` and `stage-boss-active` shortcuts are not equivalent to the normal gameplay path. They select `arena_trials` Tier 1, let `enterPlayingPhase()` create a Tier 1 `defeat_enemies` run, then manually replace `state.run.objective`, manually attach `state.run.encounter`, and spawn a custom boss/support setup. That bypasses the real Arena Trials Tier 2 quest metadata, unlock/gating semantics, `createRunState()` encounter construction, configured `addCount: 4`, and normal quest-tier reward/unlock metadata. A debug shortcut for the stage-boss state must be a QA shortcut into the real Tier 2 flow, not a hand-built substitute state.

## Remaining gaps

1. `stage-boss-dormant` and `stage-boss-active` debug scenarios synthesize a Tier 1 stage-boss run instead of reaching the real Arena Trials Tier 2 stage-boss state through the normal quest/run setup.

VERDICT: FAIL
