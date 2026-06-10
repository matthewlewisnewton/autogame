# Ice level validation findings

**Outcome:** PASS
**Preset:** ice (`frost_crossing` / ice-cavern layout)

## Investigation conclusion (ticket 392)

**Validation artifact, not a real bug.** Ticket 372's initial ICE-playthrough
`telepipeVitalsPreserved` FAIL was a validation artifact — there was no ice
validation preset/findings and no server test pinned to `frost_crossing`, so the
ICE FAIL reflected a missing/misconfigured harness path, not a game defect. Vitals
carry-forward through suspend → hub → redeploy is **level-independent**:
`restoreCardCheckpoint()` (`game/server/progression.js`) never touches
`player.hp` / `player.magicStones`, and fresh-deploy carry-forward in
`checkAllReady` reapplies them regardless of level. No `game/server` fix was
required. The Playwright `ice` preset (ticket 372) and the server-side regression
tests below now prove the same behavior end-to-end.

## Assertions

- **layoutDeployed**: PASS
- **enemiesCleared**: PASS
- **victoryFired**: PASS
- **slipperyFloorOk**: PASS
- **glacialSlowApplied**: PASS
- **cardMechanicsOk**: PASS
- **telepipeVitalsPreserved**: PASS
- **cardChargesResetOnFreshSortie**: PASS

## Slippery floor

- **ok**: PASS
- speedWhileHolding: 9.75
- driftAfterRelease: 4.242086593322766
- **directionChangeWhileSliding**: PASS
- **enteredSlipperyBand**: PASS
- Screenshot: `game/validation/ice/03-slippery-floor.png`

## Glacial slow

- **glacialSlowApplied**: PASS
- **debugGodmodeOff**: PASS
- player.slowedUntil: 1781110106452
- HP before/after hit: 100 → 88
- Screenshot: `game/validation/ice/05-glacial-slow.png`

## Card mechanics

- **cardMechanicsOk**: PASS
- **burn**: PASS
- **slow**: PASS
- **cleanse**: PASS
- **windup**: PASS

## Stage boss gap

`frost_crossing` tier 1 has **no stage boss** — encounter UI and distinct boss visuals are N/A (tickets 283/284). The signature encounter is the named rare **Rimecast the Slow** on the ice band; victory is driven by the `defeat_enemies` objective only.

## Telepipe reset

- preSuspend: HP=60, MS=20, runId=a281f577-ff6b-40b6-8341-dafef7b29b7b
- postDeploy: HP=60, MS=20, runId=51b95dd1-500f-4779-bbfe-ab016b6ef6ac
- **telepipeVitalsPreserved**: PASS
- **cardChargesResetOnFreshSortie**: PASS

## Reproduction / regression test

- **Test:** `frost_crossing: telepipe extract preserves damage and spent magic
  stones across hub return and redeploy`
- **File:** `game/server/test/integration.test.js` (ticket 392 sub-ticket 01)
- Pinned to the ice level via the `frost-crossing-tier-1` debug scenario
  (`game/server/debugScenarios.js`); asserts `selectedQuestId === 'frost_crossing'`
  and an `ice`-band room so it cannot silently pass on the default quest.
- Drives: deploy → damage HP < MAX_HP → spend MS < starting → place telepipe →
  both players extract → hub return → redeploy, then asserts vitals persist.
- **Fresh-sortie test:** `frost-telepipe-ready: solo telepipe extract → re-emit →
  redeploy is a fresh ice sortie carrying vitals forward` — uses the
  `frost-telepipe-ready` scenario to abandon the suspended checkpoint and assert
  HP/MS carry-forward into a new run id.
- Result: **PASS** under `pnpm test` (from `game/`).

## Console / page errors

None observed.

## Visual notes

No visual glitches recorded by the driver.

## Floor alignment

Ice-cavern layout uses **entry**, **stone**, **ice**, and **ramp** elevation bands; probes record the band at each step.

- **Level entry**: playerY=0.5, floorY=0.5, delta=0.000, profile=ice-cavern, band=entry
- **Mid combat**: playerY=0.5, floorY=0.5, delta=0.000, profile=ice-cavern, band=ice

## Boss encounter UI

No boss encounter UI probe recorded.

## Boss visual identity

No boss visual identity probe recorded.

## Slow / burn mutual exclusivity

Covered by **Card mechanics** (`status-mutual-exclusion-ready`): burn cleared when slow applied (`burnCleared: true`).

## Heal / cleanse (Purifying Pulse)

Covered by **Card mechanics** (`purifying-pulse-ready`): burn removed and HP restored (40 → 60).

## Wind-up telegraph

Covered by **Card mechanics** (`magma-windup-ready`): `cardUseState: windup`, `windupFlashing: true`, movement blocked during wind-up.

## Telepipe vitals and new-sortie charges

Covered by **Telepipe reset** above (HP/MS preserved; fresh `runId`; card charges reset on redeploy).

## New content exercise

- `08-victory.png` — see Screenshots list (`game/validation/ice/08-victory.png`)
- `09-telepipe-before.png` — see Screenshots list (`game/validation/ice/09-telepipe-before.png`)
- `10-telepipe-after.png` — see Screenshots list (`game/validation/ice/10-telepipe-after.png`)

## Screenshots

- `game/validation/ice/01-lobby-browser.png`
- `game/validation/ice/01-hub.png`
- `game/validation/ice/02-level-entry.png`
- `game/validation/ice/03-slippery-floor.png`
- `game/validation/ice/04-mid-combat.png`
- `game/validation/ice/05-glacial-slow.png`
- `game/validation/ice/06-card-burn.png`
- `game/validation/ice/07-objective-complete.png`
- `game/validation/ice/08-victory.png`
- `game/validation/ice/09-telepipe-before.png`
- `game/validation/ice/10-telepipe-after.png`

## Harness-blocking fixes (game code outside this directory)

Minimal debug-scenario and harness-support edits required for a reliable full ice playthrough:

- `game/client/main.js` — dismiss `#lobby` on create-channel join (same as join) so hub/deploy screenshots capture in-run UI.
- `game/server/debugScenarios.js` — `frost-crossing-near-adds` respawns run-start grunts after surface-transition clears enemies; `frost-crossing-surface-transition` seats on south ice lip with launch momentum; `frost-crossing-glacial-thrower-slow` zeros velocity, seats on stone pad, and emits godmode-off after state sync so ice-ball slow-on-hit is deterministic; `frost-telepipe-ready` abandons a suspended checkpoint on re-emit for fresh-sortie vitals capture.
- `game/server/progression.js` — `frost-crossing-telepipe-ready` deploy suppresses live waves and enables godmode so suspend-walk telepipe QA is not interrupted by Frostmaw.
- `game/server/test/debug-scenarios.test.js` — expectations for ice-lip seating and glacial-thrower slow QA.

## Follow-ups

None — green run.
