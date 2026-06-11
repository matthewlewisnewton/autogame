# Senior Review — encounters: boss-encounter HUD never appeared in any tested Frost Crossing path

## Runtime health (capture proof)

The captured run is clean as a *game-starts* check:
- `metrics.json`: `"ok": true`, `"pageerrors": []`, scene initializes (`[initScene] Initializing Three.js scene...`).
- `console.log`: only benign noise (Vite connect, a 409 on a resource, scene init). No `pageerror` / `[fatal]` from game code.
- No `harness_failure` block.

So the game loads and runs without crashing — the runtime-health gate passes.

**However**, the capture does NOT exercise the feature this ticket is about. `capturePlanSource` is `"fallback"` ("Deterministic full-flow smoke capture"), and `screenshot.log` shows the lobby-create/join path timed out, so the run dropped into a generic default quest:
- Probes report `objective.label = "Initiate Vault..."` — this is **not** Frost Crossing / the ice level.
- `encounter: null` and `bossEncounter: null` in every probe.
- Screenshots `01..04` are generic W/D/dodge gameplay; no boss-encounter HUD anywhere.

## Acceptance criterion

> A scripted or manual playthrough screenshot shows the boss-encounter HUD visible with the warden's name and a draining HP bar during the Frost Crossing tier 1 boss fight, in both the natural-trigger path and the debug-scenario path used by validation.

**NOT MET (no visual proof anywhere).** The ticket exists precisely because "the HUD never appeared in any tested path." After this work, it *still* has not appeared in any captured path:

- **Top-level round-1 capture:** fallback smoke, never reaches Frost Crossing (see above). No HUD.
- **Sub-ticket captures (02, 03):** also generic fallback smokes — `01-in-dungeon` / `02-suspended-lobby` / `02-after-w` / `04-after-dodge`. None capture the boss encounter HUD.
- **Committed `game/validation/ice/` artifacts:** STALE — generated against the *old* preset before this ticket's retarget. `run-summary.json` has `objectiveType: "defeat_enemies"`, the old assertion keys `layoutDeployed` / `enemiesCleared` / `victoryFired`, and **zero** `bossEncounter` probes. The PNGs are the old names (`05-glacial-slow.png`, `07-objective-complete.png`, `08-victory.png`) — none of the `05-boss-dormant.png` / `06-boss-active.png` / `09-boss-defeated.png` the retargeted preset and `verify-ice-artifacts.mjs` now require.

Worse, the committed validation snapshot now **contradicts the new code**: `verify-ice-artifacts.mjs` (this ticket) requires `bossSpawned` / `encounterActivated` / `bossDefeated` / `bossEncounterUiVisible` assertions and the renamed PNGs, and explicitly *fails* if `layoutDeployed` / `enemiesCleared` are present — which the committed `run-summary.json` still has. Running `pnpm validate:ice` verification against the tree as committed would fail. Sub-ticket 03's handoff confirms this was knowingly deferred: *"Optional: harness may run `pnpm validate:ice` to refresh game/validation/ice/ boss-encounter probes."* It was never run.

Per review policy, the captured run is the proof and a ticket must not pass on code alone. The one AC is fundamentally a *visual-proof* requirement, and that proof does not exist in this round.

## What the implementation got right (code-level)

The code changes themselves are coherent and the supporting tests pass:

- **Debug-scenario fix (the real bug).** `setupFrostCrossingLastEnemyDebug` previously left the encounter dormant / `bossEncounter` null. It now routes through `setupQuestBossLowHp` (`game/server/debugScenarios.js`) which **activates + locks** the encounter and pins the warden to 1 HP, so `bossEncounter` populates and the HUD shows. New scenarios `frost-crossing-encounter-trigger` and `frost-crossing-boss-low-hp` are registered in both `debugScenarios.js` and the `index.js` allow-set. This is gated behind the debug `?debugScenario=` path only — normal gameplay does not touch it.
- **Natural-path coverage (unit level).** `frost_crossing_stage_boss.test.js` now drives `tryActivateEncounter` by moving the player within `ENCOUNTER_TRIGGER_RADIUS` of the `ice_cairn` landmark after scripted clears, asserting `phase=active`, `locked=true`, live warden — i.e. the real trigger, not a test-only shortcut. The debug scenario does not replace this path.
- **Client wiring (unit level).** `boss-encounter-hud-wiring.test.js` adds two cases proving an active+locked `frost_crossing` encounter renders the Permafrost Warden HUD (name + `hpPct`) and that a `stateUpdate` for the engaged last-enemy shape populates a non-null `bossEncounter` and unhides `#boss-encounter-hud`.
- **Harness retarget** of `presets/ice.mjs` to `objectiveType: 'stage_boss'` with boss-encounter probes, plus the parameterized screenshot names threaded through `playthrough.mjs` / `cardMechanics.mjs` / `distinctVictoryScreenshots.mjs` / `findings.mjs`, is internally consistent.

These are good and would, *if the ice validation were actually run*, produce the required proof. The gap is that it was not run, leaving the AC undemonstrated and the committed validation artifacts stale.

## Consistency / regressions

No design or foundation regressions spotted. Changes are additive (new debug scenarios, retargeted preset, extra tests). The debug shortcuts are dev-gated and the equivalent end-state remains reachable via normal play (cairn trigger), so no invariant is short-circuited.

## Remaining gaps

1. **(Blocking)** The sole acceptance criterion — a playthrough screenshot of the boss-encounter HUD (warden name + draining HP bar) in both the natural-trigger and debug-scenario paths — is not demonstrated by any capture in this round. The top-level and sub-ticket captures are generic fallback smokes that never reach Frost Crossing (`bossEncounter: null`), and the committed `game/validation/ice/` artifacts are stale (old `defeat_enemies` preset, no `bossEncounter` probes, old PNG names) and inconsistent with the retargeted preset + `verify-ice-artifacts.mjs`.

VERDICT: FAIL
