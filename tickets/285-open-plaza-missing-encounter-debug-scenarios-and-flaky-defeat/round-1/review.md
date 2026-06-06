## Per-Criterion Findings

### Runtime health
PASS. The captured run proof is clean: `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only Vite connection logs, scene initialization, ready-up, and the applied `sunken-canyon-stage` debug scenario; there are no `pageerror` or `[fatal]` lines from game code. Server and client logs show normal startup and teardown, with only a benign THREE deprecation warning in the Vite client log.

### Add open-plaza / arena_trials encounter debug scenarios
PASS. The implementation adds and registers `arena-trials-near-adds`, `arena-trials-boss-approach`, and `arena-trials-boss-low-hp` in the existing debug-scenario path. Each requires an active `arena_trials` Tier 2 stage-boss run and refuses to run outside that state, so normal gameplay does not touch the shortcuts. The client entry remains the localhost `?debugScenario=NAME` flow, with the socket event serving as the existing transport behind that debug path.

The scenarios are consistent with the training-caverns and canyon-descent patterns: near-adds clusters live adds with a usable weapon, boss-approach requires adds cleared and places the player just outside the dormant trigger, and boss-low-hp preserves the real boss enemy, locks/activates the encounter, and leaves the player to finish through normal combat. The normal state remains reachable by clearing Arena Trials Tier 1 to unlock Tier 2, deploying into the `arena_trials` stage-boss quest, defeating adds, approaching the arena dais, and fighting the `arena_champion`.

### Investigate and retune arena_champion defeat flakiness
PASS. `arena_champion` HP is reduced from 500 to 420 while leaving its identity and pressure profile unchanged (`attackDamage`, cone style/angle, and range are pinned by tests). This aligns it with `spire_warden`, matching the design note that stage boss HP values should stay within a tight band so full-HP defeats fit the 180s validation window.

### Design and requirements consistency
PASS. The new Stage Bosses section in `game/docs/design.md` accurately documents the HP tuning and preserves the open plaza boss as a hard-hitting, long-range encounter. The changes do not regress the foundation in `game/docs/requirements.md`: the captured run proves the 3D scene renders, socket connection works, multiplayer state appears, and movement/dodge interactions still update.

### Code quality, tests, and coverage
PASS. The code is scoped to server debug scenario setup, scenario registration, the enemy definition, docs, and focused tests. The scenario code uses existing helpers for quest layout, encounter anchors, floor sampling, lobby broadcast, and state snapshots; no dead or broken code was found. Coverage log shows `75` test files and `1421` tests passing, including `server/test/debug-scenarios.test.js` and `server/test/arena_champion_hp.test.js`.

## Remaining gaps

None.

VERDICT: PASS
