# Fix arena-trials-boss-approach Vitest failure

Round-1 balance work is complete, but the overall harness Vitest run still fails because `debugScenario — arena-trials-* > places player outside dormant boss trigger after adds cleared` receives `approachResult.ok === false`. Align the `arena-trials-boss-approach` debug scenario (and its test setup) with the same adds-cleared source of truth used by `tryActivateEncounter` / `nudgeDebugBossApproachPlayers` in `encounters.js`, without changing card balance from sub-tickets 01–04.

## Acceptance Criteria

- After `arena-trials-tier-2` deploy, manually clearing all non-boss enemies (same pattern as the test: set non-boss `hp = 0`, filter dead) allows `arena-trials-boss-approach` to return `{ ok: true, scenario: 'arena-trials-boss-approach' }` while the encounter remains `dormant`.
- The player is repositioned outside `ENCOUNTER_TRIGGER_RADIUS` of the encounter anchor (`resolveEncounterAnchor` with `arena_dais` fallback).
- `debugScenario — arena-trials-* > rejects arena-trials-boss-approach while adds remain` still returns `{ ok: false }` with an adds-not-cleared reason.
- Existing passing arena-trials harness tests (including `debugScenario — arena-trials harness combat shortcuts > places player outside dormant arena_champion trigger after adds cleared`) remain green.
- `cd game && pnpm test:quick` completes with zero failures (specifically `server/test/debug-scenarios.test.js`).

## Technical Specs

- **`game/server/debugScenarios.js`**
  - In the `arena-trials-boss-approach` handler (~line 667), replace the `liveArenaTrialsAdds(state).length > 0` gate with `areAllNonBossEnemiesDefeated(state, state.run.encounter.bossEnemyId)` imported from `encounters.js` (already used by `nudgeDebugBossApproachPlayers` in the same file). Keep the dormant-phase and anchor checks.
  - Optionally tighten `liveArenaTrialsAdds` to match `liveSpireAscentAdds` (any live non-boss enemy) if the near-adds scenario still needs a helper — do not leave two conflicting definitions of “adds cleared”.
- **`game/server/encounters.js`**
  - Read-only reference for `areAllNonBossEnemiesDefeated` / `clearNonBossEnemies`; export is already available — reuse rather than duplicate logic.
- **`game/server/test/debug-scenarios.test.js`**
  - In the failing `debugScenario — arena-trials-*` boss-approach test (~line 1107), prefer `clearNonBossEnemies(state, bossId)` (or equivalent encounter helper) instead of ad-hoc filtering so the test and scenario share one definition of cleared adds.
  - If the failure reason was anchor-related, assert against `resolveEncounterAnchor(state.run, state) || resolveArenaDaisAnchor(state)` consistently with the scenario placement math.
- **Do not modify** `progression.js`, `cardEffects.js`, `cardStats.json`, or `game/validation/card-balance/report.md`.

## Verification: code
