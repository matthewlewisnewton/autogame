# Senior Review — Server: bulkhead_mauler and astral guardian minions attack every tick

**Baseline:** `e88ce75517216967fb118d3d5f42ff6a331993e7`  
**Commits reviewed:** `7aaa8882` (sub-ticket `01-mauler-attack-interval` only)  
**Capture:** `round-1/metrics.json` — `ok: true`, `pageerrors: []`, fallback smoke flow completed.

## Runtime health

The captured run is clean:

- `metrics.json` reports `ok: true` with no `harness_failure` and an empty `pageerrors` array.
- `console.log` has no `pageerror` or `[fatal]` lines from game code (only benign Vite connect noise and a 409 on an expected auth conflict).
- Probes show `phase: "playing"`, scene initialized, canvas present, and normal combat HUD after movement/dodge.

The game starts and loads; runtime health does **not** block.

## Acceptance criteria

### Mauler and guardian-type minions attack at a configured interval (>=1000ms), not per tick

**Bulkhead Mauler — satisfied.** The `bulkhead_mauler` branch in `updateMinions()` now gates attacks with `attackIntervalMs` (default 1500ms) and `lastAttackAt`, matching the `null_crawler` / `storm_eagle` pattern. `cardStats.json` defines `"attackIntervalMs": 1500` for `bulkhead_mauler`, and spawned minions inherit it via the generic minion factory in `cardEffects.js`. A new unit test confirms a second `updateMinions()` call within the same interval does not deal double damage or push extra breaths.

**Astral Guardian / Aegis Sentinel — not satisfied.** The top-level ticket explicitly calls out guardian melee minions defaulting to one simulation tick (`Math.floor(1000 / TICK_RATE)` ≈ 50ms at 20 Hz). That default is still in place:

- `game/server/cardEffects.js:208` — generic minion spawn: `attackIntervalMs: cardDef.attackIntervalMs || Math.floor(1000 / TICK_RATE)`
- `game/server/progression.js:202` — `CARD_STAT_OVERLAY.astral_guardian` hard-codes the one-tick interval
- `game/shared/cardStats.json` — `astral_guardian` and `aegis_sentinel` entries have no `attackIntervalMs`
- `game/server/simulation.js:2893` — guardian branch fallback: `minion.attackIntervalMs || Math.floor(1000 / TICK_RATE)`

`astral_guardian` minions therefore still melee for 11 damage every tick (~220 DPS) when in range. `aegis_sentinel` has `attackDamage: 0` so the per-tick loop is a no-op for damage, but the interval default still violates the criterion and leaves inconsistent spawn stats.

Only sub-ticket `01-mauler-attack-interval` was implemented; no sub-ticket or commit addressed guardian intervals.

### CARD_USED minion-breath events emitted at most once per attack

**Bulkhead Mauler — satisfied.** `_pendingMinionBreaths` is only pushed inside the interval gate, and at most once per elapsed `attackIntervalMs`. This stops the ~20 CARD_USED broadcasts/sec per mauler described in the ticket.

**Guardian types — N/A for CARD_USED spam.** `astral_guardian` / `aegis_sentinel` use direct `damageEnemy()` in the guardian branch; they do not push `_pendingMinionBreaths`. The remaining guardian gap is attack **rate**, not event spam.

### Existing minion tests updated/passing

**Partially satisfied.** Mauler tests in `creature_minions.test.js` were updated and a new double-tick regression test was added. Full suite passes (`pnpm test:quick`, 2910 tests). However, `astral_guardian.test.js` still asserts spawned minions use the one-tick `attackIntervalMs` and includes a test named for per-tick DPS — those tests encode the old (buggy) behavior and were not updated because the guardian fix was not attempted.

## Design & regression check

- Change is server-side simulation only; no client regressions observed in capture.
- Mauler fix aligns with existing minion interval patterns (`null_crawler` 2000ms, `storm_eagle` 1500ms) and does not conflict with `game/docs/design.md`.
- No new debug scenarios were added; nothing to audit on that axis.

## Code quality (mauler scope)

The mauler implementation is sound: interval read once per tick, attack + breath push + `lastAttackAt` update are atomic inside the gate, and `lastAttackAt` advances even on whiff (preventing per-tick cone retries). Minor inconsistency: `null_crawler` spawn in `cardEffects.js` explicitly sets `attackIntervalMs` and primes `lastAttackAt`, while `bulkhead_mauler` relies on the generic factory — works today because `cardStats.json` now carries the field, but less explicit than sibling minions.

## Test & coverage

- Changed files exercised by `creature_minions.test.js` (13 tests, all pass).
- Harness coverage run completed; no new coverage concerns on the mauler diff.
- No automated test currently guards guardian interval >= 1000ms.

## Debug scenarios

No new or modified `?debugScenario=` shortcuts in this ticket.

## Remaining gaps

1. **Guardian minions still attack every simulation tick** — `astral_guardian` deals 11 dmg × 20/s; defaults remain `Math.floor(1000 / TICK_RATE)` in spawn, overlay, simulation fallback, and tests. Top-level acceptance criterion not met.
2. **Ticket scope incomplete** — only mauler sub-ticket landed; guardian interval work was never committed.

## Nits (non-blocking)

- `bulkhead_mauler` spawn handler could mirror `null_crawler` by explicitly assigning `attackIntervalMs` / primed `lastAttackAt`.
- `astral_guardian.test.js` test title and expectations will need updating when guardian intervals are fixed.

VERDICT: FAIL
