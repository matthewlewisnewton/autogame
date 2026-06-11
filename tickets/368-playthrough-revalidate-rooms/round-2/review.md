# Senior Review: 368-playthrough-revalidate-rooms

## Per-Criterion Findings

### Runtime Health

PASS. The round-2 capture proves the game starts and loads cleanly: `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. The capture `console.log` has no `pageerror` or `[fatal]` lines from game code. Server/client log tails only show expected startup, debug-scenario application, and benign Vite/socket shutdown noise.

### Rooms Revalidation Artifacts

PASS. `game/validation/rooms/run-summary.json` reports a full `rooms` preset run with `ok: true`, `steps: "full"`, and the required Training Caverns Tier 2 preset configuration. `game/validation/rooms/findings.md` exists and records a PASS outcome with no console/page errors and no visual glitches reported by the driver.

The expected screenshots and probes cover the full playthrough surface: hub/lobby, level entry, mid-combat, dormant/active boss, boss defeated, victory, slow/burn mutual exclusion, Purifying Pulse, wind-up telegraph, and telepipe before/after.

### New Content Coverage

PASS. The validation evidence covers the requested new content:

- Boss health-bar UI: `bossEncounterUiVisible` is true, with HUD visible for Annex Overseer at 100% HP during the active encounter.
- Boss visuals: `bossDistinctFromAdds` is true in the captured probe, with the Annex Overseer rendered larger than the nearby grunt comparison.
- Slow/burn card behavior: slow is active after Glacial Orb, then cleared when Fireball applies burn, satisfying mutual exclusion.
- Heal/cleanse behavior: Purifying Pulse raises HP from 40 to 60 and clears burn from the player and statuses from enemies.
- Wind-up card behavior: Magma Greatsword enters `cardUseState: "windup"`, locks input, and shows the telegraph.
- Telepipe vitals/new sortie: HP and magic stones persist through the telepipe flow, and new-sortie card charges reset.

### Design And Requirements Consistency

PASS. The validation remains consistent with `game/docs/design.md`: Training Caverns remains a distinct room/dungeon flow, stage-boss behavior still uses the documented stage-boss encounter model, card combat still exercises spells/weapons/creatures, and telepipe persistence matches the documented durability rules. The foundation requirements are not regressed in the captured run: the scene initializes, the socket connection is live, a player is present in 3D space, and gameplay state updates are observed.

### Code Quality And Test Evidence

PASS with one blocking debug-scenario caveat below. The implementation is mostly scoped to validation harness behavior, rooms artifacts, and debug helpers. Coverage output shows `141` test files and `1876` tests passing; thresholds are disabled. The server/client capture logs do not show live runtime crashes.

The changed room harness is covered by focused tests for crowded-layout card exercises, rooms findings rendering, and Training Caverns debug scenarios. The `spawnEnemy is not a function` circular-require failure documented by the implementation appears resolved by moving the activation hook registration through `debugScenarios`.

### Debug Scenario Review

FAIL. Most added/changed shortcuts are gated through the existing debug-scenario path (`ALLOW_DEBUG_SCENARIOS` / non-production test access) and document their normal gameplay equivalents. However, the rooms boss visual comparison still depends on `spawnHarnessBossVisualAddIfNeeded`, which runs when `ALLOW_DEBUG_SCENARIOS=1` and a player is in `training-caverns-boss-approach`. That hook spawns a fresh 1-HP grunt beside the Annex Overseer after encounter activation.

Normal Training Caverns stage-boss activation does not reach that same end-state: `tryActivateEncounter()` activates/locks the encounter and clears non-boss enemies on activation. The debug-only hook therefore creates an active boss-plus-add state that normal gameplay cannot reach, specifically to satisfy `bossDistinctFromAdds`. That violates the debug-scenario requirement that QA shortcuts must be shortcuts to normally reachable states, not substitutes for them.

## Remaining gaps

1. The boss visual comparison relies on a debug-only spawned grunt in an active Training Caverns boss encounter, but normal activation clears non-boss enemies, so the QA end-state is not reachable through normal gameplay. Rework the rooms boss visual assertion to compare against a real reachable add state, or prove the comparison through non-shortcut gameplay without spawning a post-activation debug add.

VERDICT: FAIL
