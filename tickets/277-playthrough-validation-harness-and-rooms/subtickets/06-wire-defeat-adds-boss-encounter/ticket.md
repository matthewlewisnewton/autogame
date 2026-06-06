# Wire defeatAdds combat loop into boss-encounter step

Round-1 sub-ticket 04 failed because `defeatAdds()` exists in `harness/validate/lib/combat.mjs` but `runBossEncounterStep()` never calls it — the driver teleports near adds, fires one weapon swing, and immediately screenshots mid-combat without polling until adds are defeated or no longer threaten the boss approach. This sub-ticket wires the existing combat helper into the `--steps boss-encounter` slice only.

## Acceptance Criteria

- After god-mode is enabled and the `nearAddsScenario` debug shortcut positions the player, `runBossEncounterStep()` calls `defeatAdds(page, { bossType, timeoutMs, minAddsLeft: 0, onMidCombat })` instead of a single `z` + weapon-key press.
- `defeatAdds` drives real WASD movement toward nearest add coordinates, lock-on (`z`), and weapon/spell card input in a poll loop until no non-boss enemies with `hp > 0` remain (or the timeout throws).
- The `onMidCombat` callback captures `validation/rooms/03-mid-combat.png` only while at least one live add exists; the step fails if mid-combat is requested with zero live adds.
- After adds are cleared, dormant boss assertions (`assertDormantBoss`) still pass: exactly one `annex_overseer`, `encounter.phase === 'dormant'`, matching `bossEnemyId`.
- Screenshots `04-boss-dormant.png` and `05-boss-active.png` and `probes.json` dormant/active entries are still written after add clearance, boss-approach scenario positioning, and `activateEncounter()` WASD nudge into `ENCOUNTER_TRIGGER_RADIUS` (8 units).
- `--steps boss-encounter` (with deploy prereqs from sub-ticket 03) completes with `summary.ok: true` in `validation/rooms/run-summary.json` and records `bossEncounter.encounterPhase: "active"` / `encounterLocked: true`.
- `defeatAdds` is **not** duplicated inside `runVictoryStep` in a way that re-fights already-cleared adds for the `boss-encounter` slice; if `runVictoryStep` still calls `defeatAdds`, it must no-op when adds are already cleared.
- Console/page errors during the run are still collected to `validation/rooms/console.log` via `wireConsoleLog` / `writeConsoleLog`.

## Technical Specs

- `harness/validate/playthrough.mjs`: refactor `runBossEncounterStep()` to import and call `defeatAdds` with an `onMidCombat` hook that calls `writeScreenshot(page, outDirAbs, '03-mid-combat')`; remove the inline single-swing combat block (lines ~249–258). Keep `enableGodmode`, `requestScenario(nearAddsScenario)`, dormant/active screenshot flow, and `activateEncounter` unchanged.
- `harness/validate/lib/combat.mjs`: use existing `defeatAdds`, `nudgeToward`, `lockOntoNearestAdd`, `swingAtTarget`, and `chooseAttack` — adjust only if the boss-encounter slice needs a small API tweak (e.g. export `focusCanvas` or tighten `minAddsLeft` semantics).
- `harness/validate/presets/rooms.mjs`: no changes expected (`bossType: 'annex_overseer'`, `nearAddsScenario`, `bossApproachScenario`, `encounterTriggerRadius: 8`).
- Depends on passed sub-tickets **01–03**. No `game/` changes unless add combat cannot complete in reasonable time without a gated debug hook; document any such hook in findings.
- Scope: `harness/validate/**` only. Do not write victory screenshots (`06`/`07`) or `findings.md` in this sub-ticket.

## Verification: code
