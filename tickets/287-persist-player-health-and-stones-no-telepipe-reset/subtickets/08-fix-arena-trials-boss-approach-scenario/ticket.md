# Fix arena-trials-boss-approach debug scenario

The server coverage run fails on `debugScenario — arena-trials-* > places player outside dormant boss trigger after adds cleared` because `arena-trials-boss-approach` returns `{ ok: false }`. Consolidate the duplicate handler blocks and ensure the scenario succeeds once adds are cleared while keeping the player outside the encounter trigger with the encounter still dormant.

## Acceptance Criteria

- `debugScenario` handler for `arena-trials-boss-approach` returns `{ ok: true }` when invoked after `arena-trials-tier-2` with all grunt/skirmisher adds cleared (matching the test setup in `debug-scenarios.test.js`).
- Player is repositioned just outside `ENCOUNTER_TRIGGER_RADIUS` from `resolveEncounterAnchor(state.run, state)` (fallback `resolveArenaDaisAnchor(state)` if anchor missing).
- After placement, `state.run.encounter.phase` remains `dormant` (does not auto-activate the arena_champion).
- Only one `arena-trials-boss-approach` handler block remains in `debugScenarios.js` (remove the unreachable duplicate earlier in the chain).
- While editing, remove the duplicate `arena-trials-near-adds` block if present — keep the version that clusters adds away from the arena dais trigger.
- `server/test/debug-scenarios.test.js` test `places player outside dormant boss trigger after adds cleared` in describe `debugScenario — arena-trials-*` passes without modification (unless the test's manual add-clear setup needs a one-line fix to match live add detection).
- `cd game && pnpm test:quick` passes (including full `debug-scenarios.test.js`).

## Technical Specs

- **`game/server/debugScenarios.js`**
  - **Duplicate removal:** delete the first `arena-trials-boss-approach` block (~574–598) that uses only `resolveArenaDaisAnchor`; keep the later block (~731–758) that uses `resolveEncounterAnchor(state.run, state) || resolveArenaDaisAnchor(state)` and the null-anchor guard.
  - **Precondition checks:** verify `liveArenaTrialsAdds(state)` correctly reflects cleared adds after the test zeroes non-boss enemies; if miniboss or other add types block approach incorrectly, narrow or align the add-clear helper with actual arena_trials Tier 2 spawn types.
  - **Placement:** position at `anchor.x + ENCOUNTER_TRIGGER_RADIUS + 1, anchor.z`; set floor Y via `sampleFloorY`; keep `debugScenarioNudgeAfter` nudge if BOSS_APPROACH_NUDGE_SCENARIOS expects it.
  - **Duplicate `arena-trials-near-adds`:** remove the earlier copy (~516–571) if the later copy (~671–728) is the canonical cluster-away-from-dais implementation.

- **`game/server/test/debug-scenarios.test.js`**
  - No change expected if scenario fix is sufficient; only touch if add-clear simulation must call a shared helper instead of manual `hp = 0` filtering.

## Verification: code
