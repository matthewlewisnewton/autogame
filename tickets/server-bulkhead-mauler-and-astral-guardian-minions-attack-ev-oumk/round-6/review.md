# Senior Review — Server: bulkhead_mauler and astral guardian minions attack every tick

**Baseline:** `181225ba0d15ed11a662db15652e98af0dc38bc4`  
**Commits reviewed:** `c5539bdc` (mauler interval gate), `d01f7ec1` (guardian default interval)  
**Capture:** round-6 `metrics.json` + `console.log`

## Runtime health

| Check | Result |
| --- | --- |
| `metrics.json` present | Yes |
| `ok` | `true` |
| `pageerrors` | `[]` |
| `harness_failure` | absent |
| `console.log` fatal/pageerror | none (only benign Vite connect logs and HTTP 409 on duplicate register) |

The game starts, loads the Initiate Vault run, renders gameplay screenshots, and completes the deterministic smoke flow. No blocking runtime defects.

## Acceptance criteria

### Mauler and guardian-type minions attack at a configured interval (≥1000 ms), not per tick

**Met.**

- **`bulkhead_mauler`** (`game/server/simulation.js` ~3416–3452): reads `attackIntervalMs` (default **1500 ms**) and `lastAttackAt`; damage + `_pendingMinionBreaths` only run inside `if (now - lastAttackAt >= attackIntervalMs)`. `lastAttackAt` is set after a successful cone hit.
- **`astral_guardian` / `aegis_sentinel`** (`simulation.js` ~3202–3213): default interval raised from `Math.floor(1000 / TICK_RATE)` (~50 ms) to **1500 ms**. Interval gate matches storm_eagle/null_crawler pattern.
- **Card data** (`game/shared/cardStats.json`): `attackIntervalMs: 1500` added for `bulkhead_mauler`, `astral_guardian`, and `aegis_sentinel`.
- **Spawn path** (`game/server/cardEffects.js` ~240): `applyAstralShieldCast` now defaults `attackIntervalMs` to 1500 instead of one tick. Creature-spawn path for bulkhead_mauler relies on the simulation default (also 1500); behavior is correct though spawn could mirror null_crawler's explicit copy (nit only).

1500 ms sits inside the ticket's 1000–2000 ms guidance and aligns with `storm_eagle`.

### CARD_USED minion-breath events emitted at most once per attack

**Met for mauler (the broadcast offender).**

`runGameLoopTick` broadcasts one `CARD_USED` per `_pendingMinionBreaths` entry (`game/server/index.js` ~1503–1508). Mauler pushes at most one breath per gated swing, and only when `hits.length > 0`, so event rate is bounded to ≤1 per 1500 ms per mauler. Guardian melee applies direct `damageEnemy` without `_pendingMinionBreaths`; it was never a CARD_USED spam source.

### Existing minion tests updated/passing

**Met.**

- `creature_minions.test.js`: new interval-gating tests for mauler and guardian (+ aegis_sentinel default path).
- `astral_guardian.test.js`: expectations updated from tick-derived interval to 1500 ms.
- Harness coverage run: all **3218** tests pass (214 files), including the changed suites.
- Independent re-run of minion-related tests during review: pass.

## Design & regression check

- **design.md:** Creature minions now follow the same attack-cadence model as other interval-gated allies (storm_eagle, null_crawler). No change to lobby loop, telepipe, or card-type semantics.
- **requirements.md foundation:** Server-authoritative combat unchanged; only minion DPS/cadence corrected. No client-only shortcuts introduced.
- **progression.js:** Removed the obsolete `astral_guardian` tick-derived overlay now that `attackIntervalMs` lives in shared `cardStats.json` — correct consolidation.

## Debug scenarios

This ticket did not add or change `?debugScenario=` shortcuts. Nothing to gate-check.

## Code quality

Implementation is focused, consistent with neighboring minion branches, and covered by targeted unit tests. No dead code or obvious logic bugs found in the changed paths.

Minor stale comments/docs remain in validation/sync helpers (see nits backlog); none affect behavior.

## Integration notes

Two sub-tickets landed cleanly with no merge conflicts in `game/`. Changes are limited to server simulation, card spawn defaults, shared card stats, and tests — no client/renderer edits required for this server-side cadence fix.

The round-6 capture exercises generic gameplay (lobby → deploy → movement → dodge) rather than spawning mauler/guardian minions, but unit tests directly prove the interval gates. Combined with a clean runtime capture, that is sufficient evidence for this ticket scope.

## Remaining gaps

None. All acceptance criteria are satisfied and the captured run is healthy.

VERDICT: PASS
