# 06 — Fix arena-trials-boss-approach Vitest regression

Round-1 review found one blocking gap: the shared debug-scenario changes that enabled ROOMS validation now cause `arena-trials-boss-approach` to return `ok: false` in Vitest after adds are cleared. Restore the Arena Trials boss-approach scenario invariant without undoing the ROOMS harness shortcuts (`training-caverns-boss-approach`, `training-caverns-encounter-trigger`, boss-visual add hook, boss-approach nudge).

## Acceptance Criteria

- `cd game && pnpm test:quick` exits `0` with **zero** failed tests; `coverage.log` shows no failures in `server/test/debug-scenarios.test.js`.
- The specific case `debugScenario — arena-trials-* > places player outside dormant boss trigger after adds cleared` passes: after `arena-trials-tier-2` + `clearNonBossEnemies`, emitting `arena-trials-boss-approach` returns `{ ok: true, scenario: 'arena-trials-boss-approach' }`.
- After boss-approach succeeds, the player is positioned **outside** `ENCOUNTER_TRIGGER_RADIUS` of the encounter anchor, and `state.run.encounter.phase` remains `dormant`.
- `rejects arena-trials-boss-approach while adds remain` still passes (`ok: false`, reason matches `/Adds must be cleared/`).
- ROOMS validation artifacts remain green: `cd game && pnpm validate:rooms:check` exits `0`, and `game/validation/rooms/run-summary.json` still has `"ok": true` with all eleven assertion booleans `true` (re-run `pnpm validate:rooms` only if the fix touches harness-relevant server paths and artifacts may be stale).
- No changes under `tickets/` or review artifacts; writable scope is `game/server/**` (and `game/validation/rooms/**` only if a re-run is required).

## Technical Specs

- **Primary files:** `game/server/debugScenarios.js`, `game/server/encounters.js`, `game/server/index.js`.
- **Test reference:** `game/server/test/debug-scenarios.test.js` — `describe('debugScenario — arena-trials-*')` block around the `places player outside dormant boss trigger after adds cleared` case (uses `clearNonBossEnemies`, `resolveEncounterAnchor`, `ENCOUNTER_TRIGGER_RADIUS`).
- **Investigate:** Why `arena-trials-boss-approach` returns `ok: false` after test-side add clear — likely failure paths are `Adds must be cleared`, `Encounter must be dormant`, or `No encounter anchor for boss approach`. Compare with the working `training-caverns-boss-approach` handler and `liveArenaTrialsAdds()` vs `liveTrainingCavernsAdds()` filtering.
- **Preserve ROOMS additions:** Do not remove `training-caverns-boss-approach`, `training-caverns-encounter-trigger`, `spawnHarnessBossVisualAddIfNeeded` (registered in `index.js` via `registerEncounterActivationHook`), or `nudgeDebugBossApproachPlayers` / `BOSS_APPROACH_NUDGE_SCENARIOS` — only narrow or guard them so they do not break Arena Trials.
- **Likely fix vectors:** Ensure `liveArenaTrialsAdds` and the boss-approach gate agree with `clearNonBossEnemies` / `areAllNonBossEnemiesDefeated`; confirm `resolveEncounterAnchor(state.run, state) || resolveArenaDaisAnchor(state)` is non-null for arena_trials tier 2; prevent encounter activation hooks or nudge logic from flipping phase to `active` before the dormant probe reads state.
- **Regression guard:** Run the isolated test file subset if helpful: `cd game && pnpm exec vitest run server/test/debug-scenarios.test.js -t "arena-trials"`.

## Verification: code
