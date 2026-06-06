# Game victory harness hooks and boss-low-HP scenario

Round-4 remediation for failed sub-ticket 09. The harness `--steps full` victory polling (`waitForVictoryState`) requires client harness fields the game does not yet expose for `stage_boss` objectives, and the Rooms preset references a `training-caverns-boss-low-hp` debug scenario that is not registered server-side. Add the minimal gated hooks so the playthrough driver can reliably detect boss defeat and victory without long combat timeouts.

## Acceptance Criteria

- `window.__AUTOGAME_HARNESS_STATE__().runObjectiveComplete` is `true` when `objective.type === 'stage_boss'` and `objective.bossDefeated === true` (not only `defeat_enemies` / `collect_items` math).
- `showRunSummary` mirrors a `status === 'victory'` payload onto `gameState.run` immediately (at minimum `gameState.run.status = 'victory'` and `gameState.run.objective.bossDefeated = true` when applicable) so harness polling sees victory before any delayed server resync.
- `game/server/debugScenarios.js` registers `training-caverns-boss-low-hp`: gated on `ALLOW_DEBUG_SCENARIOS`, reuses the tier-2 Training Caverns layout, positions the player beside the dormant `annex_overseer`, and sets boss HP to a low value (e.g. `1`) so `defeatBoss` finishes quickly.
- `game/server/index.js` whitelists `training-caverns-boss-low-hp` alongside the other training-caverns scenarios.
- Unit tests cover the `stage_boss` `runObjectiveComplete` branch, the `showRunSummary` victory mirror, and the new debug scenario handler.
- `cd game && pnpm test:quick` passes.
- No `harness/` changes in this sub-ticket.

## Technical Specs

- `game/client/main.js`: extend `runObjectiveComplete` in `__AUTOGAME_HARNESS_STATE__`; update `showRunSummary` to mirror victory onto `gameState.run`.
- `game/server/debugScenarios.js`: add `training-caverns-boss-low-hp` handler (follow `training-caverns-boss-approach` patterns).
- `game/server/index.js`: add scenario name to debug-scenario allowlists.
- `game/client/test/main.test.js`: tests for harness `runObjectiveComplete` on `stage_boss` and victory mirror after `showRunSummary`.
- `game/server/test/debug-scenarios.test.js`: test emitting `training-caverns-boss-low-hp` yields low-HP `annex_overseer` and playing phase.
- Depends on passed sub-tickets **01–08**. Sub-ticket **10** may land in parallel; this ticket must complete before sub-ticket **12** executes the full run.

## Verification: code
