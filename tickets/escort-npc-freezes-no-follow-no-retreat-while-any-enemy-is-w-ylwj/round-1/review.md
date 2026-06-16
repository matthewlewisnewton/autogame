# Senior Review

## Runtime Health

`metrics.json` reports `"ok": true`, the fallback capture reached gameplay with connected clients, initialized scene/canvas, visible combat HUD, movement, and dodge cooldown probes. `pageerrors` is empty, `pageerrors.json` is empty, and `console.log` has no `pageerror` or `[fatal]` lines from game code. The only console noise is a 409 auth/register conflict during harness setup, plus benign Vite/THREE shutdown/deprecation noise in the server/client logs.

Screenshots `01-initial.png` through `04-after-dodge.png` show the game rendering in hub and dungeon, the player taking normal combat damage, cards/HUD present, and the dodge cooldown state visible.

## Acceptance Criteria Findings

The ticket asks that Archivist Vale must not remain totally frozen merely because any living enemy is within `DETECTION_RADIUS`, especially when the enemy is not actually attacking the escort and the player has moved to the dais. The implementation replaces the old proximity-only `underAttack` check with `isEscortThreatened`, which mirrors enemy target acquisition: LOS is required, frozen enemies are ignored, field medics are ignored, player aggro grace is respected, taunts are honored, and only enemies that would target the escort/minion keep the escort from following. This satisfies the primary soft-lock fix.

The counter-case where an enemy is genuinely threatening the escort is preserved. The new tests cover a nearby living grunt that does not block following, and a grunt with LOS that actually targets the escort and makes the escort hold position. This keeps escort behavior consistent with the combat model rather than making the NPC blindly run through active attacks.

The fallback safeguard is present in `tickEscort`: once a squad member waits at the escort destination while the escort remains outside arrival radius, the run tracks stall time and fails after `ESCORT_STALL_FAIL_MS` if progress is not made. The objective label and run summary carry a clear stalled-escort failure reason, so the former indefinite `playing` state is no longer possible in the pinned escort case.

The new `escort-stall-wait` debug scenario is registered only through the existing debug scenario path. That path is guarded by `isDebugScenarioAllowed` and `ALLOW_DEBUG_SCENARIOS`/localhost/non-production checks, and normal gameplay does not touch the scenario registry. The scenario state is reachable through normal escort gameplay by reaching the destination while enemies keep Vale outside extraction range; it does not alter persistence, networking, or server validation invariants beyond staging the existing quest state for QA.

## Design And Regression Review

The change is consistent with the design doc's Annex Evacuation identity: escort remains a dungeon objective with scripted danger, completion on destination arrival, and failure when the NPC is lost or cannot reach extraction. It does not weaken the foundational client/server, rendering, multiplayer, or movement requirements.

The changed code is server-scoped and does not introduce client module load risk. The new CommonJS import from `escort.js` to `simulation.js` is safe in the live module graph because `simNow` is exported before `escort.js` consumes it at runtime, and the captured browser run confirms there are no page/module errors.

## Validation

`coverage.log` shows the escort-specific suite passing: `server/test/escort_objective.test.js` ran 17 tests, including the new follow-near-living-enemy and stall-fail safeguard cases. The same coverage run recorded one failure in `server/test/training_caverns_spawn_camp.test.js`; I reran that exact test locally with `pnpm exec vitest run server/test/training_caverns_spawn_camp.test.js`, and it passed, so I am treating the logged failure as a transient full-suite artifact rather than a current blocking regression.

## Remaining gaps

None.

VERDICT: PASS
