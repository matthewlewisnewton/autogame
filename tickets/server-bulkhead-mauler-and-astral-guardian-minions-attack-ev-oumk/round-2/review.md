# Senior Review — Server: bulkhead_mauler and astral guardian minions attack every tick

**Baseline:** `e88ce75517216967fb118d3d5f42ff6a331993e7`  
**Commits reviewed:** `7aaa8882` (mauler interval), `ae108bdb` (guardian interval)  
**Capture:** `round-2/metrics.json` — `ok: true`, `pageerrors: []`, fallback smoke flow completed.

## Runtime health

The captured run is clean:

- `metrics.json` reports `ok: true` with no `harness_failure`, empty `pageerrors`, and four gameplay screenshots from the deterministic smoke flow.
- `console.log` has no `pageerror` or `[fatal]` lines from game code (only benign Vite connect noise and a 409 on an expected auth conflict).
- Probes show `phase: "playing"`, scene initialized, canvas present, and normal combat HUD after movement/dodge.

The game starts and loads; runtime health does **not** block.

## Acceptance criteria

### Mauler and guardian-type minions attack at a configured interval (>=1000ms), not per tick

**Bulkhead Mauler — satisfied.** The `bulkhead_mauler` branch in `updateMinions()` gates cone attacks with `attackIntervalMs` (default 1500ms) and `lastAttackAt`, matching the `null_crawler` / `storm_eagle` pattern. `cardStats.json` defines `"attackIntervalMs": 1500` for `bulkhead_mauler`. Unit tests confirm first swing deals damage and a second `updateMinions()` call within the same interval does not deal double damage or push extra breaths.

**Astral Guardian / Aegis Sentinel — satisfied (round-2 fix).** Sub-ticket `03-guardian-attack-interval` completes the work that round-1 lacked:

- `cardStats.json` now carries `"attackIntervalMs": 1500` on both `astral_guardian` and `aegis_sentinel`.
- The one-tick `CARD_STAT_OVERLAY.astral_guardian` entry was removed from `progression.js`.
- `applyAstralShieldCast` in `cardEffects.js` defaults to `1500` instead of `Math.floor(1000 / TICK_RATE)`.
- The guardian branch in `simulation.js` falls back to `1500` instead of one tick.
- `astral_guardian.test.js` now expects `attackIntervalMs: 1500` on spawn and includes double-tick regression tests proving no repeat damage within the interval.

`aegis_sentinel` inherits the same spawn path (`applyAstralShieldCast`) and cardStats interval; its `attackDamage: 0` means the interval gate is defensive consistency rather than DPS-critical, but the configured interval is present and >= 1000ms as required.

### CARD_USED minion-breath events emitted at most once per attack

**Bulkhead Mauler — satisfied.** `_pendingMinionBreaths` is only pushed inside the interval gate when `hits.length > 0`, and `lastAttackAt` advances once per elapsed interval. This stops the ~20 CARD_USED broadcasts/sec per mauler described in the ticket.

**Guardian types — N/A for CARD_USED spam.** `astral_guardian` / `aegis_sentinel` use direct `damageEnemy()` in the guardian branch; they do not push `_pendingMinionBreaths`. The ticket's event-spam concern was mauler-specific; guardian fix addressed attack **rate** only.

### Existing minion tests updated/passing

**Satisfied.** Mauler tests in `creature_minions.test.js` and guardian tests in `astral_guardian.test.js` were updated with interval assertions and double-tick regression coverage. Harness coverage run: 1862 tests passed (`round-2/coverage.log`). Independent re-run of minion-related suites also passes (2911 tests total in full quick run).

## Design & regression check

- Change is server-side simulation and card data only; no client regressions observed in capture.
- Interval defaults (1500ms) align with sibling minions (`storm_eagle` 1500ms, `null_crawler` 2000ms) and do not conflict with `game/docs/design.md`.
- No foundation regressions against combat cadence expectations in `game/docs/requirements.md` (server-authoritative tick simulation unchanged except gated attack timing).
- No new debug scenarios were added; nothing to audit on that axis.

## Code quality

Implementation is consistent across both minion families:

- Interval read once per tick; attack + side effects + `lastAttackAt` update are atomic inside the gate.
- Mauler advances `lastAttackAt` even on cone whiff, preventing per-tick retry spam when an enemy is in range but outside the arc.
- Guardian spawn via `applyAstralShieldCast` explicitly sets `attackIntervalMs` and `lastAttackAt: 0` on the minion object (stronger than mauler's generic creature spawn path).

## Test & coverage

- Changed server files exercised by `creature_minions.test.js` (bulkhead mauler) and `astral_guardian.test.js` (guardian interval).
- `aegis_sentinel.test.js` continues to pass; taunt behavior unchanged.
- Harness coverage completed without failures on changed paths.

## Debug scenarios

No new or modified `?debugScenario=` shortcuts in this ticket.

## Remaining gaps

None. Round-1 blocking gaps (guardian per-tick melee and incomplete ticket scope) are resolved in commit `ae108bdb`.

## Nits (non-blocking)

See `nits.md` for follow-up polish on spawn-path consistency and test coverage for `aegis_sentinel` interval inheritance.

VERDICT: PASS
