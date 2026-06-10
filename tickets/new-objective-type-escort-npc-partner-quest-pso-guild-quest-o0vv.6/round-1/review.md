## Runtime health

PASS. The captured run loaded successfully: `metrics.json` has `ok: true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains no `pageerror` or `[fatal]` lines from game code. The Vite socket-close noise in `client.log` is benign under the review rules. The round lists screenshot names in `metrics.json`, but the `.png` files were not present in the directory, so the runnable proof here is the clean metrics/probes/logs rather than image inspection.

## Escort NPC follows, takes damage, and has visible HP

PASS. The live code registers `escort` as an objective type, spawns Archivist Vale as an `isEscort` minion for `objectiveType: 'escort'`, and the minion AI has an escort-specific branch that follows the nearest living, non-extracted player when not under attack. Enemies can acquire minions as combat targets, including the escort, and `damageMinion()` routes escort damage/death into escort failure handling. The client renders escort minions with the `escort_npc` visual and a persistent floating HP bar that tracks current `hp / maxHp`.

## Extraction victory and escort-death failure

PASS. `tickEscort()` marks `reachedDestination` when the escort reaches the resolved destination and calls the normal terminal-state path, so an alive escort reaching extraction produces victory. Escort death marks `run.escort.failed`, updates the objective label, and `buildRunSummary()` includes a distinct `failReason` for the run summary overlay. Focused server tests cover arrival victory, death failure, summary payloads, and checkpoint round-trip behavior.

## Ambush route points and dialogue

PASS. `annex_escort` is a new tier-1 quest with `objectiveType: 'escort'`, scripted encounter rooms, Archivist Vale metadata, and the route ambush dialogue beacon `They found us!` on room 1. The normal path is reachable through the quest board by selecting Annex Evacuation and deploying; the debug shortcut only stages that same doorway state.

## Design, requirements, and debug scenarios

PASS. The implementation matches the design direction for a PSO-style Guild Quest escort: it adds a real quest, objective registry support, NPC protection/failure semantics, route ambushes, and UI feedback without weakening the baseline requirements for rendering, websocket play, multiplayer visualization, or movement sync.

The new debug scenarios remain gated through the existing localhost/debug socket path and are only client-triggered from `?debugScenario=...`. They are QA shortcuts into states reachable by normal play: selecting/deploying Annex Evacuation, walking the escort to the ambush room, or escorting to the destination.

## Validation

Focused validation passed:

`pnpm exec vitest run --config vitest.config.js server/test/escort_objective.test.js client/test/escort-hp-bar.test.js --coverage.enabled=false`

The provided `coverage.log` shows the escort objective test suite and escort HP-bar suite passing. It also shows one unrelated full-suite failure in `server/test/debug-scenarios.test.js` for the existing `arena-trials-boss-low-hp` shortcut reporting a boss HP mismatch in `stateUpdate`; this ticket's diff does not touch that arena-trials scenario path, so I am not treating it as a blocking gap for this escort ticket.

## Remaining gaps

None.
VERDICT: PASS
