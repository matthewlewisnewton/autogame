# 09 — Arena Trials boss-approach debug regression

Coverage reports `debug-scenarios.test.js > places player outside dormant arena_champion trigger after adds cleared` fails because `arena-trials-boss-approach` returns `ok: false`. Restore the harness shortcut so a valid `arena_trials` tier 2 run after add clears positions the player outside the dormant boss trigger without weakening the normal boss-approach path.

## Acceptance Criteria

- After `arena-trials-tier-2` deploy and clearing all non-boss enemies on the server state, emitting `arena-trials-boss-approach` returns `{ ok: true, scenario: 'arena-trials-boss-approach' }`.
- The repositioned player sits outside `ENCOUNTER_TRIGGER_RADIUS` of the arena dais / encounter anchor; `run.encounter.phase` stays `ENCOUNTER_PHASES.DORMANT` through 30 `runGameLoopTick()` calls (nudge deferred via `debugScenarioNudgeAfter`).
- Scenario still rejects when adds remain (`rejects arena-trials-boss-approach while adds remain` stays green).
- Align add-clear gating with the working `training-caverns-boss-approach` pattern (`liveArenaTrialsAdds` length check) if that resolves false negatives from `areAllNonBossEnemiesDefeated` edge cases.
- `cd game && pnpm test:quick` passes, including `server/test/debug-scenarios.test.js` arena-trials harness combat shortcuts.

## Technical Specs

- **Edit:** `game/server/debugScenarios.js` — fix `arena-trials-boss-approach` handler (~line 853): verify tier-2 encounter exists after deploy, use `liveArenaTrialsAdds(state)` for add-clear detection, resolve anchor via `resolveEncounterAnchor(state.run, state) || resolveArenaDaisAnchor(state)`, place player at `anchor + ENCOUNTER_TRIGGER_RADIUS + 1`, set `debugScenarioNudgeAfter`, and return `{ ok: true }`. Do not break `arena-trials-near-adds`, `arena-trials-boss-low-hp`, or `nudgeDebugBossApproachPlayers`.
- **Reference:** `game/server/test/debug-scenarios.test.js` — `places player outside dormant arena_champion trigger after adds cleared` (lines ~367–401); mirror passing `training-caverns-boss-approach` flow.
- **Reference:** `game/server/encounters.js` — `areAllNonBossEnemiesDefeated`, `ENCOUNTER_TRIGGER_RADIUS`, dormant phase guards.

## Verification: code
