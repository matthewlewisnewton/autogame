# Fix arena-trials-boss-approach debug-scenario test failure

The Excalibur Photon balance work is complete, but the full vitest coverage run still fails because `debugScenario — arena-trials-* > places player outside dormant boss trigger after adds cleared` receives `{ ok: false }` from `arena-trials-boss-approach`. Reproduce the failure, inspect `approachResult.reason`, and make the cleared-adds → boss-approach harness path reliable so the suite passes without changing Excalibur Photon card stats or wind-up behavior.

## Acceptance Criteria

- Reproduce with `cd game && pnpm exec vitest run server/test/debug-scenarios.test.js -t "places player outside dormant boss trigger after adds cleared"`; the `arena-trials-*` case currently fails with `approachResult.ok === false`.
- After the fix, that test and the sibling `debugScenario — arena-trials harness combat shortcuts > places player outside dormant arena_champion trigger after adds cleared` both pass.
- `arena-trials-boss-approach` still rejects when live adds remain (`rejects arena-trials-boss-approach while adds remain` stays green).
- When `arena-trials-boss-approach` succeeds, the player is placed outside `ENCOUNTER_TRIGGER_RADIUS` of the dormant encounter anchor and `state.run.encounter.phase` remains `dormant`.
- `cd game && pnpm test:quick` passes (no regressions in other debug-scenario or Excalibur wind-up tests).

## Technical Specs

- **`game/server/debugScenarios.js`**: Add a harness-only debug scenario `arena-trials-adds-cleared` (mirror the add-clearing block already used in `stage-boss-active` / `arena-trials-boss-low-hp`) that, on the **server**, zeroes and filters all non-`bossEnemyId` enemies via `clearNonBossEnemies` or equivalent, leaving a dormant Tier 2 `arena_trials` encounter with only `arena_champion` alive. Register it in the scenario handler and export list alongside the other `arena-trials-*` shortcuts.
- **`game/server/index.js`**: Add `'arena-trials-adds-cleared'` to `DEBUG_SCENARIOS` / `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN` sets.
- **`game/server/test/debug-scenarios.test.js`**: Update the failing `arena-trials-*` boss-approach test to clear adds through the new server-side scenario (`arena-trials-tier-2` → `arena-trials-adds-cleared` → `arena-trials-boss-approach`) instead of mutating `testGameState().enemies` locally between socket emits. Optionally align the duplicate harness-combat-shortcuts boss-approach test to the same three-step flow and dedupe redundant assertions if both blocks now cover the same contract.
- **Guard alignment (if `reason` is `Adds must be cleared`)**: Consider switching `arena-trials-boss-approach` preflight from `liveArenaTrialsAdds(state).length > 0` to `areAllNonBossEnemiesDefeated(state, bossId) === false` so the scenario matches encounter semantics when non-grunt add types exist.
- Do **not** change `game/shared/cardStats.json`, wind-up mechanics, or Excalibur Photon balance/report files (sub-tickets 01–03 are done).

## Verification: code
