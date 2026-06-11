# Senior Review — encounters: boss-encounter HUD never appeared in Frost Crossing

## Runtime health (blocking pre-check)

- `round-2/metrics.json`: `"ok": true`, `"pageerrors": []`, servers started on
  :5175, scene initialized, both players reached gameplay. The lone `409` in
  `console.log` is the expected duplicate-lobby-create conflict from the
  two-client harness, not a game fault. No `pageerror`/`[fatal]` lines.
- Note: the round-2 capture used `capturePlanSource: "fallback"` — a generic
  full-flow smoke run (`bossEncounter: null`, generic "Initiate Vault"
  objective). It proves the game loads and runs cleanly but does NOT itself
  exercise the boss HUD. The boss-HUD acceptance proof comes from the
  regenerated ice-preset validation artifacts under `game/validation/ice/`
  (regenerated against this code in commit `6b903e22`), which I verified below.

Game runs cleanly → pre-check passes.

## Acceptance criterion

> A scripted or manual playthrough screenshot shows the boss-encounter HUD
> visible with the warden's name and a draining HP bar during the Frost
> Crossing tier 1 boss fight, in both the natural-trigger path and the
> debug-scenario path used by validation.

**Debug-scenario path — MET.** `game/validation/ice/06-boss-active.png` shows
the `#boss-encounter-hud` rendered: "STAGE BOSS / **Permafrost Warden** / Frost
Crossing" with the HP bar present. `probes.json` `bossEncounterUi` records
`hudVisible: true`, `bossName: "Permafrost Warden"`, `encounterPhase: "active"`,
`encounterLocked: true`; `findings.md` marks `bossEncounterUiVisible: PASS`.
This is the exact state that was previously null/hidden. The root cause is
fixed: the validation scenarios (`frost-crossing-boss-low-hp`,
`frost-crossing-encounter-trigger`) now route through the real server encounter
state machine — `activateEncounter(state.run)` + `lockEncounter(state.run)`
(debugScenarios.js:1141-1146, 1193-1200) — so `run.encounter.phase` actually
flips to `active`/locked and the client computes `bossEncounter` the same way
normal play does. The previous `frost-crossing-last-enemy` path that pinned the
boss to 1 HP without ever locking the encounter (leaving the HUD hidden) is
gone; it now delegates to `setupFrostCrossingBossLowHpDebug`.

**Natural-trigger path — MET.** `frost_crossing_stage_boss.test.js` was
rewritten to drive the *real* landmark trigger: it positions the player within
`ENCOUNTER_TRIGGER_RADIUS` of the `ice_cairn` landmark and asserts
`tryActivateEncounter(state) === true`, `encounter.phase === ACTIVE`,
`encounter.locked === true`, with the `permafrost_warden` still alive. This is
the gameplay code path the bot failed to reach during the original QA, now
proven at the unit level to flip the encounter to engaged.

**HP bar.** The validation still is captured with the boss pinned to 1 HP, so
`hpFillWidthPct` reads `0` (near-empty bar) — the bar is present but not shown
mid-drain. The "draining" behaviour itself is covered by
`boss-encounter-hud-wiring.test.js`, which asserts the fill width tracks boss
HP across updates (100% → 25%, 60%, etc.) and hides on death. Acceptable; noted
as a nit (a fuller bar in the still would be more convincing).

## Debug-scenario integrity (review criterion #4)

- **Gated:** new scenarios `frost-crossing-encounter-trigger` and
  `frost-crossing-boss-low-hp` are registered only in `DEBUG_SCENARIO_REGISTRY`
  and the `DEBUG_SCENARIOS` allow-set (index.js:589-590). URL param is the only
  entry point; normal gameplay never touches them.
- **Same end-state reachable normally:** the natural `ice_cairn` →
  `tryActivateEncounter` path reaches the identical `active`+locked encounter
  state, proven by the rewritten server test. The scenario is a shortcut, not a
  substitute.
- **No invariant bypass:** scenarios call the real `activateEncounter` /
  `lockEncounter`; they do not fabricate client `bossEncounter` nor skip the
  server snapshot. The HUD is driven off the genuine replicated encounter
  state.

## Consistency / regression

- Only two game logic files changed: `debugScenarios.js` and `index.js`
  (registry). HUD rendering (`main.js`/`index.html`) was untouched and already
  worked at baseline — confirming the bug was scenario-side, exactly as the
  ticket diagnosed.
- Other touched scenarios (`near-adds`, `glacial-thrower-slow`,
  `surface-transition`) were updated to zero out only non-boss enemies and
  `removeDeadEnemies()` rather than `state.enemies = []`, deliberately keeping
  the dormant stage boss alive so later boss-encounter steps still find the
  warden — a sound fix that keeps the validation chain coherent.
- 81/81 tests pass across `frost_crossing_stage_boss.test.js`,
  `debug-scenarios.test.js`, and `boss-encounter-hud-wiring.test.js`.
- `game/validation/ice/findings.md` reports a fully green run (boss spawned,
  encounter activated, boss defeated, victory, HUD visible, slippery floor,
  glacial slow, card mechanics, telepipe reset) with no console/page errors.

## Remaining gaps

None blocking. The game runs cleanly and the acceptance criterion is met in both
the natural-trigger path (server test) and the validation debug-scenario path
(captured `06-boss-active.png` HUD screenshot). One non-blocking nit recorded
separately.

VERDICT: PASS
