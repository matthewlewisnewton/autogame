# Game boss-approach dormant timing for harness probes

Round-5 remediation for failed sub-ticket 12. The playthrough driver requests `training-caverns-boss-approach`, then asserts `encounter.phase === 'dormant'` before `activateEncounter` walks the player into the trigger. Server-side `nudgeDebugBossApproachPlayers` currently inches the player toward the boss every tick immediately, which can auto-activate the encounter before the harness reads the dormant probe. Defer the nudge and nudge toward the encounter anchor (not the boss body) so dormant screenshots and probes are stable.

## Acceptance Criteria

- `training-caverns-boss-approach` sets `player.debugScenarioNudgeAfter = Date.now() + 1500` when repositioning the player outside the trigger radius.
- `nudgeDebugBossApproachPlayers` skips players while `now < player.debugScenarioNudgeAfter`, and nudges toward `resolveEncounterAnchor(state.run, state)` instead of the boss entity position.
- `resolveEncounterAnchor` is exported from `game/server/encounters.js` for use by `debugScenarios.js`.
- `game/server/test/debug-scenarios.test.js` asserts that after `training-caverns-boss-approach`, 30 consecutive `runGameLoopTick()` calls leave `encounter.phase === 'dormant'` and the player still outside `ENCOUNTER_TRIGGER_RADIUS`.
- `cd game && pnpm test:quick` passes.
- No `harness/` or `validation/` changes in this sub-ticket.

## Technical Specs

- `game/server/debugScenarios.js`: import `resolveEncounterAnchor`; set `debugScenarioNudgeAfter` in the `training-caverns-boss-approach` handler; update `nudgeDebugBossApproachPlayers` deferral + anchor-based nudge (mirror the iter-5 diff from sub-ticket 12 feedback).
- `game/server/encounters.js`: add `resolveEncounterAnchor` to `module.exports`.
- `game/server/test/debug-scenarios.test.js`: import `runGameLoopTick`; extend the boss-approach test with the 30-tick dormant survival assertion.
- Depends on passed sub-tickets **01–11**. Sub-ticket **14** runs the full validation after this lands.

## Verification: code
