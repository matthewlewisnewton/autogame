# Senior review: 312-excalibur-photon-windup-balance

## Per-criterion findings

### Runtime health

PASS. The round-2 capture proves the game starts and loads cleanly: `metrics.json` has `"ok": true`, `pageerrors: []`, no `failure_kind`, and the captured probes show both clients connected, entered gameplay, rendered canvases, moved, and used the dodge key item. `console.log` contains only Vite connection lines, Three.js scene initialization, and booth ready-up logs. The Vite `ECONNRESET` lines in `client.log` are socket-close proxy noise explicitly called out as benign.

### Excalibur Photon has a wind-up lockout

PASS. `game/shared/cardStats.json` now gives `excalibur_photon` `windUpMs: 600` while preserving `cooldownMs: 200`, `damage: 14`, and `swingsPerUse: 2`. The live server card definitions merge this stat data, and the existing card wind-up mechanic applies to cards with `windUpMs`.

The added wind-up tests cover the important behavior: Excalibur enters commitment with no immediate damage, blocks movement and further card/key-item inputs during the commitment, then resolves only after the wind-up.

### Sustained DPS/DPM moves toward the weapon band

PASS. The balance analyzer now computes weapon sustained DPM over `cooldownMs + windUpMs`, so Excalibur Photon moves from the previous 28 / 200 ms = 0.140 damage/ms outlier to 28 / 800 ms = 0.035 damage/ms. That is a large reduction toward the peer band while keeping the card's burst identity.

The updated `game/validation/card-balance/report.md` marks Excalibur Photon as done/ok with 14x2 burst unchanged, and `game/server/test/card_balance_metrics.test.js` asserts the effective cycle and DPM bounds.

### Per-hit damage unchanged

PASS. The implementation changes only `windUpMs` for `excalibur_photon`; `damage` remains 14 and `swingsPerUse` remains 2. The regression and evolution tests explicitly assert the 14 damage, two-swing behavior, and inherited evolved-card stats.

### Tests and coverage

PASS. The round-2 coverage log shows the full Vitest suite passed: 108 test files and 1777 tests. Coverage was collected with thresholds disabled for visibility. New/updated tests exercise the data stat, analyzer metric, evolution output, wind-up resolution, input lock, and instant-card regressions.

### Design and requirements consistency

PASS. The change stays within the card-combat model described in `game/docs/design.md`: Excalibur remains a weapon card with active combat timing, not a separate basic attack path or economy change. The capture also preserves the foundation in `game/docs/requirements.md`: Three.js scene renders, WebSocket multiplayer connects, players are visible, and movement/key-item input synchronize in a running session.

### Debug scenarios

PASS. This ticket adds `excalibur-windup-ready` and `arena-trials-adds-cleared` debug shortcuts. They are still gated by the existing debug socket path: the client emits `debugScenario` only from localhost `?debugScenario=...` or test hooks, and the server rejects debug scenarios unless `isDebugScenarioAllowed()` passes.

The Excalibur shortcut only creates a testable state that normal gameplay can reach by evolving `saber_of_light` into `excalibur_photon` and entering combat; it does not change persistence, rewards, or normal card-use validation. The arena shortcut mirrors a normal state after defeating all non-boss adds and is constrained to an active arena-trials Tier 2 stage-boss run.

## Remaining gaps

None. The captured run is clean, the acceptance criteria are met, and the remaining observations are non-blocking cleanup.

VERDICT: PASS
